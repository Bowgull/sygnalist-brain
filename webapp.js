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

/** Replaces ?> with ?\u003e so scriptlet output never closes the tag. Leaves runtime value unchanged. */
function sanitizeForScriptlet_(s) {
  return String(s || "").replace(/\?>/g, "?\\u003e");
}

/** Escapes a string so it can be embedded inside a scriptlet output without breaking the parser or closing a script tag. */
function escapeJsonForScriptTag_(jsonStr) {
  return String(jsonStr || "")
    .replace(/<\/script>/gi, "\\u003c/script>")
    .replace(/\?>/g, "?\\u003e")
    .replace(/<\//g, "<\\/");
}

/** Escapes a string for safe inclusion in HTML (prevents broken markup and XSS). */
function escapeHtml_(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapes script content for safe embedding inside a <script> tag (avoids closing tag and scriptlet).
 *  All content injected into client_portal from admin_tab_script must pass through this so scriptlet
 *  output never closes the <script> or contains ?>. */
function escapeForInlineScript_(content) {
  if (content == null || content === "") return "";
  var s = String(content);
  return s
    .replace(/<\/script>/gi, "<\\/script>")
    .replace(/<\/script/gi, "<\\/script")
    .replace(/\?>/g, "?\\u003e")
    .replace(/<!--/g, "<\\!--");
}

function doGet(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const profileId = String(p.profile || p.profileId || "").trim();
    const view = String(p.view || "").trim().toLowerCase();
    const mode = String(p.mode || "").trim().toLowerCase();

    // Interview draft: generate and send Email #2 when user clicks link from Email #1
    if (mode === "geninterviewdraft") {
      const trackerKey = String(p.trackerKey || "").trim();
      if (!profileId || !trackerKey) {
        return ContentService.createTextOutput("Missing profileId or trackerKey.").setMimeType(ContentService.MimeType.TEXT);
      }
      try {
        generateAndSendInterviewDraftEmail_(profileId, trackerKey);
        return ContentService.createTextOutput("Draft generated and sent.").setMimeType(ContentService.MimeType.TEXT);
      } catch (err) {
        return ContentService.createTextOutput("Draft failed: " + (err && err.message ? err.message : String(err))).setMimeType(ContentService.MimeType.TEXT);
      }
    }

    // Serve admin script as a separate asset (avoids HtmlService "Malformed HTML" from large inline script)
    const asset = String(p.asset || "").trim().toLowerCase();
    if (asset === "admin") {
      try {
        const adminScriptRaw = HtmlService.createHtmlOutputFromFile("admin_tab_script").getContent();
        return ContentService.createTextOutput(adminScriptRaw).setMimeType(ContentService.MimeType.JAVASCRIPT);
      } catch (assetErr) {
        // Return JS (not HTML) so the script tag does not trigger onerror; client can show message on sygnalist-admin-ready
        var fallbackJs = "(function(){window.__ADMIN_SCRIPT_SERVER_ERROR=true;if(typeof document.dispatchEvent==='function'){var e=document.createEvent('Event');e.initEvent('sygnalist-admin-ready',true,true);document.dispatchEvent(e);}})();";
        return ContentService.createTextOutput(fallbackJs).setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
    }

    // No profile → show message only (admin is via profile isAdmin true + Admin tab, no redirect)
    if (!profileId) {
      return HtmlService.createHtmlOutput(
        "<!DOCTYPE html><html><body><p style=\"font-family:sans-serif;padding:2rem\">No profile. Use ?profile=... to open the app.</p></body></html>"
      ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    const boot = getProfileBootstrap_(profileId);
    const baseUrl = (typeof CONFIG !== "undefined" && CONFIG.WEB_APP_URL)
      ? String(CONFIG.WEB_APP_URL).split("?")[0]
      : "";
    const viewAs = p.viewAs === "1" || p.actingAs === "1" || p.viewAs === true;
    const adminParam = String(p.admin || "").trim();
    let showAdminUI = boot.profile.isAdmin;
    let adminProfileId = "";
    if (viewAs && adminParam) {
      try {
        const adminProfile = getProfileByIdOrThrow_(adminParam);
        if (adminProfile.isAdmin) {
          showAdminUI = true;
          adminProfileId = adminProfile.profileId;
        }
      } catch (e) { /* invalid or non-admin */ }
    }
    // Sanitize for scriptlet output only (prevents ?> from closing scriptlet tag)
    const sanitizedBaseUrl = sanitizeForScriptlet_(baseUrl);
    const sanitizedProfileId = sanitizeForScriptlet_(adminProfileId || profileId);
    const sanitizedAdminProfileId = sanitizeForScriptlet_(adminProfileId || "");
    const tpl = HtmlService.createTemplateFromFile("client_portal");
    var bootJson = JSON.stringify(boot);
    tpl.BOOTSTRAP_JSON = bootJson.replace(/\?>/g, "?\\u003e");
    tpl.VIEW_AS_JSON = JSON.stringify(!!viewAs);
    tpl.ADMIN_URL_JSON = JSON.stringify(showAdminUI ? sanitizedBaseUrl : "");
    tpl.SHOW_ADMIN_UI_JSON = JSON.stringify(!!showAdminUI);
    tpl.ADMIN_PROFILE_ID_JSON = JSON.stringify(sanitizedAdminProfileId);
    // When showAdminUI is true, inline the admin script as Base64 so the template never outputs raw script (avoids Malformed HTML and escaping edge cases).
    var adminScriptSrc = "";
    var adminScriptB64JSON = "";
    if (showAdminUI) {
      const adminTpl = HtmlService.createTemplateFromFile("admin_tab_content");
      adminTpl.BASE_URL_JSON = JSON.stringify(sanitizedBaseUrl);
      adminTpl.CURRENT_PROFILE_ID_JSON = JSON.stringify(sanitizedProfileId);
      tpl.ADMIN_TAB_HTML = adminTpl.evaluate().getContent();
      var adminBoot = { BASE_URL: sanitizedBaseUrl, CURRENT_PROFILE_ID: sanitizedProfileId };
      var bootJsonStr = JSON.stringify(adminBoot);
      var escapedJson = escapeJsonForScriptTag_(bootJsonStr);
      tpl.ADMIN_BOOT_SCRIPT_TAG = "<script type=\"application/json\" id=\"ADMIN_BOOT_JSON\">" + escapedJson + "</script>";
      try {
        var adminScriptRaw = HtmlService.createHtmlOutputFromFile("admin_tab_script").getContent();
        var adminScriptB64 = Utilities.base64Encode(Utilities.newBlob(adminScriptRaw).getBytes());
        adminScriptB64JSON = JSON.stringify(adminScriptB64);
        adminScriptSrc = "inline";
      } catch (inlineErr) {
        // No asset fallback: inlining is the only path (asset=admin fails in iframe due to auth). Log and leave script empty.
        try { Logger.log("Admin script inlining failed: " + (inlineErr && inlineErr.message ? inlineErr.message : String(inlineErr))); } catch (e) {}
        adminScriptSrc = "";
      }
    } else {
      tpl.ADMIN_TAB_HTML = "";
      tpl.ADMIN_BOOT_SCRIPT_TAG = "";
    }
    tpl.ADMIN_SCRIPT_SRC = adminScriptSrc;
    tpl.ADMIN_SCRIPT_B64_JSON = adminScriptB64JSON;

    return tpl.evaluate()
      .setTitle("Sygnalist — Client Portal")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    var msg = err && err.message ? err.message : String(err);
    var safeMsg = escapeHtml_(msg);
    var body = "<p>Portal load failed. Try again later.</p>";
    if (safeMsg) {
      body += "<pre style=\"font-size:0.75rem;color:#888;margin-top:1rem;overflow:auto;\">" + safeMsg + "</pre>";
    }
    return HtmlService
      .createHtmlOutput("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><title>Error</title></head><body style=\"font-family:sans-serif;padding:2rem;\">" + body + "</body></html>")
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

    const op = String(req && req.op || "").trim();
    const data = (req && req.data) || {};
    const actingAdminId = (req && req.actingAdminId) ? String(req.actingAdminId).trim() : "";
    const adminProfile = actingAdminId ? (function() {
      try {
        const p = getProfileByIdOrThrow_(actingAdminId);
        return p.isAdmin ? p : null;
      } catch (e) { return null; }
    })() : null;
    function adminCheck() {
      if (adminProfile) return true;
      return !!profile.isAdmin;
    }

    if (!op) throw new Error("portal_api_: missing op");

    switch (op) {
      case "ping":
        return { ok: true, version: Sygnalist_VERSION, message: "pong" };

      case "getProfileList": {
        if (!adminCheck()) {
          return { ok: false, version: Sygnalist_VERSION, reason: "Forbidden" };
        }
        const list = getProfileListForAdmin_();
        return { ok: true, version: Sygnalist_VERSION, profiles: list };
      }

      case "logAdminSwitch": {
        if (!adminCheck()) return { ok: false, version: Sygnalist_VERSION };
        const targetId = (data && data.targetProfileId) ? String(data.targetProfileId).trim() : "";
        const fromId = adminProfile ? adminProfile.profileId : profile.profileId;
        if (targetId) {
          logEvent_({
            timestamp: Date.now(),
            profileId: fromId,
            action: "admin",
            source: "portal_switcher",
            details: { level: "INFO", message: "Admin profile switch", meta: { from: fromId, to: targetId }, version: Sygnalist_VERSION }
          });
        }
        return { ok: true, version: Sygnalist_VERSION };
      }

      case "fetch": {
        if (profile.status !== "active") {
          return {
            ok: false,
            version: Sygnalist_VERSION,
            message: "Scan is disabled. Your profile is inactive."
          };
        }
        // Fetch new jobs for this profile (with enrichment)
        const result = fetchForProfileWithEnrichment_(profile.profileId);
        if (!result || !result.ok) {
          return { 
            ok: false, 
            version: Sygnalist_VERSION,
            message: result && result.message ? result.message : "Fetch failed"
          };
        }
        try {
          setProfileLastFetchAt_(profile.profileId, new Date().toISOString());
        } catch (e) {
          if (typeof logEvent_ === "function") {
            logEvent_({
              timestamp: Date.now(),
              profileId: profile.profileId,
              action: "error",
              source: "webapp",
              details: {
                level: "WARN",
                message: "Failed to update last scan",
                meta: { error: (e && e.message) ? e.message : String(e) },
                version: Sygnalist_VERSION
              }
            });
          }
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
        const rows = getMergedInboxCachedRaw_(profile.profileId);
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
        const pid = profile.profileId;
        const cacheKey = "tracker:" + pid;
        try {
          const cache = CacheService.getScriptCache();
          const cached = cache.get(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.tracker && parsed.dashboard) return parsed;
          }
        } catch (e) { /* ignore cache errors */ }
        try {
          const rows = readEngineSheetForProfile_("Engine_Tracker", pid);
          const tracker = rows.map(trackerRowToDto_);
          const dashboard = getDashboardLight_(pid, rows);
          const response = { ok: true, version: Sygnalist_VERSION, tracker: tracker, dashboard: dashboard };
          try {
            CacheService.getScriptCache().put(cacheKey, JSON.stringify(response), 45);
          } catch (e) { /* cache put can fail if payload > 100KB */ }
          return response;
        } catch (e) {
          try { CacheService.getScriptCache().remove(cacheKey); } catch (e2) { /* ignore */ }
          return {
            ok: false,
            version: Sygnalist_VERSION,
            message: (e && e.message) ? e.message : "Tracker load failed"
          };
        }
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
        if (profile.isAdmin) {
          try {
            const globals = getAdminDashboardGlobals_();
            return {
              ok: true,
              version: Sygnalist_VERSION,
              ...dash,
              isAdminResponse: true,
              inboxCountAll: globals.inboxCountAll,
              trackerCountAll: globals.trackerCountAll,
              byStatusAll: globals.byStatusAll,
              addedLast7All: globals.addedLast7All,
              jobsNeedingEnrichment: globals.jobsNeedingEnrichment,
              activeProfiles: globals.activeProfiles,
              lockedProfiles: globals.lockedProfiles,
              recentErrorsCount: globals.recentErrorsCount
            };
          } catch (e) {
            return { ok: true, version: Sygnalist_VERSION, ...dash, isAdminResponse: true, jobsNeedingEnrichment: 0, activeProfiles: 0, lockedProfiles: 0, recentErrorsCount: 0 };
          }
        }
        return { ok: true, version: Sygnalist_VERSION, ...dash };
      }

      case "promote": {
        const outPromote = promoteEnrichedJobToTracker_(profile.profileId, data);
        if (outPromote && outPromote.ok) invalidateTrackerCache_(profile.profileId);
        return outPromote;
      }

      case "manualAdd": {
        const outManual = manualAddToTracker_(profile.profileId, data);
        if (outManual && outManual.ok) invalidateTrackerCache_(profile.profileId);
        return outManual;
      }

      case "updateTracker": {
        return withProfileLock_(profile.profileId, "tracker_update", () => {
          assertNotThrottled_(profile.profileId, "tracker_update", 800);
          const res = updateTrackerEntryForProfile_(profile.profileId, data);
          invalidateTrackerCache_(profile.profileId);
          return { ok: true, version: Sygnalist_VERSION, updated: res.updated };
        });
      }

      case "removeFromTracker": {
        const trackerKey = (data && typeof data.trackerKey === "string" && data.trackerKey.trim()) ? data.trackerKey.trim() : (data && data.url ? data.url : (data && data.company && data.title ? data.company + "||" + data.title : ""));
        if (!trackerKey) return { ok: false, version: Sygnalist_VERSION, message: "removeFromTracker: trackerKey required" };
        const res = deleteTrackerEntryForProfile_(profile.profileId, trackerKey);
        if (res.deleted) {
          try {
            logEvent_({
              timestamp: Date.now(),
              profileId: profile.profileId,
              action: "remove_from_tracker",
              source: "portal",
              details: { level: "INFO", message: "Removed from tracker", meta: { trackerKey }, version: Sygnalist_VERSION }
            });
          } catch (logErr) { /* logs must not fail user action */ }
        }
        invalidateTrackerCache_(profile.profileId);
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

/** Invalidate cached getTracker response for a profile so next load is fresh. */
function invalidateTrackerCache_(profileId) {
  try {
    CacheService.getScriptCache().remove("tracker:" + (profileId || ""));
  } catch (e) { /* ignore */ }
}

/**
 * Return merged inbox rows for a profile, from cache if valid (TTL 45s). Used by getInbox and getDashboardLight_.
 */
function getMergedInboxCachedRaw_(profileId) {
  const cacheKey = "inbox-raw:" + (profileId || "");
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* ignore */ }
  const rows = getMergedInboxForProfile_(profileId);
  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(rows), 45);
  } catch (e) { /* cache put can fail if payload too large */ }
  return rows;
}

/**
 * Merge global pool (Global_Job_Bank) + curated (Role_Bank) + Engine_Inbox for a profile. Dedupe by normalized URL; global first, then profile Role_Bank, then engine.
 */
function getMergedInboxForProfile_(profileId) {
  const seen = {};
  const out = [];

  const globalRows = typeof readGlobalJobBank_ === "function" ? readGlobalJobBank_() : [];
  for (let g = 0; g < globalRows.length; g++) {
    const c = globalRows[g];
    const url = String(c.url || "").trim();
    const norm = normalizeUrlForJobsInbox_(url);
    if (!norm) continue;
    if (seen[norm]) continue;
    seen[norm] = true;
    out.push({
      company: String(c.company || ""),
      title: String(c.title || ""),
      url: url,
      source: String(c.source || ""),
      location: String(c.location || ""),
      score: 0,
      tier: "",
      roleType: String(c.work_mode || ""),
      laneLabel: String(c.job_family || ""),
      category: "",
      jobSummary: String(c.description_snippet || c.job_summary || ""),
      salary: "—",
      salary_source: "missing",
      added_at: c.created_at
    });
  }

  const curated = getCuratedJobsForProfile_(profileId);
  for (let i = 0; i < curated.length; i++) {
    const c = curated[i];
    const url = String(c.url || "").trim();
    const norm = normalizeUrlForJobsInbox_(url);
    if (!norm) continue;
    if (seen[norm]) continue;
    seen[norm] = true;
    out.push({
      company: String(c.company || ""),
      title: String(c.title || ""),
      url: url,
      source: String(c.source || ""),
      location: String(c.location || ""),
      score: 0,
      tier: "",
      roleType: String(c.work_mode || ""),
      laneLabel: String(c.job_family || ""),
      category: "",
      jobSummary: String(c.description_snippet || c.job_summary || ""),
      salary: "—",
      salary_source: "missing",
      added_at: c.created_at
    });
  }

  const engineRows = readEngineSheetForProfile_("Engine_Inbox", profileId);
  for (let j = 0; j < engineRows.length; j++) {
    const e = engineRows[j];
    const c = (e && e._canon) || {};
    const url = String(e.url || c.url || "").trim();
    const norm = normalizeUrlForJobsInbox_(url);
    if (!norm) {
      const fallback = buildFallbackKey_(e.company || c.company, e.title || c.title);
      if (fallback && seen[fallback]) continue;
      if (fallback) seen[fallback] = true;
    } else {
      if (seen[norm]) continue;
      seen[norm] = true;
    }
    out.push(e);
  }

  return out;
}

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
  const inboxRows = getMergedInboxForProfile_(profileId);
  const trackerRows = readEngineSheetForProfile_("Engine_Tracker", profileId);
  return buildDashboardFromRows_(inboxRows, trackerRows);
}

/**
 * Build dashboard object from pre-fetched inbox and tracker rows (avoids duplicate sheet reads).
 * Used by getTracker to return dashboard without re-reading Engine_Tracker.
 */
function buildDashboardFromRows_(inboxRows, trackerRows) {
  const byStatus = {};
  for (let i = 0; i < (trackerRows || []).length; i++) {
    const o = trackerRows[i];
    const c = (o && o._canon) || {};
    const s = String(o.status ?? c.status ?? "").trim();
    if (s) byStatus[s] = (byStatus[s] || 0) + 1;
  }

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  let inboxAddedLast7 = 0, trackerAddedLast7 = 0;
  for (let i = 0; i < (inboxRows || []).length; i++) {
    const o = inboxRows[i];
    const c = (o && o._canon) || {};
    const a = o.added_at ?? c.addedat;
    if (a) {
      const t = (a instanceof Date) ? a.getTime() : new Date(a).getTime();
      if (!isNaN(t) && (now - t) < sevenDays) inboxAddedLast7++;
    }
  }
  for (let i = 0; i < (trackerRows || []).length; i++) {
    const o = trackerRows[i];
    const c = (o && o._canon) || {};
    const a = o.added_at ?? c.addedat;
    if (a) {
      const t = (a instanceof Date) ? a.getTime() : new Date(a).getTime();
      if (!isNaN(t) && (now - t) < sevenDays) trackerAddedLast7++;
    }
  }

  return {
    inboxCount: (inboxRows || []).length,
    trackerCount: (trackerRows || []).length,
    byStatus,
    inboxAddedLast7,
    trackerAddedLast7
  };
}

/**
 * Light dashboard for getTracker: uses pre-fetched tracker rows and one merged inbox read.
 * No duplicate Engine_Tracker read; admin globals are not included (client calls getDashboard for those).
 */
function getDashboardLight_(profileId, trackerRows) {
  const inboxRows = getMergedInboxCachedRaw_(profileId);
  return buildDashboardFromRows_(inboxRows, trackerRows || []);
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

/** Inbox card DTO: includes jobSummary and salary for card display (no whyFit). added_at for recency sort (ms or null). */
function inboxRowToCardDto_(o) {
  const c = (o && o._canon) || {};
  const a = o.added_at ?? c.addedat;
  const addedAt =
    a == null
      ? null
      : (a instanceof Date ? a.getTime() : typeof a === "number" ? a : new Date(a).getTime());
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
    salary: String(o.salary || c.salary || "").trim() || "—",
    salary_source: String(o.salary_source || c.salary_source || "").trim() || "missing",
    added_at: isNaN(addedAt) ? null : addedAt
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
  const rows = getMergedInboxForProfile_(profileId);
  const keyStr = String(jobKey || "").trim();
  for (let i = 0; i < rows.length; i++) {
    const o = rows[i];
    const c = (o && o._canon) || {};
    const url = String(o.url || c.url || "").trim();
    const company = String(o.company || c.company || "").trim();
    const title = String(o.title || c.title || "").trim();
    const normKey = normalizeUrlForJobsInbox_(keyStr);
    const normUrl = normalizeUrlForJobsInbox_(url);
    const match =
      (url && (keyStr === url || (normKey && normUrl && normKey === normUrl))) ||
      (company && title && keyStr === company + "||" + title);
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
