/**
 * admin_api.js
 * Thin server wrappers for the admin web app. No business logic; call existing
 * functions and return { ok, message?, ... } or { ok: false, error }.
 * All functions are callable via google.script.run from admin_tab_content.html (embedded Admin tab).
 */

function logAdmin_(phase, message, meta) {
  if (typeof logEvent_ !== "function") return;
  try {
    logEvent_({
      timestamp: Date.now(),
      profileId: (meta && meta.profileId) || "—",
      action: "admin",
      source: "admin_api",
      details: {
        level: phase === "error" ? "ERROR" : "INFO",
        message: message,
        meta: meta || {}
      }
    });
  } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Profile and access
// ---------------------------------------------------------------------------

function adminGetProfiles() {
  logAdmin_("start", "Get profiles started", {});
  try {
    var profiles = loadProfiles_();
    var list = profiles.map(function (p) {
      return {
        profileId: p.profileId,
        displayName: p.displayName || p.profileId,
        status: p.status || "active",
        email: p.email || "",
        last_fetch_at: p.last_fetch_at || null,
        webAppUrl: p.webAppUrl || "",
        acceptRemote: !!p.acceptRemote,
        acceptHybrid: !!p.acceptHybrid,
        acceptOnsite: !!p.acceptOnsite
      };
    });
    logAdmin_("ok", "Get profiles completed", { count: (list && list.length) || 0 });
    return { ok: true, profiles: list };
  } catch (e) {
    logAdmin_("error", "Get profiles failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Return admin dashboard globals for metrics strip (jobs need info, profiles, errors).
 * Callable from Master Portal. On error returns safe defaults.
 */
function adminGetDashboardGlobals() {
  logAdmin_("start", "Get dashboard globals started", {});
  try {
    var globals = getAdminDashboardGlobals_();
    logAdmin_("ok", "Get dashboard globals completed", {});
    return { ok: true, jobsNeedingEnrichment: globals.jobsNeedingEnrichment != null ? globals.jobsNeedingEnrichment : 0, activeProfiles: globals.activeProfiles != null ? globals.activeProfiles : 0, lockedProfiles: globals.lockedProfiles != null ? globals.lockedProfiles : 0, recentErrorsCount: globals.recentErrorsCount != null ? globals.recentErrorsCount : 0 };
  } catch (e) {
    logAdmin_("error", "Get dashboard globals failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: true, jobsNeedingEnrichment: 0, activeProfiles: 0, lockedProfiles: 0, recentErrorsCount: 0 };
  }
}

function adminGetProfileForEdit(profileId) {
  logAdmin_("start", "Get profile for edit started", { profileId: profileId });
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };
    var profile = getProfileByIdOrThrow_(pid);
    logAdmin_("ok", "Get profile for edit completed", { profileId: pid });
    return { ok: true, profile: profile };
  } catch (e) {
    logAdmin_("error", "Get profile for edit failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminUpdateProfile(profileId, patch) {
  logAdmin_("start", "Profile update started", { profileId: profileId });
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
    var keysToEnsure = [];
    var aliasMap = typeof ADMIN_PROFILE_HEADER_ALIASES_ !== "undefined" ? ADMIN_PROFILE_HEADER_ALIASES_ : null;
    for (var key in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      if (forbidden.indexOf(key) !== -1) continue;
      if (typeof getHeaderIndex_ === "function" && getHeaderIndex_(headers, key) === -1 && aliasMap && Object.prototype.hasOwnProperty.call(aliasMap, key)) keysToEnsure.push(key);
    }
    for (var k = 0; k < keysToEnsure.length; k++) {
      var col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue(keysToEnsure[k]);
      for (var r = 2; r <= lastRow; r++) sh.getRange(r, col).setValue("");
    }
    if (keysToEnsure.length > 0) {
      lastCol = sh.getLastColumn();
      values = sh.getRange(1, 1, lastRow, lastCol).getValues();
      headers = values[0].map(function (h) { return String(h || "").trim(); });
      row = values[rowIndex].slice();
    }
    for (key in patch) {
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
      if (typeof setByHeaderWithAliases_ === "function") setByHeaderWithAliases_(headers, row, key, sheetVal);
      else setByHeader_(headers, row, key, sheetVal);
    }
    var rowNum = rowIndex + 1;
    sh.getRange(rowNum, 1, 1, row.length).setValues([row]);

    if (typeof logEvent_ === "function") {
      logEvent_({
        timestamp: Date.now(),
        profileId: pid,
        action: "admin",
        source: "admin_api",
        details: { level: "INFO", message: "Profile updated", meta: { profileId: pid }, version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "" }
      });
    }
    logAdmin_("ok", "Profile update completed", { profileId: pid });
    return { ok: true };
  } catch (e) {
    logAdmin_("error", "Profile update failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminSoftLock(profileId, reason) {
  logAdmin_("start", "Soft lock started", { profileId: profileId });
  try {
    var out = softLockProfile_(profileId, reason || "Locked from admin");
    logAdmin_("ok", "Soft lock completed", { profileId: profileId });
    return out;
  } catch (e) {
    logAdmin_("error", "Soft lock failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminUnlock(profileId) {
  logAdmin_("start", "Unlock started", { profileId: profileId });
  try {
    var out = unlockProfile_(profileId);
    logAdmin_("ok", "Unlock completed", { profileId: profileId });
    return out;
  } catch (e) {
    logAdmin_("error", "Unlock failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminSetIsAdmin(profileId, isAdmin) {
  logAdmin_("start", "Set isAdmin started", { profileId: profileId });
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
    logAdmin_("ok", "Set isAdmin completed", { profileId: pid });
    return { ok: true };
  } catch (e) {
    logAdmin_("error", "Set isAdmin failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Get the profile's web app URL (from sheet or build and save). Use for single "Get link" action.
 */
function adminGetProfileWebAppUrl(profileId) {
  logAdmin_("start", "Get profile web app URL started", { profileId: profileId });
  try {
    var result = adminRegenerateWebAppUrl(profileId);
    if (result && result.ok) logAdmin_("ok", "Get profile web app URL completed", { profileId: profileId });
    else logAdmin_("error", "Get profile web app URL failed", { error: (result && result.error) ? result.error : "Unknown" });
    return result;
  } catch (e) {
    logAdmin_("error", "Get profile web app URL failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminRegenerateWebAppUrl(profileId) {
  logAdmin_("start", "Regenerate web app URL started", { profileId: profileId });
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
    logAdmin_("ok", "Regenerate web app URL completed", { profileId: pid });
    return { ok: true, webAppUrl: webAppUrl };
  } catch (e) {
    logAdmin_("error", "Regenerate web app URL failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminCreateProfile(data) {
  logAdmin_("start", "Create profile started", {});
  try {
    var out = createProfileFromSidebar(data);
    logAdmin_("ok", "Create profile completed", { profileId: (out && out.profileId) ? out.profileId : "" });
    return out;
  } catch (e) {
    logAdmin_("error", "Create profile failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Lanes and staging
// ---------------------------------------------------------------------------

function adminGetStaging(profileId) {
  logAdmin_("start", "Get staging started", { profileId: profileId });
  try {
    var rows = getAllStagingRowsForProfile_(profileId);
    logAdmin_("ok", "Get staging completed", { profileId: profileId, count: (rows && rows.length) || 0 });
    return { ok: true, rows: rows };
  } catch (e) {
    logAdmin_("error", "Get staging failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetStagingIncludingApplied(profileId) {
  logAdmin_("start", "Get staging including applied started", { profileId: profileId });
  try {
    var rows = typeof getStagingRowsForProfileDeduped_ === "function"
      ? getStagingRowsForProfileDeduped_(profileId)
      : (typeof getAllStagingRowsForProfileIncludingApplied_ === "function"
          ? getAllStagingRowsForProfileIncludingApplied_(profileId)
          : getAllStagingRowsForProfile_(profileId));
    logAdmin_("ok", "Get staging including applied completed", { profileId: profileId, count: (rows && rows.length) || 0 });
    return { ok: true, rows: rows };
  } catch (e) {
    logAdmin_("error", "Get staging including applied failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminSetStagingApproved(profileId, approvedRoleTitles) {
  logAdmin_("start", "Set staging approved started", { profileId: profileId });
  try {
    var count = setStagingApprovedByRoleTitles_(profileId, approvedRoleTitles || []);
    logAdmin_("ok", "Set staging approved completed", { profileId: profileId, count: count });
    return { ok: true, count: count };
  } catch (e) {
    logAdmin_("error", "Set staging approved failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminApplyApprovedLanes(profileId) {
  logAdmin_("start", "Apply approved lanes started", { profileId: profileId });
  try {
    var out = applyApprovedLanesForProfile_(profileId);
    logAdmin_("ok", "Apply approved lanes completed", { profileId: profileId });
    return out;
  } catch (e) {
    logAdmin_("error", "Apply approved lanes failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetLaneControls(profileId) {
  logAdmin_("start", "Get lane controls started", { profileId: profileId });
  try {
    var out = getProfileLaneControls(profileId);
    logAdmin_("ok", "Get lane controls completed", { profileId: profileId });
    return out;
  } catch (e) {
    logAdmin_("error", "Get lane controls failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminSetLaneControls(profileId, laneControls) {
  logAdmin_("start", "Set lane controls started", { profileId: profileId });
  try {
    var out = setProfileLaneControls(profileId, laneControls);
    logAdmin_("ok", "Set lane controls completed", { profileId: profileId });
    return out;
  } catch (e) {
    logAdmin_("error", "Set lane controls failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetLaneBank() {
  logAdmin_("start", "Get lane bank started", {});
  try {
    var bank = getLaneRoleBank_();
    logAdmin_("ok", "Get lane bank completed", {});
    return { ok: true, bank: bank };
  } catch (e) {
    logAdmin_("error", "Get lane bank failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminAddRoleToLaneBank(role_name, keywordsOrAliases, lane_key) {
  logAdmin_("start", "Add role to lane bank started", { lane_key: lane_key });
  try {
    var out = (typeof upsertLaneRoleBankEntry_ === "function")
      ? upsertLaneRoleBankEntry_({ role_name: role_name, lane_key: lane_key || undefined, aliases: keywordsOrAliases || "", source: "admin", statusDefault: "active" })
      : addRoleToLaneBank_(lane_key || null, role_name, keywordsOrAliases || "");
    logAdmin_("ok", "Add role to lane bank completed", { lane_key: out.lane_key, role_name: out.role_name });
    return { ok: true, id: out.id, lane_key: out.lane_key, role_name: out.role_name };
  } catch (e) {
    logAdmin_("error", "Add role to lane bank failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/** Returns lane bank for Jobs Intake enrich UI: active roles and unique lane_keys. opts: { activeOnly: true }. */
function adminGetLaneBankForEnrich(opts) {
  logAdmin_("start", "Get lane bank for enrich", {});
  try {
    var bank = getLaneRoleBank_(opts && opts.activeOnly === true ? { activeOnly: true } : {});
    var lane_keys = [];
    var seen = {};
    for (var i = 0; i < bank.length; i++) {
      var k = String(bank[i].lane_key || "").trim();
      if (k && !seen[k]) {
        seen[k] = true;
        lane_keys.push(k);
      }
    }
    logAdmin_("ok", "Get lane bank for enrich completed", {});
    return { ok: true, lane_keys: lane_keys, roles: bank };
  } catch (e) {
    logAdmin_("error", "Get lane bank for enrich failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/** Create a pending role from a job (email intake); attach role_bank_id to job if Jobs_Inbox has column. */
function adminCreatePendingRoleFromJob(jobId, role_name, lane_key) {
  logAdmin_("start", "Create pending role from job", { jobId: jobId });
  try {
    if (typeof upsertLaneRoleBankEntry_ !== "function") {
      return { ok: false, error: "Lane bank upsert not available." };
    }
    var out = upsertLaneRoleBankEntry_({
      role_name: role_name || "",
      lane_key: lane_key || undefined,
      source: "email_intake",
      statusDefault: "pending"
    });
    if (typeof setJobRoleBankId_ === "function" && jobId) {
      setJobRoleBankId_(jobId, out.id);
    }
    logAdmin_("ok", "Create pending role from job completed", { id: out.id });
    return { ok: true, id: out.id, lane_key: out.lane_key, role_name: out.role_name };
  } catch (e) {
    logAdmin_("error", "Create pending role from job failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminResumeParse(profileId, rawResumeText) {
  logAdmin_("start", "Resume parse started", { profileId: profileId });
  try {
    var out = skillProfileBuildAndSave(profileId, rawResumeText);
    logAdmin_("ok", "Resume parse completed", { profileId: profileId });
    return out;
  } catch (e) {
    logAdmin_("error", "Resume parse failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/** Parse-only: no write to Admin_Profiles. Client shows review then calls adminResumeApplyApproved. */
function adminResumeParseOnly(profileId, rawResumeText) {
  logAdmin_("start", "Resume parse only", { profileId: profileId });
  try {
    var out = skillProfileParseOnly(profileId, rawResumeText);
    if (out && out.ok) logAdmin_("ok", "Resume parse only completed", { profileId: profileId, stagingRows: (out.stagingRows || 0) });
    return out;
  } catch (e) {
    logAdmin_("error", "Resume parse only failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetProfileForReview(profileId) {
  try {
    var out = skillProfileGetProfileForReview(profileId);
    if (out && out.ok) logAdmin_("ok", "Get profile for review", { profileId: profileId });
    return out;
  } catch (e) {
    logAdmin_("error", "Get profile for review failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminResumeApplyApproved(profileId, parsed, options) {
  logAdmin_("start", "Resume apply approved", { profileId: profileId });
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };
    var profile = getProfileById_(pid);
    if (!profile) return { ok: false, error: "Profile not found." };
    writeSkillProfileApproved_(pid, parsed, options || {});
    logAdmin_("ok", "Resume apply approved completed", { profileId: pid });
    return { ok: true };
  } catch (e) {
    logAdmin_("error", "Resume apply approved failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Fetch and engine data
// ---------------------------------------------------------------------------

function adminFetch(profileId, force) {
  logAdmin_("start", "Fetch started", { profileId: profileId });
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is required." };

    if (force) {
      var props = PropertiesService.getScriptProperties();
      props.deleteProperty("throttle:" + pid + ":fetch_enriched");
    }

    var result = fetchForProfileWithEnrichment_(pid);
    if (!result || !result.ok) {
      logAdmin_("error", "Fetch failed", { error: (result && result.message) ? result.message : "Fetch failed" });
      return { ok: false, error: (result && result.message) ? result.message : "Fetch failed" };
    }
    try {
      setProfileLastFetchAt_(pid, new Date().toISOString());
    } catch (e) { /* non-fatal */ }
    logAdmin_("ok", "Fetch completed", { profileId: pid, written: result.written || 0, batchId: result.batchId });
    return {
      ok: true,
      written: result.written || 0,
      batchId: result.batchId || null,
      message: "Fetched " + (result.written || 0) + " enriched jobs"
    };
  } catch (e) {
    logAdmin_("error", "Fetch failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetInbox(profileId) {
  logAdmin_("start", "Get inbox started", { profileId: profileId });
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
    logAdmin_("ok", "Get inbox completed", { profileId: profileId, count: (list && list.length) || 0 });
    return { ok: true, rows: list };
  } catch (e) {
    logAdmin_("error", "Get inbox failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminClearInbox(profileId) {
  logAdmin_("start", "Clear inbox started", { profileId: profileId });
  try {
    var removed = clearEngineInboxForProfile_(profileId);
    logAdmin_("ok", "Clear inbox completed", { profileId: profileId, removed: removed });
    return { ok: true, removed: removed };
  } catch (e) {
    logAdmin_("error", "Clear inbox failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetTracker(profileId) {
  logAdmin_("start", "Get tracker started", { profileId: profileId });
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
        laneLabel: String(o.laneLabel || c.lanelabel || ""),
        added_at: addedAt
      };
    });
    logAdmin_("ok", "Get tracker completed", { profileId: profileId, count: (list && list.length) || 0 });
    return { ok: true, rows: list };
  } catch (e) {
    logAdmin_("error", "Get tracker failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminClearTracker(profileId) {
  logAdmin_("start", "Clear tracker started", { profileId: profileId });
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
    logAdmin_("ok", "Clear tracker completed", { profileId: pid, removed: removed });
    return { ok: true, removed: removed };
  } catch (e) {
    logAdmin_("error", "Clear tracker failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Ops and logs
// ---------------------------------------------------------------------------

function adminGetLogs(limit, profileIdFilter, actionFilter, batchIdFilter) {
  logAdmin_("start", "Get logs started", {});
  try {
    var lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
    var sh = assertSheetExists_("📓 Logs");
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, rows: [] };

    var numCols = 7;
    var detailsCol = 5;
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
    if (batchIdFilter && String(batchIdFilter).trim()) {
      var batchStr = String(batchIdFilter).trim();
      data = data.filter(function (row) { return String(row[detailsCol] || "").indexOf(batchStr) !== -1; });
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
    logAdmin_("ok", "Get logs completed", { count: (rows && rows.length) || 0 });
    return { ok: true, rows: rows };
  } catch (e) {
    logAdmin_("error", "Get logs failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Parse batchId from receipt details string (e.g. "BATCH RECEIPT (batch: b_0301_0950, ...)").
 */
function parseReceiptBatchId_(detailsStr) {
  if (!detailsStr || typeof detailsStr !== "string") return "";
  var match = detailsStr.match(/batch:\s*([^\s,)]+)/);
  return match ? String(match[1]).trim() : "";
}

/**
 * Parse detailCode, errorDetailCode, errorMessage from log Details string (for drill-down).
 * Returns { detailCode, errorDetailCode, errorMessage } with undefined for missing keys.
 */
function parseLogDetailError_(detailsStr) {
  var out = { detailCode: undefined, errorDetailCode: undefined, errorMessage: undefined };
  if (!detailsStr || typeof detailsStr !== "string") return out;
  var dc = detailsStr.match(/detailCode:\s*([A-Z0-9_]+)/);
  if (dc) out.detailCode = dc[1];
  var edc = detailsStr.match(/errorDetailCode:\s*([A-Z0-9_]+)/);
  if (edc) out.errorDetailCode = edc[1];
  var idx = detailsStr.indexOf("error: ");
  if (idx !== -1) {
    var rest = detailsStr.slice(idx + 7);
    var end = rest.indexOf(")");
    if (end !== -1) rest = rest.slice(0, end);
    var parts = rest.split(/,\s*(?=[a-zA-Z_]+:)/);
    out.errorMessage = (parts[0] || "").trim();
  }
  return out;
}

/**
 * Parse receipt meta from details string for BATCH RECEIPT rows.
 * Returns object with numeric/string fields used by receipt cards.
 */
function parseReceiptMeta_(detailsStr) {
  var meta = {};
  if (!detailsStr || typeof detailsStr !== "string") return meta;
  var num = function (v) { return v !== undefined && v !== "" ? Number(v) : undefined; };
  var patterns = [
    { key: "rawFetchedMain", re: /rawMain:\s*(\d+)/ },
    { key: "rawFetchedRapid", re: /rawRapid:\s*(\d+)/ },
    { key: "afterDedupe", re: /afterDedupe:\s*(\d+)/ },
    { key: "eligible", re: /eligible:\s*(\d+)/ },
    { key: "candidates", re: /candidates:\s*(\d+)/ },
    { key: "enriched", re: /enriched:\s*(\d+)/ },
    { key: "written", re: /written:\s*(\d+)/ },
    { key: "durationMs", re: /durationMs:\s*(\d+)/ },
    { key: "rapidDecision", re: /rapid:\s*([^\s,)]+)/ },
    { key: "rapidStatus", re: /rapidStatus:\s*([^\s,)]+)/ },
    { key: "rapidRawCount", re: /rapidRaw:\s*(\d+)/ },
    { key: "rapidParsedCount", re: /rapidParsed:\s*(\d+)/ },
    { key: "rapidRejectedCount", re: /rapidRejected:\s*(\d+)/ },
    { key: "rapidAdded", re: /rapidAdded:\s*(\d+)/ },
    { key: "rapidJSearchCount", re: /rapidJS:\s*(\d+)/ },
    { key: "dropTop", re: /dropTop:\s*([^\s)]+)/ }
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = detailsStr.match(patterns[i].re);
    if (m) {
      var val = m[1];
      var key = patterns[i].key;
      meta[key] = (key === "dropTop" || key === "rapidDecision" || key === "rapidStatus") ? val : num(val);
    }
  }
  if (meta.durationMs === undefined) {
    var meMatch = detailsStr.match(/durationMe:\s*(\d+)/);
    if (meMatch) meta.durationMs = num(meMatch[1]);
  }
  return meta;
}

/**
 * Return receipt-only list for Logs UI (Run Receipt Cards).
 * limit: max receipts to return (e.g. 25)
 * profileIdFilter: optional profile id
 * batchIdFilter: optional batch id substring
 * afterTimestamp: optional; return receipts older than this (row time < afterTimestamp). Pass epoch ms or null.
 */
function adminGetReceipts(limit, profileIdFilter, batchIdFilter, afterTimestamp) {
  logAdmin_("start", "Get receipts started", {});
  try {
    var lim = Math.min(Math.max(Number(limit) || 25, 1), 100);
    var sh = assertSheetExists_("📓 Logs");
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, receipts: [], hasMore: false };

    var numCols = 7;
    var detailsCol = 5;
    var profileCol = 2;
    var timeCol = 1;
    var values = sh.getRange(1, 1, lastRow, numCols).getValues();
    var data = values.slice(1);
    var receiptRows = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var detailsStr = String(row[detailsCol] || "");
      if (detailsStr.indexOf("BATCH RECEIPT") === -1) continue;
      if (profileIdFilter && String(profileIdFilter).trim()) {
        if (String(row[profileCol] || "").trim() !== String(profileIdFilter).trim()) continue;
      }
      if (batchIdFilter && String(batchIdFilter).trim()) {
        if (detailsStr.indexOf(String(batchIdFilter).trim()) === -1) continue;
      }
      var rowTime = row[timeCol];
      var rowTimeMs = rowTime instanceof Date ? rowTime.getTime() : (typeof rowTime === "number" ? rowTime : new Date(rowTime).getTime());
      if (afterTimestamp != null && afterTimestamp !== "" && !isNaN(Number(afterTimestamp))) {
        if (rowTimeMs >= Number(afterTimestamp)) continue;
      }
      receiptRows.push({ row: row, rowIndex: i, timeMs: rowTimeMs });
    }
    receiptRows.sort(function (a, b) { return b.timeMs - a.timeMs; });
    var page = receiptRows.slice(0, lim);
    var hasMore = receiptRows.length > lim;
    var receipts = page.map(function (item) {
      var row = item.row;
      var detailsStr = String(row[detailsCol] || "");
      var batchId = parseReceiptBatchId_(detailsStr);
      var meta = parseReceiptMeta_(detailsStr);
      // error = real Rapid API failures only; quotaExceeded = quota hit (card shows separate gold tile)
      var isHttpError = meta.rapidStatus === "HTTP_ERROR";
      var isQuotaExceeded = meta.rapidStatus === "QUOTA_EXCEEDED";
      return {
        batchId: batchId,
        profileId: row[2],
        time: formatLogTimestamp_(row[1]),
        timeMs: item.timeMs,
        action: row[3],
        source: row[4],
        details: detailsStr,
        level: row[6],
        meta: meta,
        error: !!isHttpError,
        quotaExceeded: !!isQuotaExceeded
      };
    });
    logAdmin_("ok", "Get receipts completed", { count: receipts.length, hasMore: hasMore });
    return { ok: true, receipts: receipts, hasMore: hasMore };
  } catch (e) {
    logAdmin_("error", "Get receipts failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Return all log rows whose details contain the given batchId (for drawer stage timeline).
 */
function adminGetLogsByBatchId(batchId) {
  logAdmin_("start", "Get logs by batchId started", { batchId: batchId });
  try {
    if (!batchId || String(batchId).trim() === "") return { ok: true, rows: [] };
    var sh = assertSheetExists_("📓 Logs");
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, rows: [] };

    var numCols = 7;
    var detailsCol = 5;
    var batchStr = String(batchId).trim();
    var values = sh.getRange(1, 1, lastRow, numCols).getValues();
    var data = values.slice(1);
    var rows = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (String(row[detailsCol] || "").indexOf(batchStr) === -1) continue;
      var detailsStr = String(row[detailsCol] || "");
      var parsed = parseLogDetailError_(detailsStr);
      rows.push({
        time: formatLogTimestamp_(row[1]),
        timeMs: row[1] instanceof Date ? row[1].getTime() : new Date(row[1]).getTime(),
        profileId: row[2],
        action: row[3],
        source: row[4],
        details: detailsStr,
        level: row[6],
        detailCode: parsed.detailCode,
        errorDetailCode: parsed.errorDetailCode,
        errorMessage: parsed.errorMessage
      });
    }
    rows.sort(function (a, b) { return a.timeMs - b.timeMs; });
    logAdmin_("ok", "Get logs by batchId completed", { count: rows.length });
    return { ok: true, rows: rows };
  } catch (e) {
    logAdmin_("error", "Get logs by batchId failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Return only ERROR/WARN log rows for the given batchId (for error drill-down).
 */
function adminGetLogErrorDetails(batchId) {
  logAdmin_("start", "Get log error details started", { batchId: batchId });
  try {
    var result = adminGetLogsByBatchId(batchId);
    if (!result.ok || !result.rows) return { ok: true, rows: [] };
    var levelFilter = function (row) {
      var l = String(row.level || "").toUpperCase();
      return l === "ERROR" || l === "WARN";
    };
    var rows = result.rows.filter(levelFilter);
    logAdmin_("ok", "Get log error details completed", { count: rows.length });
    return { ok: true, rows: rows };
  } catch (e) {
    logAdmin_("error", "Get log error details failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminExportLogs(options) {
  logAdmin_("start", "Export logs started", {});
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
    logAdmin_("ok", "Export logs completed", { rowCount: result.rowCount, logsCleared: logsCleared });
    return { ok: true, rowCount: result.rowCount, sheetUrl: result.sheetUrl, logsCleared: logsCleared };
  } catch (e) {
    logAdmin_("error", "Export logs failed", { error: (e && e.message) ? e.message : String(e) });
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

/** Format date as "Wed 12th Feb 25" for job ingest card display. */
function formatCreatedAtLabel_(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "—";
  var tz = Session.getScriptTimeZone();
  var d = date;
  var day = d.getDate();
  var ord = (day % 10 === 1 && day !== 11) ? "st" : (day % 10 === 2 && day !== 12) ? "nd" : (day % 10 === 3 && day !== 13) ? "rd" : "th";
  var dayName = Utilities.formatDate(d, tz, "EEE");
  var month = Utilities.formatDate(d, tz, "MMM");
  var year = Utilities.formatDate(d, tz, "yy");
  return dayName + " " + day + ord + " " + month + " " + year;
}

function adminFormatLogsSheet() {
  logAdmin_("start", "Format logs sheet started", {});
  try {
    formatLogsSheet();
    logAdmin_("ok", "Format logs sheet completed", {});
    return { ok: true };
  } catch (e) {
    logAdmin_("error", "Format logs sheet failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminRefreshAnalytics() {
  logAdmin_("start", "Refresh analytics started", {});
  try {
    refreshAdminAnalytics_();
    logAdmin_("ok", "Refresh analytics completed", {});
    return { ok: true };
  } catch (e) {
    logAdmin_("error", "Refresh analytics failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetAnalytics() {
  logAdmin_("start", "Get analytics started", {});
  try {
    var data = getAdminAnalyticsForUI_();
    logAdmin_("ok", "Get analytics completed", {});
    return {
      ok: true,
      kpis: data.kpis,
      tierDistribution: data.tierDistribution,
      byStatus: data.byStatus,
      topErrors: data.topErrors || []
    };
  } catch (e) {
    logAdmin_("error", "Get analytics failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminHealthCheck() {
  logAdmin_("start", "Health check started", {});
  try {
    var report = runHealthCheckReport_();
    logAdmin_("ok", "Health check completed", {});
    return { ok: true, report: report };
  } catch (e) {
    logAdmin_("error", "Health check failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminInitEngineTables() {
  logAdmin_("start", "Init engine tables started", {});
  try {
    ensureEngineTables_();
    logAdmin_("ok", "Init engine tables completed", {});
    return { ok: true };
  } catch (e) {
    logAdmin_("error", "Init engine tables failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Jobs Intake (Gmail ingest + Jobs_Inbox + Role_Bank)
// ---------------------------------------------------------------------------

function adminIngestFromGmail() {
  logAdmin_("start", "Ingest from Gmail started", {});
  try {
    var result = ingestJobsFromGmail_();
    logAdmin_("ok", "Ingest from Gmail completed", {
      threads_found: result.threads_found,
      jobs_added: result.jobs_added,
      jobs_skipped_duplicate: result.jobs_skipped_duplicate,
      messages_scanned: result.messages_scanned,
      errors_count: (result.errors && result.errors.length) ? result.errors.length : 0
    });
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
    logAdmin_("error", "Ingest from Gmail failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminGetJobsInbox(filterStatuses) {
  logAdmin_("start", "Get Jobs Inbox started", {});
  try {
    var rows = readJobsInbox_(filterStatuses || ["NEW", "NEEDS_ENRICHMENT"]);
    var list = rows.map(function (o) {
      var a = o.created_at;
      var createdAt = (a instanceof Date) ? Utilities.formatDate(a, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : String(a || "");
      var createdAtLabel = (a instanceof Date) ? formatCreatedAtLabel_(a) : (createdAt || "—");
      var b = o.email_received_at;
      var emailReceivedAtLabel = (b instanceof Date) ? formatCreatedAtLabel_(b) : "—";
      return {
        job_id: o.job_id,
        _rowIndex: o._rowIndex,
        created_at: createdAt,
        created_at_label: createdAtLabel,
        email_received_at_label: emailReceivedAtLabel,
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
    logAdmin_("ok", "Get Jobs Inbox completed", { count: (list && list.length) || 0 });
    return { ok: true, rows: list };
  } catch (e) {
    logAdmin_("error", "Get Jobs Inbox failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminUpdateJobsInboxRow(jobIdOrRowIndex, patch) {
  logAdmin_("start", "Update Jobs Inbox row started", { jobIdOrRowIndex: typeof jobIdOrRowIndex === "string" ? String(jobIdOrRowIndex).slice(0, 50) : jobIdOrRowIndex });
  try {
    if (!patch || typeof patch !== "object") return { ok: false, error: "patch object is required." };
    var updated = updateJobsInboxRow_(jobIdOrRowIndex, patch);
    logAdmin_("ok", "Update Jobs Inbox row completed", {});
    return updated ? { ok: true } : { ok: false, error: "Row not found." };
  } catch (e) {
    logAdmin_("error", "Update Jobs Inbox row failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminPromoteOutlierToJob(jobId) {
  logAdmin_("start", "Promote outlier to job started", { jobId: jobId });
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
    logAdmin_("ok", "Promote outlier to job completed", { jobId: jobId });
    return updated ? { ok: true } : { ok: false, error: "Update failed." };
  } catch (e) {
    logAdmin_("error", "Promote outlier to job failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminPromoteFromJobsInbox(profileId, jobId) {
  logAdmin_("start", "Promote from Jobs Inbox started", { profileId: profileId, jobId: jobId });
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
    logAdmin_("ok", "Promote from Jobs Inbox completed", { profileId: pid, jobId: jobId });
    return { ok: true };
  } catch (e) {
    logAdmin_("error", "Promote from Jobs Inbox failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Return all jobs in Global_Job_Bank for the admin Job bank tab.
 */
function adminGetGlobalJobBank() {
  logAdmin_("start", "Get global job bank started", {});
  try {
    var jobs = typeof readGlobalJobBank_ === "function" ? readGlobalJobBank_() : [];
    logAdmin_("ok", "Get global job bank completed", { count: (jobs && jobs.length) || 0 });
    return { ok: true, jobs: jobs || [] };
  } catch (e) {
    logAdmin_("error", "Get global job bank failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Remove a job from Global_Job_Bank by URL.
 */
function adminRemoveFromGlobalJobBank(url) {
  logAdmin_("start", "Remove from global job bank started", { url: (url && String(url).substring(0, 80)) || "" });
  try {
    var u = (url && String(url).trim()) || "";
    if (!u) return { ok: false, error: "url is required." };
    var removed = typeof removeFromGlobalJobBank_ === "function" ? removeFromGlobalJobBank_(u) : false;
    logAdmin_("ok", "Remove from global job bank completed", { removed: removed });
    return { ok: true, removed: removed };
  } catch (e) {
    logAdmin_("error", "Remove from global job bank failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Add selected Jobs_Inbox job(s) to Global_Job_Bank. All clients can then see them in inbox. jobIds: array of job_id strings.
 */
function adminPromoteToGlobalJobBank(jobIds) {
  logAdmin_("start", "Promote to global job bank started", { count: (jobIds && jobIds.length) || 0 });
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
    logAdmin_("ok", "Promote to global job bank completed", { added: added, count: jobIds.length });
    return { ok: true, added: added };
  } catch (e) {
    logAdmin_("error", "Promote to global job bank failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function adminDeleteJobsInboxRow(jobId) {
  logAdmin_("start", "Delete Jobs Inbox row started", { jobId: jobId });
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
    logAdmin_("ok", "Delete Jobs Inbox row completed", { jobId: jobId, deleted: deleted });
    return deleted ? { ok: true } : { ok: false, error: "Job not found in Jobs_Inbox." };
  } catch (e) {
    logAdmin_("error", "Delete Jobs Inbox row failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Batch delete Jobs_Inbox rows by job_id. Returns { ok: true, deleted: number } or { ok: false, error: string }.
 */
function adminDeleteJobsInboxRows(jobIds) {
  logAdmin_("start", "Delete Jobs Inbox rows started", { count: (jobIds && jobIds.length) || 0 });
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
          }           catch (logErr) { /* logs must not fail */ }
        }
      }
    }
    logAdmin_("ok", "Delete Jobs Inbox rows completed", { deleted: deleted });
    return { ok: true, deleted: deleted };
  } catch (e) {
    logAdmin_("error", "Delete Jobs Inbox rows failed", { error: (e && e.message) ? e.message : String(e) });
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}
