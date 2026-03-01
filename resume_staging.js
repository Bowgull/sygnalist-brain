/**
 * resume_staging.js
 * Resume parse staging: suggested lanes/roles go here; admin approves then "Apply Approved Lanes".
 */

var RESUME_STAGING_HEADERS = ["profileId", "roleTitle", "keywords", "confidence", "reason", "Approved", "Applied", "role_bank_id", "resolution_status", "source"];

function ensureResumeStagingSheet_() {
  var sh = ensureSheet_("Resume_Staging");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, RESUME_STAGING_HEADERS.length).setValues([RESUME_STAGING_HEADERS]);
    sh.getRange(1, 1, 1, RESUME_STAGING_HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    ensureResumeStagingColumns_(sh);
  }
  if (typeof formatResumeStagingSheet_ === "function") formatResumeStagingSheet_(sh);
  return sh;
}

/**
 * Ensure Option A columns exist (role_bank_id, resolution_status, source); backfill empty for existing rows.
 */
function ensureResumeStagingColumns_(sh) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 1) return;
  var headers = sh.getRange(1, 1, 1, Math.max(lastCol, 1)).getValues()[0].map(function (h) { return String(h || "").trim(); });
  if (headers.indexOf("role_bank_id") >= 0) return;
  for (var c = headers.length; c < RESUME_STAGING_HEADERS.length; c++) {
    sh.getRange(1, c + 1).setValue(RESUME_STAGING_HEADERS[c]);
  }
  for (var r = 2; r <= lastRow; r++) {
    sh.getRange(r, 8).setValue("");
    sh.getRange(r, 9).setValue("");
    sh.getRange(r, 10).setValue("");
  }
}

/**
 * Normalize role title for dedupe: use normalizeRoleTitle_ from lane_bank when available for consistency.
 */
function normalizeRoleTitleForDedupe_(title) {
  if (typeof normalizeRoleTitle_ === "function") return normalizeRoleTitle_(title);
  return String(title || "").trim().toLowerCase();
}

/**
 * Write suggested roles from parse to staging; Approved = FALSE.
 * Option A: Resolve each via upsertLaneRoleBankEntry_(source=resume_parse, statusDefault=pending); set role_bank_id, resolution_status, source on each row.
 * Dedupes against existing staging for this profile (normalized title); idempotent key = profileId + normalizeRoleTitle(title) + source.
 */
function writeStagingFromParsed_(profileId, parsed) {
  var suggestedRoles = Array.isArray(parsed.suggestedRoles) ? parsed.suggestedRoles : [];
  if (suggestedRoles.length === 0) return 0;

  var sh = ensureResumeStagingSheet_();
  ensureResumeStagingColumns_(sh);
  var lastRow = sh.getLastRow();
  var pid = String(profileId || "").trim();
  if (!pid) throw new Error("profileId is empty.");

  // Build set of existing staging keys for this profile (normalized title + role_bank_id) so we don't duplicate
  var existingStagingSet = {};
  var existingRows = typeof getAllStagingRowsForProfileIncludingApplied_ === "function"
    ? getAllStagingRowsForProfileIncludingApplied_(pid)
    : [];
  existingRows.forEach(function (row) {
    var k = normalizeRoleTitleForDedupe_(row.roleTitle);
    if (k) existingStagingSet[k] = true;
    if (row.role_bank_id) existingStagingSet["id:" + String(row.role_bank_id).trim()] = true;
  });

  var rows = [];
  var seenInBatch = {};
  for (var i = 0; i < suggestedRoles.length; i++) {
    var r = suggestedRoles[i];
    var title = String(r.title || "").trim();
    if (!title) continue;
    var key = normalizeRoleTitleForDedupe_(title);
    if (existingStagingSet[key] || seenInBatch[key]) continue;
    seenInBatch[key] = true;

    var role_bank_id = "";
    var resolution_status = "unresolved";
    if (typeof upsertLaneRoleBankEntry_ === "function") {
      try {
        var keywords = Array.isArray(r.keywords) ? r.keywords : [];
        var u = upsertLaneRoleBankEntry_({
          role_name: title,
          aliases: keywords.join(", "),
          source: "resume_parse",
          statusDefault: "pending"
        });
        role_bank_id = u.id || "";
        resolution_status = (u.status === "active") ? "matched" : ((u.status === "pending") ? "pending" : "unresolved");
      } catch (e) {
        if (typeof Logger !== "undefined") Logger.log("writeStagingFromParsed_: upsert " + title + " " + (e.message || e));
      }
    }

    rows.push([
      pid,
      title,
      (Array.isArray(r.keywords) ? r.keywords : []).join(", "),
      "",
      "Resume parse",
      false,
      "",
      role_bank_id,
      resolution_status,
      "resume_parse"
    ]);
  }
  if (rows.length === 0) return 0;

  var numRows = rows.length;
  var numCols = rows[0].length;
  var startRow = lastRow + 1;
  sh.getRange(startRow, 1, startRow + numRows - 1, numCols).setValues(rows);
  return rows.length;
}

