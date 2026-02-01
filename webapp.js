/****************************************************
 * webapp.gs
 * Client Portal Web App (LOCKED) + single API router
 *
 * SoT:
 * - Client portal locked via ?profile=<profileId>
 * - DTO only (no raw engine rows)
 * - Stability-first: ONE callable API fn (portal_api)
 *
 * Key stability moves:
 * - Public bridge fn (no underscore): portal_api()
 * - Bounded sheet reads (avoid getDataRange() on wide sheets)
 * - Always return shaped responses (never "undefined")
 ****************************************************/

function doGet(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const profileId = String(p.profile || p.profileId || "").trim();

    if (!profileId) {
      return HtmlService
        .createHtmlOutput("Missing query param: ?profile=<profileId>")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    const boot = getProfileBootstrap_(profileId);

    const tpl = HtmlService.createTemplateFromFile("client_portal");
    tpl.BOOTSTRAP_JSON = JSON.stringify(boot);

    return tpl.evaluate()
      .setTitle("Sygnalist — Client Portal")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return HtmlService
      .createHtmlOutput("Portal load failed:\n" + String(err && err.message ? err.message : err))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

/**
 * Public bridge (NO underscore) — browser calls this.
 * Keep this forever.
 */
function portal_api(profileId, req) {
  return portal_api_(profileId, req);
}

/**
 * Internal router (underscore OK).
 *
 * req shape:
 * { op: "ping"|"getInbox"|"getTracker"|"promote"|"updateTracker"|"diagTracker", data?: any }
 */
function portal_api_(profileId, req) {
  try {
    const profile = getProfileByIdOrThrow_(profileId);
    assertProfileActiveOrThrow_(profile);

    const op = String(req && req.op || "").trim();
    const data = (req && req.data) || {};

    if (!op) throw new Error("portal_api_: missing op");

    switch (op) {
      case "ping":
        return { ok: true, version: Sygnalist_VERSION, message: "pong" };

      case "getInbox": {
        const rows = readEngineSheetForProfile_("Engine_Inbox", profile.profileId);
        return { ok: true, version: Sygnalist_VERSION, inbox: rows.map(inboxRowToDto_) };
      }

      case "getTracker": {
        const rows = readEngineSheetForProfile_("Engine_Tracker", profile.profileId);
        return { ok: true, version: Sygnalist_VERSION, tracker: rows.map(trackerRowToDto_) };
      }

      case "promote":
        return promoteEnrichedJobToTracker_(profile.profileId, data);

      case "updateTracker": {
        return withProfileLock_(profile.profileId, "tracker_update", () => {
          assertNotThrottled_(profile.profileId, "tracker_update", 800);
          const res = updateTrackerEntryForProfile_(profile.profileId, data);
          return { ok: true, version: Sygnalist_VERSION, updated: res.updated };
        });
      }

      // Optional, but insanely useful to prove what's happening without "examining everything"
      case "diagTracker": {
        const diag = diagEngineSheet_("Engine_Tracker", profile.profileId);
        return { ok: true, version: Sygnalist_VERSION, diag };
      }

      default:
        throw new Error("portal_api_: unknown op: " + op);
    }

  } catch (e) {
    return {
      ok: false,
      version: (typeof Sygnalist_VERSION !== "undefined") ? Sygnalist_VERSION : "unknown",
      message: String(e && e.message ? e.message : e)
    };
  }
}

/****************************************************
 * Engine reads (bounded) + DTO mapping
 ****************************************************/

/**
 * Reads a sheet for a given profileId.
 * Stability-first:
 * - bounded range read (no getDataRange())
 * - returns [] on empty
 * - throws clear error if profileId header missing
 */
function readEngineSheetForProfile_(sheetName, profileId) {
  ensureEngineTables_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return []; // header only or empty

  const lastCol = lastHeaderCol_(sh);
  if (lastCol < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 2) return [];

  const rawHeaders = values[0].map(h => String(h || "").trim());
  const headersNorm = rawHeaders.map(normalizeHeader_);

  const idxProfile = findHeaderIndex_(headersNorm, [
    "profileid",
    "profile_id",
    "profile"
  ].map(normalizeHeader_));

  if (idxProfile === -1) {
    throw new Error(sheetName + " missing header: profileId. Found: " + rawHeaders.join(", "));
  }

  const pid = String(profileId || "").trim();

  // Filter first, map second (cheaper)
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;
    out.push(rowToObjectNormalized_(rawHeaders, headersNorm, row));
  }
  return out;
}

/**
 * Finds the last column in row 1 that has a non-empty header.
 * Prevents reading 500 empty columns just because the sheet got wide.
 */
function lastHeaderCol_(sh) {
  const maxCol = sh.getLastColumn();
  if (maxCol < 1) return 0;

  const headerRow = sh.getRange(1, 1, 1, maxCol).getValues()[0];
  for (let c = headerRow.length - 1; c >= 0; c--) {
    const v = String(headerRow[c] || "").trim();
    if (v) return c + 1;
  }
  return 0;
}

function normalizeHeader_(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-._]/g, "");
}

