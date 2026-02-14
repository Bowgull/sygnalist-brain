/**
 * admin_api.js
 * Thin server wrappers for the admin web app. No business logic; call existing
 * functions and return { ok, message?, ... } or { ok: false, error }.
 * All functions are callable via google.script.run from admin_tab_content.html (embedded Admin tab).
 */

// ---------------------------------------------------------------------------
// Profile and access
// ---------------------------------------------------------------------------

function adminGetProfiles() {
  try {
    var profiles = loadProfiles_();
    var list = profiles.map(function (p) {
      return {
        profileId: p.profileId,
        displayName: p.displayName || p.profileId,
        status: p.status || "active",
        email: p.email || "",
        last_fetch_at: p.last_fetch_at || null,
        webAppUrl: p.webAppUrl || ""
      };
    });
    return { ok: true, profiles: list };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Return admin dashboard globals for metrics strip (jobs need info, profiles, errors).
 * Callable from Master Portal. On error returns safe defaults.
 */
function adminGetDashboardGlobals() {
  try {
    var globals = getAdminDashboardGlobals_();
    return { ok: true, jobsNeedingEnrichment: globals.jobsNeedingEnrichment != null ? globals.jobsNeedingEnrichment : 0, activeProfiles: globals.activeProfiles != null ? globals.activeProfiles : 0, lockedProfiles: globals.lockedProfiles != null ? globals.lockedProfiles : 0, recentErrorsCount: globals.recentErrorsCount != null ? globals.recentErrorsCount : 0 };
  } catch (e) {
    return { ok: true, jobsNeedingEnrichment: 0, activeProfiles: 0, lockedProfiles: 0, recentErrorsCount: 0 };
  }
}

function adminGetProfileForEdit(profileId) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };
    var profile = getProfileByIdOrThrow_(pid);
    return { ok: true, profile: profile };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminUpdateProfile(profileId, patch) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };
    if (!patch || typeof patch !== "object") return { ok: false, error: "patch object is required." };

    var sh = assertSheetExists_("Admin_Profiles");
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return { ok: false, error: "Admin_Profiles has no data." };

    var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0].map(function (h) { return String(h || "").trim(); });
    var idxId = headers.indexOf("profileId");
    if (idxId === -1) return { ok: false, error: "Admin_Profiles missing profileId." };

    var rowIndex = -1;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idxId] || "").trim() === pid) {
        rowIndex = r;
        break;
      }
    }
    if (rowIndex === -1) return { ok: false, error: "Profile not found." };

    var forbidden = ["profileId", "status", "statusReason", "isAdmin"];
    var row = values[rowIndex].slice();
    for (var key in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      if (forbidden.indexOf(key) !== -1) continue;
      var val = patch[key];
      var sheetVal = val;
      if (Array.isArray(val)) {
        if (key === "roleTracks" || key === "roleTracksJSON") {
          sheetVal = typeof JSON !== "undefined" ? JSON.stringify(val) : String(val);
        } else if (key === "signatureStories") {
          sheetVal = typeof JSON !== "undefined" ? JSON.stringify(val) : val.join("\n");
        } else {
          sheetVal = val.map(function (x) { return String(x || "").trim(); }).filter(Boolean).join(", ");
        }
      } else if (val !== null && typeof val === "object" && (key === "laneControls" || key === "laneControlsJSON")) {
        sheetVal = typeof JSON !== "undefined" ? JSON.stringify(val) : String(val);
      } else if (typeof val === "boolean") {
        sheetVal = val ? "TRUE" : "FALSE";
      }
      setByHeader_(headers, row, key, sheetVal);
    }
    var rowNum = rowIndex + 1;
    for (var c = 0; c < row.length; c++) {
      sh.getRange(rowNum, c + 1).setValue(row[c]);
    }

    if (typeof logEvent_ === "function") {
      logEvent_({
        timestamp: Date.now(),
        profileId: pid,
        action: "admin",
        source: "admin_api",
        details: { level: "INFO", message: "Profile updated", meta: { profileId: pid }, version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "" }
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminSoftLock(profileId, reason) {
  try {
    var out = softLockProfile_(profileId, reason || "Locked from admin");
    return out;
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminUnlock(profileId) {
  try {
    var out = unlockProfile_(profileId);
    return out;
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminSetIsAdmin(profileId, isAdmin) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };

    var sh = assertSheetExists_("Admin_Profiles");
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return { ok: false, error: "Admin_Profiles has no data." };

    var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0].map(function (h) { return String(h || "").trim(); });
    var idxId = headers.indexOf("profileId");
    var idxAdmin = headers.indexOf("isAdmin");
    if (idxId === -1 || idxAdmin === -1) return { ok: false, error: "Admin_Profiles missing profileId or isAdmin." };

    var rowIndex = -1;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idxId] || "").trim() === pid) {
        rowIndex = r;
        break;
      }
    }
    if (rowIndex === -1) return { ok: false, error: "Profile not found." };

    var val = (isAdmin === true || isAdmin === "true" || isAdmin === "TRUE") ? "TRUE" : "FALSE";
    sh.getRange(rowIndex + 1, idxAdmin + 1).setValue(val);

    if (typeof logEvent_ === "function") {
      logEvent_({
        timestamp: Date.now(),
        profileId: pid,
        action: "admin",
        source: "admin_api",
        details: { level: "INFO", message: "isAdmin set", meta: { profileId: pid, isAdmin: val }, version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "" }
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Get the profile's web app URL (from sheet or build and save). Use for single "Get link" action.
 */
function adminGetProfileWebAppUrl(profileId) {
  var result = adminRegenerateWebAppUrl(profileId);
  return result;
}

function adminRegenerateWebAppUrl(profileId) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };

    var baseUrl = (typeof CONFIG !== "undefined" && CONFIG.WEB_APP_URL) ? String(CONFIG.WEB_APP_URL).split("?")[0] : "";
    var webAppUrl = baseUrl ? baseUrl + "?profile=" + pid : "";

    var sh = assertSheetExists_("Admin_Profiles");
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return { ok: false, error: "Admin_Profiles has no data." };

    var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0].map(function (h) { return String(h || "").trim(); });
    var idxId = headers.indexOf("profileId");
    var idxUrl = headers.indexOf("webAppUrl");
    if (idxId === -1) return { ok: false, error: "Admin_Profiles missing profileId." };
    if (idxUrl === -1) {
      lastCol++;
      idxUrl = lastCol - 1;
      sh.getRange(1, lastCol).setValue("webAppUrl");
    }

    var rowIndex = -1;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idxId] || "").trim() === pid) {
        rowIndex = r;
        break;
      }
    }
    if (rowIndex === -1) return { ok: false, error: "Profile not found." };

    sh.getRange(rowIndex + 1, idxUrl + 1).setValue(webAppUrl);
    return { ok: true, webAppUrl: webAppUrl };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminCreateProfile(data) {
  try {
    var out = createProfileFromSidebar(data);
    return out;
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Lanes and staging
// ---------------------------------------------------------------------------

function adminGetStaging(profileId) {
  try {
    var rows = getAllStagingRowsForProfile_(profileId);
    return { ok: true, rows: rows };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminSetStagingApproved(profileId, approvedRoleTitles) {
  try {
    var count = setStagingApprovedByRoleTitles_(profileId, approvedRoleTitles || []);
    return { ok: true, count: count };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminApplyApprovedLanes(profileId) {
  try {
    var out = applyApprovedLanesForProfile_(profileId);
    return out;
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetLaneControls(profileId) {
  try {
    return getProfileLaneControls(profileId);
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminSetLaneControls(profileId, laneControls) {
  try {
    var out = setProfileLaneControls(profileId, laneControls);
    return out;
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetLaneBank() {
  try {
    var bank = getLaneRoleBank_();
    return { ok: true, bank: bank };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminAddRoleToLaneBank(role_name, keywordsOrAliases, lane_key) {
  try {
    var out = addRoleToLaneBank_(lane_key || null, role_name, keywordsOrAliases || "");
    return { ok: true, id: out.id, lane_key: out.lane_key, role_name: out.role_name };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminResumeParse(profileId, rawResumeText) {
  try {
    var out = skillProfileBuildAndSave(profileId, rawResumeText);
    return out;
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Fetch and engine data
// ---------------------------------------------------------------------------

function adminFetch(profileId, force) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };

    if (force) {
      var props = PropertiesService.getScriptProperties();
      props.deleteProperty("throttle:" + pid + ":fetch_enriched");
    }

    var result = fetchForProfileWithEnrichment_(pid);
    if (!result || !result.ok) {
      return { ok: false, error: (result && result.message) ? result.message : "Fetch failed" };
    }
    try {
      setProfileLastFetchAt_(pid, new Date().toISOString());
    } catch (e) { /* non-fatal */ }
    return {
      ok: true,
      written: result.written || 0,
      batchId: result.batchId || null,
      message: "Fetched " + (result.written || 0) + " enriched jobs"
    };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetInbox(profileId) {
  try {
    var rows = readEngineSheetForProfile_("Engine_Inbox", profileId);
    var list = rows.map(function (o) {
      var c = (o && o._canon) || {};
      var a = o.added_at !== undefined ? o.added_at : c.addedat;
      var addedAt = (a instanceof Date) ? Utilities.formatDate(a, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : String(a || "");
      return {
        company: String(o.company || c.company || ""),
        title: String(o.title || c.title || ""),
        url: String(o.url || c.url || ""),
        score: Number(o.score || c.score || 0),
        tier: String(o.tier || c.tier || ""),
        laneLabel: String(o.laneLabel || c.lanelabel || ""),
        source: String(o.source || c.source || ""),
        added_at: addedAt
      };
    });
    return { ok: true, rows: list };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminClearInbox(profileId) {
  try {
    var removed = clearEngineInboxForProfile_(profileId);
    return { ok: true, removed: removed };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetTracker(profileId) {
  try {
    var rows = readEngineSheetForProfile_("Engine_Tracker", profileId);
    var list = rows.map(function (o) {
      var c = (o && o._canon) || {};
      var a = o.added_at !== undefined ? o.added_at : c.addedat;
      var addedAt = (a instanceof Date) ? Utilities.formatDate(a, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : String(a || "");
      return {
        company: String(o.company || c.company || ""),
        title: String(o.title || c.title || ""),
        url: String(o.url || c.url || ""),
        status: String(o.status || c.status || ""),
        source: String(o.source || c.source || ""),
        added_at: addedAt
      };
    });
    return { ok: true, rows: list };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminClearTracker(profileId) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };

    var rows = readEngineSheetForProfile_("Engine_Tracker", pid);
    var keys = [];
    for (var i = 0; i < rows.length; i++) {
      var o = rows[i];
      var c = (o && o._canon) || {};
      var url = String(o.url || c.url || "").trim();
      var company = String(o.company || c.company || "").trim();
      var title = String(o.title || c.title || "").trim();
      if (url) keys.push(url);
      else if (company && title) keys.push(company + "||" + title);
    }
    var removed = 0;
    for (var k = 0; k < keys.length; k++) {
      var res = deleteTrackerEntryForProfile_(pid, keys[k]);
      if (res && res.deleted) removed += res.deleted;
    }
    return { ok: true, removed: removed };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Ops and logs
// ---------------------------------------------------------------------------

function adminGetLogs(limit, profileIdFilter, actionFilter) {
  try {
    var lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
    var sh = assertSheetExists_("📓 Logs");
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, rows: [] };

    var numCols = 7;
    var values = sh.getRange(1, 1, lastRow, numCols).getValues();
    var data = values.slice(1);
    var profileCol = 2;
    var actionCol = 3;
    if (profileIdFilter && String(profileIdFilter).trim()) {
      var pid = String(profileIdFilter).trim();
      data = data.filter(function (row) { return String(row[profileCol] || "").trim() === pid; });
    }
    if (actionFilter && String(actionFilter).trim()) {
      var act = String(actionFilter).trim().toLowerCase();
      data = data.filter(function (row) { return String(row[actionCol] || "").toLowerCase() === act; });
    }
    data = data.slice(-lim);
    var rows = data.map(function (row) {
      return {
        time: formatLogTimestamp_(row[1]),
        profileId: row[2],
        action: row[3],
        source: row[4],
        details: row[5],
        level: row[6]
      };
    });
    return { ok: true, rows: rows };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminExportLogs(options) {
  try {
    var now = new Date();
    var tz = Session.getScriptTimeZone();
    var timestamp = Utilities.formatDate(now, tz, "yyyy-MM-dd_HH-mm");
    var newSs = SpreadsheetApp.create("Sygnalist Logs Export — " + timestamp);
    var result = exportLogsToSheet_(newSs.getId());
    var subjectDate = formatExportSubjectDate_(now, tz);
    var subject = "SYGN_LOGS (" + subjectDate + ")";
    MailApp.sendEmail("sygnalist.app@gmail.com", subject, result.sheetUrl);
    var logsCleared = false;
    var engine = SpreadsheetApp.getActiveSpreadsheet();
    var logsSheet = engine.getSheetByName("📓 Logs");
    if (logsSheet) {
      var last = logsSheet.getLastRow();
      if (last >= 2) {
        logsSheet.getRange(2, 1, last, 7).clearContent();
        logsCleared = true;
      }
    }
    return { ok: true, rowCount: result.rowCount, sheetUrl: result.sheetUrl, logsCleared: logsCleared };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function formatExportSubjectDate_(date, tz) {
  var d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  var day = d.getDate();
  var ord = (day % 10 === 1 && day !== 11) ? "st" : (day % 10 === 2 && day !== 12) ? "nd" : (day % 10 === 3 && day !== 13) ? "rd" : "th";
  var dayName = Utilities.formatDate(d, tz, "EEE");
  var month = Utilities.formatDate(d, tz, "MMM");
  var year = Utilities.formatDate(d, tz, "yyyy");
  return dayName + ", " + day + ord + " " + month + ", " + year;
}

function adminFormatLogsSheet() {
  try {
    formatLogsSheet();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminRefreshAnalytics() {
  try {
    refreshAdminAnalytics_();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetAnalytics() {
  try {
    var data = getAdminAnalyticsForUI_();
    return {
      ok: true,
      kpis: data.kpis,
      tierDistribution: data.tierDistribution,
      byStatus: data.byStatus,
      topErrors: data.topErrors || []
    };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminHealthCheck() {
  try {
    var report = runHealthCheckReport_();
    return { ok: true, report: report };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminInitEngineTables() {
  try {
    ensureEngineTables_();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Jobs Intake (Gmail ingest + Jobs_Inbox + Role_Bank)
// ---------------------------------------------------------------------------

function adminIngestFromGmail() {
  try {
    var result = ingestJobsFromGmail_();
    return {
      ok: true,
      threads_found: result.threads_found,
      messages_scanned: result.messages_scanned,
      messages_labeled_ingested: result.messages_labeled_ingested,
      jobs_added: result.jobs_added,
      jobs_skipped_duplicate: result.jobs_skipped_duplicate,
      messages_no_jobs_found: result.messages_no_jobs_found,
      errors: result.errors,
      more_remaining: result.more_remaining
    };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetJobsInbox(filterStatuses) {
  try {
    var rows = readJobsInbox_(filterStatuses || ["NEW", "NEEDS_ENRICHMENT"]);
    var list = rows.map(function (o) {
      var a = o.created_at;
      var createdAt = (a instanceof Date) ? Utilities.formatDate(a, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : String(a || "");
      return {
        job_id: o.job_id,
        _rowIndex: o._rowIndex,
        created_at: createdAt,
        title: String(o.title || ""),
        source: String(o.source || ""),
        url: String(o.url || ""),
        enrichment_status: String(o.enrichment_status || ""),
        missing_fields: String(o.missing_fields || ""),
        role_id: String(o.role_id || ""),
        promoted_at: o.promoted_at,
        notes: String(o.notes || ""),
        company: String(o.company || ""),
        location: String(o.location || ""),
        work_mode: String(o.work_mode || ""),
        job_family: String(o.job_family || ""),
        description_snippet: String(o.description_snippet || ""),
        job_summary: String(o.job_summary || ""),
        why_fit: String(o.why_fit || "")
      };
    });
    return { ok: true, rows: list };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminUpdateJobsInboxRow(jobIdOrRowIndex, patch) {
  try {
    if (!patch || typeof patch !== "object") return { ok: false, error: "patch object is required." };
    var updated = updateJobsInboxRow_(jobIdOrRowIndex, patch);
    return updated ? { ok: true } : { ok: false, error: "Row not found." };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminPromoteOutlierToJob(jobId) {
  try {
    if (!jobId) return { ok: false, error: "jobId is required." };
    var rows = readJobsInbox_(null);
    var job = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].job_id || "") === String(jobId || "")) {
        job = rows[i];
        break;
      }
    }
    if (!job) return { ok: false, error: "Job not found in Jobs_Inbox." };
    if (String(job.enrichment_status || "").trim() !== "OUTLIER") {
      return { ok: false, error: "Only outliers can be promoted to job." };
    }
    var updated = updateJobsInboxRow_(jobId, { enrichment_status: "NEW" });
    return updated ? { ok: true } : { ok: false, error: "Update failed." };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminPromoteFromJobsInbox(profileId, jobId) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };
    if (!jobId) return { ok: false, error: "jobId is required." };

    var rows = readJobsInbox_(null);
    var job = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].job_id || "") === String(jobId || "")) {
        job = rows[i];
        break;
      }
    }
    if (!job) return { ok: false, error: "Job not found in Jobs_Inbox." };

    var missing = computeMissingFields_(job);
    if (missing) return { ok: false, error: "Missing required fields: " + missing };

    var bankJob = {
      url: job.url,
      profile_id: pid,
      created_at: new Date(),
      company: job.company,
      title: job.title,
      source: job.source,
      location: job.location,
      work_mode: job.work_mode,
      job_family: job.job_family,
      description_snippet: job.description_snippet,
      job_summary: job.job_summary,
      why_fit: job.why_fit
    };
    upsertRoleBank_(bankJob, pid);
    updateJobsInboxRow_(jobId, {
      enrichment_status: "PROMOTED",
      promoted_at: new Date(),
      missing_fields: ""
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Add selected Jobs_Inbox job(s) to Global_Job_Bank. All clients can then see them in inbox. jobIds: array of job_id strings.
 */
function adminPromoteToGlobalJobBank(jobIds) {
  try {
    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return { ok: false, error: "jobIds array is required." };
    }
    var rows = readJobsInbox_(null);
    var added = 0;
    for (var i = 0; i < jobIds.length; i++) {
      var jobId = String(jobIds[i] || "").trim();
      if (!jobId) continue;
      var job = null;
      for (var r = 0; r < rows.length; r++) {
        if (String(rows[r].job_id || "") === jobId) {
          job = rows[r];
          break;
        }
      }
      if (!job) continue;
      var globalJob = {
        url: job.url,
        company: job.company,
        title: job.title,
        source: job.source,
        location: job.location,
        work_mode: job.work_mode,
        job_family: job.job_family,
        description_snippet: job.description_snippet,
        job_summary: job.job_summary,
        why_fit: job.why_fit
      };
      if (upsertGlobalJobBank_(globalJob)) added++;
      updateJobsInboxRow_(jobId, { enrichment_status: "IN_GLOBAL" });
    }
    if (typeof logEvent_ === "function") {
      try {
        logEvent_({
          timestamp: Date.now(),
          profileId: "—",
          action: "admin",
          source: "global_job_bank",
          details: { level: "INFO", message: "Added to global job bank", meta: { count: added, jobIds: jobIds.length }, version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "" }
        });
      } catch (logErr) { /* ignore */ }
    }
    return { ok: true, added: added };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminDeleteJobsInboxRow(jobId) {
  try {
    if (!jobId) return { ok: false, error: "jobId is required." };
    var deleted = deleteJobsInboxRow_(jobId);
    if (deleted && typeof logEvent_ === "function") {
      try {
        logEvent_({
          timestamp: Date.now(),
          profileId: "—",
          action: "jobs_inbox_delete",
          source: "admin",
          details: { level: "INFO", message: "Job removed from Jobs Inbox", meta: { jobId: String(jobId) }, version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "" }
        });
      } catch (logErr) { /* logs must not fail */ }
    }
    return deleted ? { ok: true } : { ok: false, error: "Job not found in Jobs_Inbox." };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Batch delete Jobs_Inbox rows by job_id. Returns { ok: true, deleted: number } or { ok: false, error: string }.
 */
function adminDeleteJobsInboxRows(jobIds) {
  try {
    if (!jobIds || !Array.isArray(jobIds)) return { ok: false, error: "jobIds array is required." };
    var deleted = 0;
    for (var i = 0; i < jobIds.length; i++) {
      var jid = jobIds[i];
      if (!jid) continue;
      if (deleteJobsInboxRow_(jid)) {
        deleted++;
        if (typeof logEvent_ === "function") {
          try {
            logEvent_({
              timestamp: Date.now(),
              profileId: "—",
              action: "jobs_inbox_delete",
              source: "admin",
              details: { level: "INFO", message: "Job removed from Jobs Inbox", meta: { jobId: String(jid) }, version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "" }
            });
          } catch (logErr) { /* logs must not fail */ }
        }
      }
    }
    return { ok: true, deleted: deleted };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}