/**
 * Get all staging rows for a profile (for sidebar review). Returns [{ roleTitle, keywords, confidence, reason, approved }].
 * Approved = current sheet value (true/false).
 */
function getAllStagingRowsForProfile_(profileId) {
  var sh = ensureResumeStagingSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var data = sh.getRange(1, 1, lastRow, Math.max(sh.getLastColumn(), RESUME_STAGING_HEADERS.length)).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var idxProfile = headers.indexOf("profileId");
  var idxTitle = headers.indexOf("roleTitle");
  var idxKeywords = headers.indexOf("keywords");
  var idxConfidence = headers.indexOf("confidence");
  var idxReason = headers.indexOf("reason");
  var idxApproved = headers.indexOf("Approved");
  var idxApplied = headers.indexOf("Applied");
  if (idxProfile === -1 || idxTitle === -1) return [];

  var pid = String(profileId || "").trim();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;
    if (row[idxApplied] === true || row[idxApplied] === "TRUE") continue;
    out.push({
      roleTitle: String(row[idxTitle] || "").trim(),
      keywords: String(row[idxKeywords] || "").trim(),
      confidence: String(row[idxConfidence] != null ? row[idxConfidence] : "").trim(),
      reason: String(row[idxReason] != null ? row[idxReason] : "").trim(),
      approved: row[idxApproved] === true || row[idxApproved] === "TRUE"
    });
  }
  return out;
}

/**
 * Get all staging rows for a profile including those already applied (for UI so applied roles stay visible).
 * Returns [{ roleTitle, keywords, confidence, reason, approved, applied, role_bank_id, resolution_status }].
 */
function getAllStagingRowsForProfileIncludingApplied_(profileId) {
  var sh = ensureResumeStagingSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var numCols = Math.max(sh.getLastColumn(), RESUME_STAGING_HEADERS.length);
  var data = sh.getRange(1, 1, lastRow, numCols).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var idxProfile = headers.indexOf("profileId");
  var idxTitle = headers.indexOf("roleTitle");
  var idxKeywords = headers.indexOf("keywords");
  var idxConfidence = headers.indexOf("confidence");
  var idxReason = headers.indexOf("reason");
  var idxApproved = headers.indexOf("Approved");
  var idxApplied = headers.indexOf("Applied");
  var idxRoleBankId = headers.indexOf("role_bank_id");
  var idxResolutionStatus = headers.indexOf("resolution_status");
  if (idxProfile === -1 || idxTitle === -1) return [];

  var pid = String(profileId || "").trim();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;
    var applied = row[idxApplied] === true || row[idxApplied] === "TRUE";
    out.push({
      roleTitle: String(row[idxTitle] || "").trim(),
      keywords: String(row[idxKeywords] || "").trim(),
      confidence: String(row[idxConfidence] != null ? row[idxConfidence] : "").trim(),
      reason: String(row[idxReason] != null ? row[idxReason] : "").trim(),
      approved: row[idxApproved] === true || row[idxApproved] === "TRUE",
      applied: applied,
      role_bank_id: idxRoleBankId >= 0 && row[idxRoleBankId] != null ? String(row[idxRoleBankId] || "").trim() : "",
      resolution_status: idxResolutionStatus >= 0 && row[idxResolutionStatus] != null ? String(row[idxResolutionStatus] || "").trim() : ""
    });
  }
  return out;
}

/**
 * Same as getAllStagingRowsForProfileIncludingApplied_ but deduped by normalized role title (first occurrence wins).
 * Use for display so the staging table shows one row per unique role.
 */
function getStagingRowsForProfileDeduped_(profileId) {
  var rows = getAllStagingRowsForProfileIncludingApplied_(profileId);
  var seen = {};
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var key = normalizeRoleTitleForDedupe_(rows[i].roleTitle);
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.push(rows[i]);
  }
  return out;
}