function findHeaderIndex_(headersNorm, aliasesNorm) {
  for (let i = 0; i < headersNorm.length; i++) {
    if (aliasesNorm.indexOf(headersNorm[i]) !== -1) return i;
  }
  return -1;
}

function rowToObjectNormalized_(rawHeaders, headersNorm, row) {
  const out = {};

  for (let i = 0; i < rawHeaders.length; i++) {
    const k = String(rawHeaders[i] || "").trim();
    if (!k) continue; // skip empty header cells
    out[k] = row[i];
  }

  // Canon keys (normalized)
  const canon = {};
  for (let i = 0; i < headersNorm.length; i++) {
    const k = headersNorm[i];
    if (!k) continue;
    canon[k] = row[i];
  }
  out._canon = canon;

  return out;
}

function inboxRowToDto_(o) {
  const c = (o && o._canon) || {};
  return {
    company: String(o.company || c.company || ""),
    title: String(o.title || c.title || ""),
    url: String(o.url || c.url || ""),
    source: String(o.source || c.source || ""),
    location: String(o.location || c.location || ""),
    score: Number(o.score || c.score || 0),
    tier: String(o.tier || c.tier || ""),
    roleType: String(o.roleType || c.roletype || ""),
    laneLabel: String(o.laneLabel || c.lanelabel || ""),
    category: String(o.category || c.category || ""),
    jobSummary: String(o.jobSummary || c.jobsummary || ""),
    whyFit: String(o.whyFit || c.whyfit || "")
  };
}

function trackerRowToDto_(o) {
  const c = (o && o._canon) || {};

  // Format dateApplied (user-set date)
  const d = (o.dateApplied !== undefined) ? o.dateApplied : c.dateapplied;
  const dateApplied =
    (d instanceof Date)
      ? Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(d || "");

  // Format added_at (auto-set timestamp) - MUST be string, not Date object
  const a = (o.added_at !== undefined) ? o.added_at : c.addedat;
  const addedAt =
    (a instanceof Date)
      ? Utilities.formatDate(a, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
      : String(a || "");

  return {
    company: String(o.company || c.company || ""),
    title: String(o.title || c.title || ""),
    url: String(o.url || c.url || ""),
    source: String(o.source || c.source || ""),
    location: String(o.location || c.location || ""),
    roleType: String(o.roleType || c.roletype || ""),
    laneLabel: String(o.laneLabel || c.lanelabel || ""),
    category: String(o.category || c.category || ""),
    jobSummary: String(o.jobSummary || c.jobsummary || ""),
    whyFit: String(o.whyFit || c.whyfit || ""),
    status: String(o.status || c.status || "Prospect"),
    dateApplied: dateApplied,
    notes: String(o.notes || c.notes || ""),
    added_at: addedAt
  };
}

/****************************************************
 * Optional diag helper
 ****************************************************/

function diagEngineSheet_(sheetName, profileId) {
  ensureEngineTables_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return { sheetName, exists: false };

  const lastRow = sh.getLastRow();
  const lastCol = lastHeaderCol_(sh);
  const headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  let matched = 0;
  if (lastRow >= 2 && lastCol >= 1) {
    const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const rawHeaders = values[0].map(h => String(h || "").trim());
    const headersNorm = rawHeaders.map(normalizeHeader_);
    const idxProfile = findHeaderIndex_(headersNorm, ["profileid","profile_id","profile"].map(normalizeHeader_));
    if (idxProfile !== -1) {
      const pid = String(profileId || "").trim();
      for (let r = 1; r < values.length; r++) {
        if (String(values[r][idxProfile] || "").trim() === pid) matched++;
      }
    }
  }

  return {
    sheetName,
    exists: true,
    lastRow,
    lastCol,
    headers,
    matchedRowsForProfile: matched
  };
}
