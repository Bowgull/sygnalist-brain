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
    const view = String(p.view || "").trim().toLowerCase();

    // Admin / Master portal: no profile or view=admin → show profile switcher
    if (!profileId || view === "admin") {
      const profiles = getProfileListForAdmin_();
      const baseUrl = (typeof CONFIG !== "undefined" && CONFIG.WEB_APP_URL)
        ? String(CONFIG.WEB_APP_URL).split("?")[0]
        : "";
      const tpl = HtmlService.createTemplateFromFile("admin_portal");
      tpl.PROFILES_JSON = JSON.stringify(profiles);
      tpl.BASE_URL_JSON = JSON.stringify(baseUrl);
      return tpl.evaluate()
        .setTitle("Sygnalist — Admin")
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
 * Returns minimal profile list for admin portal (bounded read via loadProfiles_).
 */
function getProfileListForAdmin_() {
  const profiles = loadProfiles_();
  return profiles.map(function(p) {
    return { profileId: p.profileId, displayName: p.displayName || p.profileId, status: p.status || "active" };
  });
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

      case "fetch": {
        // Fetch new jobs for this profile (with enrichment)
        const result = fetchForProfileWithEnrichment_(profile.profileId);
        if (!result || !result.ok) {
          return { 
            ok: false, 
            version: Sygnalist_VERSION,
            message: result && result.message ? result.message : "Fetch failed"
          };
        }
        return { 
          ok: true, 
          version: Sygnalist_VERSION, 
          count: result.written || 0,
          batchId: result.batchId,
          message: "Fetched " + (result.written || 0) + " enriched jobs"
        };
      }

      case "getInbox": {
        const rows = readEngineSheetForProfile_("Engine_Inbox", profile.profileId);
        return { ok: true, version: Sygnalist_VERSION, inbox: rows.map(inboxRowToCardDto_) };
      }

      case "getInboxDetail": {
        const jobKey = (data && typeof data.jobKey === "string" && data.jobKey.trim()) ? data.jobKey.trim() : (data && data.url ? data.url : (data && data.company && data.title ? data.company + "||" + data.title : ""));
        if (!jobKey) return { ok: false, version: Sygnalist_VERSION, message: "getInboxDetail: jobKey required" };
        const detail = getInboxDetailByKey_(profile.profileId, String(jobKey));
        if (!detail) return { ok: false, version: Sygnalist_VERSION, message: "Job not found" };
        return { ok: true, version: Sygnalist_VERSION, detail };
      }

      case "getTracker": {
        const rows = readEngineSheetForProfile_("Engine_Tracker", profile.profileId);
        return { ok: true, version: Sygnalist_VERSION, tracker: rows.map(trackerRowToDto_) };
      }

      case "getTrackerItemDetails": {
        const trackerKey = (data && typeof data.trackerKey === "string" && data.trackerKey.trim()) ? data.trackerKey.trim() : (data && data.url ? data.url : (data && data.company && data.title ? data.company + "||" + data.title : ""));
        if (!trackerKey) return { ok: false, version: Sygnalist_VERSION, message: "getTrackerItemDetails: trackerKey required" };
        const detail = getTrackerItemDetails_(profile.profileId, trackerKey, profile);
        if (!detail) return { ok: false, version: Sygnalist_VERSION, message: "Tracker item not found" };
        return { ok: true, version: Sygnalist_VERSION, detail };
      }

      case "getOrCreateGoodFit": {
        const trackerKey = (data && typeof data.trackerKey === "string" && data.trackerKey.trim()) ? data.trackerKey.trim() : (data && data.url ? data.url : (data && data.company && data.title ? data.company + "||" + data.title : ""));
        if (!trackerKey) return { ok: false, version: Sygnalist_VERSION, message: "getOrCreateGoodFit: trackerKey required" };
        const force = !!(data && data.force);
        const result = getOrCreateGoodFit_(profile.profileId, trackerKey, profile, force);
        if (!result.ok) return { ok: false, version: Sygnalist_VERSION, message: result.error || "GoodFit failed" };
        return { ok: true, version: Sygnalist_VERSION, goodFit: result.goodFit, goodFitUpdatedAt: result.goodFitUpdatedAt };
      }

      case "getDashboard": {
        const dash = getDashboard_(profile.profileId);
        return { ok: true, version: Sygnalist_VERSION, ...dash };
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

      case "removeFromTracker": {
        const trackerKey = (data && typeof data.trackerKey === "string" && data.trackerKey.trim()) ? data.trackerKey.trim() : (data && data.url ? data.url : (data && data.company && data.title ? data.company + "||" + data.title : ""));
        if (!trackerKey) return { ok: false, version: Sygnalist_VERSION, message: "removeFromTracker: trackerKey required" };
        const res = deleteTrackerEntryForProfile_(profile.profileId, trackerKey);
        return { ok: true, version: Sygnalist_VERSION, deleted: res.deleted };
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
 * Dashboard metrics for one profile: inbox/tracker counts and status breakdown.
 * Uses bounded reads via readEngineSheetForProfile_.
 */
function getDashboard_(profileId) {
  const inboxRows = readEngineSheetForProfile_("Engine_Inbox", profileId);
  const trackerRows = readEngineSheetForProfile_("Engine_Tracker", profileId);

  const byStatus = {};
  for (let i = 0; i < trackerRows.length; i++) {
    const o = trackerRows[i];
    const c = (o && o._canon) || {};
    const s = String(o.status ?? c.status ?? "").trim();
    if (s) byStatus[s] = (byStatus[s] || 0) + 1;
  }

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  let inboxAddedLast7 = 0, trackerAddedLast7 = 0;
  for (let i = 0; i < inboxRows.length; i++) {
    const o = inboxRows[i];
    const c = (o && o._canon) || {};
    const a = o.added_at ?? c.addedat;
    if (a) {
      const t = (a instanceof Date) ? a.getTime() : new Date(a).getTime();
      if (!isNaN(t) && (now - t) < sevenDays) inboxAddedLast7++;
    }
  }
  for (let i = 0; i < trackerRows.length; i++) {
    const o = trackerRows[i];
    const c = (o && o._canon) || {};
    const a = o.added_at ?? c.addedat;
    if (a) {
      const t = (a instanceof Date) ? a.getTime() : new Date(a).getTime();
      if (!isNaN(t) && (now - t) < sevenDays) trackerAddedLast7++;
    }
  }

  return {
    inboxCount: inboxRows.length,
    trackerCount: trackerRows.length,
    byStatus,
    inboxAddedLast7,
    trackerAddedLast7
  };
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

/** Light DTO for inbox list (no jobSummary/whyFit). */
function inboxRowToLightDto_(o) {
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
    category: String(o.category || c.category || "")
  };
}

/** Inbox card DTO: includes jobSummary and salary for card display (no whyFit). */
function inboxRowToCardDto_(o) {
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
    salary: String(o.salary || c.salary || "").trim() || "—"
  };
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

/**
 * Find one inbox row by jobKey (url or company||title) and return detail only.
 */
function getInboxDetailByKey_(profileId, jobKey) {
  const rows = readEngineSheetForProfile_("Engine_Inbox", profileId);
  const keyStr = String(jobKey || "").trim();
  for (let i = 0; i < rows.length; i++) {
    const o = rows[i];
    const c = (o && o._canon) || {};
    const url = String(o.url || c.url || "").trim();
    const company = String(o.company || c.company || "").trim();
    const title = String(o.title || c.title || "").trim();
    const match = url && keyStr === url || (company && title && keyStr === company + "||" + title);
    if (match) {
      return {
        title,
        company,
        url,
        jobSummary: String(o.jobSummary || c.jobsummary || "")
        // Inbox: no goodFit/whyFit (Tracker-only)
      };
    }
  }
  return null;
}

/**
 * Get full tracker item for details view; lazy-generates GoodFit if missing.
 * Returns DTO or null.
 */
function getTrackerItemDetails_(profileId, trackerKey, profile) {
  const row = getTrackerRowByKey_(profileId, trackerKey);
  if (!row) return null;
  const result = getOrCreateGoodFit_(profileId, trackerKey, profile, false);
  if (result.ok && result.goodFit != null) {
    row.goodFit = result.goodFit;
    row.goodFitUpdatedAt = result.goodFitUpdatedAt;
  }
  return trackerRowToDto_(row);
}

/**
 * Get or generate GoodFit for one tracker item. If force, regenerate.
 * Returns { ok: true, goodFit, goodFitUpdatedAt } or { ok: false, error }.
 */
function getOrCreateGoodFit_(profileId, trackerKey, profile, force) {
  const row = getTrackerRowByKey_(profileId, trackerKey);
  if (!row) return { ok: false, error: "Tracker item not found" };

  const existing = String(row.goodFit || "").trim();
  if (existing && !force) {
    const gfUpdated = row.goodFitUpdatedAt;
    const goodFitUpdatedAtStr = (gfUpdated instanceof Date)
      ? Utilities.formatDate(gfUpdated, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
      : String(gfUpdated || "");
    return { ok: true, goodFit: existing, goodFitUpdatedAt: goodFitUpdatedAtStr };
  }

  try {
    const job = {
      company: row.company,
      title: row.title,
      url: row.url,
      source: row.source,
      location: row.location,
      description: String(row.jobSummary || "").trim() || ""
    };
    const goodFitString = generateGoodFitForJob_(job, profile);
    updateTrackerRowGoodFit_(profileId, trackerKey, goodFitString);
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    return { ok: true, goodFit: goodFitString, goodFitUpdatedAt: now };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
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

  // stageChangedAt: when status last changed (for "days in current stage"); fallback to added_at
  const sc = (o.stageChangedAt !== undefined) ? o.stageChangedAt : c.stagechangedat;
  const stageChangedAtRaw = sc || a;
  const stageChangedAt =
    (stageChangedAtRaw instanceof Date)
      ? Utilities.formatDate(stageChangedAtRaw, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
      : String(stageChangedAtRaw || addedAt || "");

  const gfUpdated = (o.goodFitUpdatedAt !== undefined) ? o.goodFitUpdatedAt : c.goodfitupdatedat;
  const goodFitUpdatedAtStr =
    (gfUpdated instanceof Date)
      ? Utilities.formatDate(gfUpdated, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
      : String(gfUpdated || "");

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
    salary: String(o.salary || c.salary || "").trim() || "—",
    goodFit: String(o.goodFit || c.goodfit || ""),
    goodFitUpdatedAt: goodFitUpdatedAtStr,
    status: String(o.status || c.status || "Prospect"),
    dateApplied: dateApplied,
    notes: String(o.notes || c.notes || ""),
    added_at: addedAt,
    stageChangedAt: stageChangedAt
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