/**
 * Set Approved=TRUE only for rows whose roleTitle is in approvedRoleTitles; others set FALSE.
 * Then applyApprovedLanesForProfile_ can be called to commit.
 */
function setStagingApprovedByRoleTitles_(profileId, approvedRoleTitles) {
  var sh = ensureResumeStagingSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;

  var data = sh.getRange(1, 1, lastRow, Math.max(sh.getLastColumn(), RESUME_STAGING_HEADERS.length)).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var idxProfile = headers.indexOf("profileId");
  var idxTitle = headers.indexOf("roleTitle");
  var idxApproved = headers.indexOf("Approved");
  if (idxProfile === -1 || idxTitle === -1 || idxApproved === -1) return 0;

  var pid = String(profileId || "").trim();
  var allowed = approvedRoleTitles && approvedRoleTitles.length ? approvedRoleTitles.map(function(t) { return String(t || "").trim(); }).filter(Boolean) : [];
  var count = 0;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idxProfile] || "").trim() !== pid) continue;
    var title = String(data[r][idxTitle] || "").trim();
    var approved = allowed.indexOf(title) !== -1;
    sh.getRange(r + 1, idxApproved + 1).setValue(approved);
    if (approved) count++;
  }
  return count;
}

/**
 * Get approved (Approved=TRUE, Applied blank) staging rows for a profile.
 * Returns [{ title, keywords, role_bank_id, resolution_status }].
 */
function getApprovedStagingRows_(profileId) {
  var sh = ensureResumeStagingSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var numCols = Math.max(sh.getLastColumn(), RESUME_STAGING_HEADERS.length);
  var data = sh.getRange(1, 1, lastRow, numCols).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var idxProfile = headers.indexOf("profileId");
  var idxTitle = headers.indexOf("roleTitle");
  var idxKeywords = headers.indexOf("keywords");
  var idxApproved = headers.indexOf("Approved");
  var idxApplied = headers.indexOf("Applied");
  var idxRoleBankId = headers.indexOf("role_bank_id");
  var idxResolutionStatus = headers.indexOf("resolution_status");
  if (idxProfile === -1 || idxTitle === -1) return [];

  var pid = String(profileId || "").trim();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;
    if (row[idxApproved] !== true && row[idxApproved] !== "TRUE") continue;
    if (row[idxApplied] === true || row[idxApplied] === "TRUE") continue;
    var keywordsStr = String(row[idxKeywords] || "").trim();
    var keywords = keywordsStr ? keywordsStr.split(/\s*,\s*/) : [];
    out.push({
      title: String(row[idxTitle] || "").trim(),
      keywords: keywords,
      role_bank_id: idxRoleBankId >= 0 && row[idxRoleBankId] != null ? String(row[idxRoleBankId] || "").trim() : "",
      resolution_status: idxResolutionStatus >= 0 && row[idxResolutionStatus] != null ? String(row[idxResolutionStatus] || "").trim() : ""
    });
  }
  return out;
}

/**
 * Build roleTracksJSON from bank row ids. Fetches active bank and builds RoleTrack-like objects for each id.
 */
function buildRoleTracksFromBankIds_(ids) {
  if (!ids || ids.length === 0) return "[]";
  var idSet = {};
  for (var i = 0; i < ids.length; i++) {
    var s = String(ids[i] || "").trim();
    if (s) idSet[s] = true;
  }
  if (typeof getLaneRoleBank_ !== "function") return "[]";
  var bank = getLaneRoleBank_({ activeOnly: true });
  var tracks = [];
  bank.forEach(function (row) {
    if (!idSet[row.id]) return;
    var keywords = [row.role_name].concat(row.aliases || []).map(function (s) { return String(s).trim().toLowerCase(); }).filter(Boolean);
    tracks.push({
      id: row.id,
      label: row.role_name,
      roleKeywords: keywords,
      laneLabel: (row.lane_key ? row.lane_key + " Lane" : row.role_name + " Lane"),
      priorityWeight: 1.0
    });
  });
  return JSON.stringify(tracks);
}

/**
 * Build roleTracksJSON from approved staging rows and write to Admin_Profiles; mark rows Applied.
 * Option A: Dedupe by role_bank_id (preferred) or normalized title; promote pending bank rows to active; build roleTracks from bank; write roleTracksJSON.
 */
