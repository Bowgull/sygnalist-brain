/**
 * resume_staging.js
 * Resume parse staging: suggested lanes/roles go here; admin approves then "Apply Approved Lanes".
 */

var RESUME_STAGING_HEADERS = ["profileId", "roleTitle", "keywords", "confidence", "reason", "Approved", "Applied"];

function ensureResumeStagingSheet_() {
  var sh = ensureSheet_("Resume_Staging");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, RESUME_STAGING_HEADERS.length).setValues([RESUME_STAGING_HEADERS]);
    sh.getRange(1, 1, 1, RESUME_STAGING_HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  formatResumeStagingSheet_(sh);
  return sh;
}

/**
 * Write suggested roles from parse to staging; Approved = FALSE.
 */
function writeStagingFromParsed_(profileId, parsed) {
  var suggestedRoles = Array.isArray(parsed.suggestedRoles) ? parsed.suggestedRoles : [];
  if (suggestedRoles.length === 0) return 0;

  var sh = ensureResumeStagingSheet_();
  var lastRow = sh.getLastRow();
  var pid = String(profileId || "").trim();
  if (!pid) throw new Error("profileId is empty.");

  var rows = [];
  for (var i = 0; i < suggestedRoles.length; i++) {
    var r = suggestedRoles[i];
    var title = String(r.title || "").trim();
    if (!title) continue;
    var keywords = Array.isArray(r.keywords) ? r.keywords : [];
    rows.push([
      pid,
      title,
      keywords.join(", "),
      "",  // confidence
      "Resume parse",
      false,
      ""
    ]);
  }
  if (rows.length === 0) return 0;

  var startRow = lastRow + 1;
  var numRows = rows.length;
  var numCols = rows[0] && rows[0].length ? rows[0].length : RESUME_STAGING_HEADERS.length;
  if (typeof Logger !== "undefined") Logger.log("Staging write: values rows=" + numRows + " cols=" + numCols + ", range " + numRows + "x" + numCols);
  sh.getRange(startRow, 1, numRows, numCols).setValues(rows);
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

  var data = sh.getRange(1, 1, lastRow, RESUME_STAGING_HEADERS.length).getValues();
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
 * Set Approved=TRUE only for rows whose roleTitle is in approvedRoleTitles; others set FALSE.
 * Then applyApprovedLanesForProfile_ can be called to commit.
 */
function setStagingApprovedByRoleTitles_(profileId, approvedRoleTitles) {
  var sh = ensureResumeStagingSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;

  var data = sh.getRange(1, 1, lastRow, RESUME_STAGING_HEADERS.length).getValues();
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
 */
function getApprovedStagingRows_(profileId) {
  var sh = ensureResumeStagingSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var data = sh.getRange(1, 1, lastRow, RESUME_STAGING_HEADERS.length).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var idxProfile = headers.indexOf("profileId");
  var idxTitle = headers.indexOf("roleTitle");
  var idxKeywords = headers.indexOf("keywords");
  var idxApproved = headers.indexOf("Approved");
  var idxApplied = headers.indexOf("Applied");
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
    out.push({ title: String(row[idxTitle] || "").trim(), keywords: keywords });
  }
  return out;
}

/**
 * Build roleTracksJSON from approved staging rows and write to Admin_Profiles; mark rows Applied.
 * Any approved suggested role not already in Lane_Role_Bank is added to the bank first (resume parse feeds the bank).
 */
function applyApprovedLanesForProfile_(profileId) {
  var approved = getApprovedStagingRows_(profileId);
  if (approved.length === 0) {
    return { ok: false, message: "No approved rows in staging for this profile." };
  }

  // Ensure each approved role exists in Lane_Role_Bank; add if missing (core feature: resume parse feeds lane bank).
  if (typeof getLaneRoleBank_ === "function" && typeof addRoleToLaneBank_ === "function") {
    var bank = getLaneRoleBank_();
    var bankTitleSet = {};
    bank.forEach(function(b) {
      var k = String(b.role_name || "").trim().toLowerCase();
      if (k) bankTitleSet[k] = true;
      (b.aliases || []).forEach(function(a) {
        var ak = String(a || "").trim().toLowerCase();
        if (ak) bankTitleSet[ak] = true;
      });
    });
    for (var i = 0; i < approved.length; i++) {
      var title = String(approved[i].title || "").trim();
      if (!title) continue;
      var key = title.toLowerCase();
      if (bankTitleSet[key]) continue;
      try {
        addRoleToLaneBank_(null, title, (approved[i].keywords || []).join(", "));
        bankTitleSet[key] = true;
      } catch (e) {
        if (typeof Logger !== "undefined") Logger.log("applyApprovedLanes: skip add to bank " + title + ": " + (e.message || e));
      }
    }
  }

  var roleTracksJSON = buildRoleTracksFromSuggested_(approved);
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
      meta: { profileId: profileId, count: approved.length },
      version: Sygnalist_VERSION
    }
  });

  return { ok: true, count: approved.length };
}

function markStagingApplied_(profileId) {
  var sh = ensureResumeStagingSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  var data = sh.getRange(1, 1, lastRow, RESUME_STAGING_HEADERS.length).getValues();
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