function applyApprovedLanesForProfile_(profileId) {
  var approved = getApprovedStagingRows_(profileId);
  if (approved.length === 0) {
    return { ok: false, message: "No approved rows in staging for this profile." };
  }

  // Dedupe: by role_bank_id if present, else by normalized title (first wins)
  var seen = {};
  var unique = [];
  for (var i = 0; i < approved.length; i++) {
    var a = approved[i];
    var title = String(a.title || "").trim();
    var key = a.role_bank_id ? ("id:" + a.role_bank_id) : ("title:" + normalizeRoleTitleForDedupe_(title));
    if (seen[key] || (!a.role_bank_id && !title)) continue;
    seen[key] = true;
    unique.push(a);
  }

  var ids = [];
  if (typeof promoteLaneRoleBankToActive_ === "function" && typeof upsertLaneRoleBankEntry_ === "function") {
    for (var j = 0; j < unique.length; j++) {
      var u = unique[j];
      if (u.role_bank_id) {
        try {
          promoteLaneRoleBankToActive_(u.role_bank_id);
          ids.push(u.role_bank_id);
        } catch (e) {
          if (typeof Logger !== "undefined") Logger.log("applyApprovedLanes: promote " + u.role_bank_id + " " + (e.message || e));
        }
      } else {
        try {
          var res = upsertLaneRoleBankEntry_({
            role_name: u.title,
            aliases: (u.keywords || []).join(", "),
            source: "resume_parse",
            statusDefault: "active"
          });
          if (res && res.id) ids.push(res.id);
        } catch (e) {
          if (typeof Logger !== "undefined") Logger.log("applyApprovedLanes: upsert " + u.title + " " + (e.message || e));
        }
      }
    }
  }

  var roleTracksJSON = buildRoleTracksFromBankIds_(ids);
  if (roleTracksJSON === "[]" && ids.length > 0) {
    roleTracksJSON = buildRoleTracksFromSuggested_(unique);
  }

  var sheet = assertSheetExists_("Admin_Profiles");
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { ok: false, message: "Admin_Profiles has no data." };
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(String);
  var idxProfile = headers.indexOf("profileId");
  var idxRoleTracks = headers.indexOf("roleTracksJSON");
  if (idxProfile === -1 || idxRoleTracks === -1) return { ok: false, message: "Admin_Profiles missing profileId or roleTracksJSON." };

  var rowIndex = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idxProfile] || "").trim() === String(profileId || "").trim()) {
      rowIndex = r;
      break;
    }
  }
  if (rowIndex === -1) return { ok: false, message: "Profile not found." };

  sheet.getRange(rowIndex + 1, idxRoleTracks + 1).setValue(roleTracksJSON);

  markStagingApplied_(profileId);

  logEvent_({
    timestamp: Date.now(),
    profileId: profileId,
    action: "admin",
    source: "resume_staging",
    details: {
      level: "INFO",
      message: "Apply Approved Lanes",
      meta: { profileId: profileId, count: unique.length },
      version: Sygnalist_VERSION
    }
  });

  return { ok: true, count: unique.length };
}

function markStagingApplied_(profileId) {
  var sh = ensureResumeStagingSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  var data = sh.getRange(1, 1, lastRow, Math.max(sh.getLastColumn(), RESUME_STAGING_HEADERS.length)).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var idxProfile = headers.indexOf("profileId");
  var idxApproved = headers.indexOf("Approved");
  var idxApplied = headers.indexOf("Applied");
  if (idxProfile === -1 || idxApplied === -1) return;

  var pid = String(profileId || "").trim();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idxProfile] || "").trim() !== pid) continue;
    if (data[r][idxApproved] !== true && data[r][idxApproved] !== "TRUE") continue;
    sh.getRange(r + 1, idxApplied + 1).setValue(true);
  }
}

/**
 * Menu entry: prompt for profileId, then apply approved lanes for that profile.
 */
function applyApprovedLanes_() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt("Apply Approved Lanes", "Enter profileId (e.g. josh, client1)", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  var profileId = String(res.getResponseText() || "").trim();
  if (!profileId) {
    ui.alert("No profileId entered.");
    return;
  }

  var out = applyApprovedLanesForProfile_(profileId);
  if (out.ok) {
    ui.alert("Applied " + out.count + " approved lane(s) for " + profileId + ".");
  } else {
    ui.alert(out.message || "Apply failed.");
  }
}
