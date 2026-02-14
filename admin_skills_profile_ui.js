/****************************************************
 * admin_skill_profile_ui.gs
 * Skill Profile Builder — server-rendered dropdown
 * (stability-first, blueprint-aligned)
 ****************************************************/

function openSkillProfileBuilder_() {
  const tpl = HtmlService.createTemplateFromFile("sidebar_skill_profile");
  tpl.profiles = skillProfile_listProfiles_();
  tpl.version = (typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "unknown");

  const html = tpl.evaluate()
    .setTitle("🧬 Skill Profile Builder")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Direct read Admin_Profiles to build dropdown list.
 * Returns: [{ profileId, displayName }]
 */
function skillProfile_listProfiles_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet.");

  const sh = ss.getSheetByName("Admin_Profiles");
  if (!sh) throw new Error("Sheet 'Admin_Profiles' not found.");

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const idxId = headers.indexOf("profileId");
  const idxName = headers.indexOf("displayName");

  if (idxId === -1) throw new Error("Admin_Profiles missing 'profileId' header.");

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const pid = String(values[r][idxId] || "").trim();
    if (!pid) continue;

    const name = (idxName !== -1) ? String(values[r][idxName] || "").trim() : "";
    out.push({ profileId: pid, displayName: name || pid });
  }

  return out;
}

/**
 * Build + Save (engine logic)
 * Returns { ok:true, parsed: {...} } or { ok:false, error }
 * 
 * NOTE: No trailing underscore - must be callable from client via google.script.run
 */
function skillProfileBuildAndSave(profileId, rawResumeText) {
  try {
    const pid = String(profileId || "").trim();
    const raw = String(rawResumeText || "").trim();

    if (!pid) {
      return { ok: false, error: "profileId is empty." };
    }
    if (!raw || raw.length < 100) {
      return { ok: false, error: "Resume text is too short (need at least 100 characters)." };
    }

    // Verify profile exists
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return { ok: false, error: "No active spreadsheet." };
    }
    
    var profileSheet = ss.getSheetByName("Admin_Profiles");
    if (!profileSheet) {
      return { ok: false, error: "Admin_Profiles sheet not found." };
    }

    // Call AI to parse resume
    var parsed;
    try {
      parsed = parseResumeToSkillProfile_(raw);
    } catch (aiErr) {
      return { ok: false, error: "AI Error: " + (aiErr.message || String(aiErr)) };
    }

    // Write skill profile text/stories to Admin_Profiles; write suggested roles to Resume_Staging for approval
    try {
      writeSkillProfileOnlyTextAndStories_(pid, parsed);
    } catch (writeErr) {
      return { ok: false, error: "Write Error: " + (writeErr.message || String(writeErr)) };
    }

    var stagingCount = 0;
    try {
      stagingCount = writeStagingFromParsed_(pid, parsed);
    } catch (stagingErr) {
      return { ok: false, error: "Staging Error: " + (stagingErr.message || String(stagingErr)) };
    }

    logEvent_({
      timestamp: Date.now(),
      profileId: pid,
      action: "admin",
      source: "skill_profile",
      details: {
        level: "INFO",
        message: "Resume parse complete; suggested lanes in staging",
        meta: { profileId: pid, stagingRows: stagingCount },
        version: Sygnalist_VERSION
      }
    });

    return {
      ok: true,
      parsed: parsed,
      stagingRows: stagingCount,
      message: stagingCount > 0 ? "Review Resume_Staging tab, check Approved, then run Apply Approved Lanes." : "Skill profile saved. No suggested roles to stage.",
      version: (typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "unknown")
    };

  } catch (e) {
    return {
      ok: false,
      error: "Unexpected Error: " + (e && e.message ? e.message : String(e)),
      version: (typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "unknown")
    };
  }
}

/**
 * Get all staging rows for a profile (for sidebar Step B). Callable from client.
 * Returns [{ roleTitle, keywords, confidence, reason, approved }].
 */
function skillProfileGetStagingForProfile(profileId) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is empty." };
    var rows = getAllStagingRowsForProfile_(pid);
    return { ok: true, rows: rows };
  } catch (e) {
    return { ok: false, error: (e && e.message ? e.message : String(e)) };
  }
}

/**
 * Set approved lanes from sidebar: only rows whose roleTitle is in approvedRoleTitles get Approved=TRUE,
 * then apply to profile. Callable from client. (Legacy; prefer Lane Controls.)
 */
function skillProfileApplyApprovedFromSidebar(profileId, approvedRoleTitles) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is empty." };
    var arr = Array.isArray(approvedRoleTitles) ? approvedRoleTitles : [];
    setStagingApprovedByRoleTitles_(pid, arr);
    var out = applyApprovedLanesForProfile_(pid);
    return out;
  } catch (e) {
    return { ok: false, message: (e && e.message ? e.message : String(e)) };
  }
}

/**
 * Lane Role Bank: return active rows for UI. Callable from client.
 */
function getLaneRoleBank() {
  try {
    var bank = getLaneRoleBank_();
    return { ok: true, bank: bank };
  } catch (e) {
    return { ok: false, error: (e && e.message ? e.message : String(e)) };
  }
}

/**
 * Get current lane controls for a profile. Callable from client.
 * Returns { ok: true, laneControls: {} } or { ok: false, error }.
 */
function getProfileLaneControls(profileId) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is empty." };
    var profile = getProfileById_(pid);
    if (!profile) return { ok: false, error: "Profile not found." };
    var laneControls = profile.laneControls && typeof profile.laneControls === "object" ? profile.laneControls : {};
    return { ok: true, laneControls: laneControls };
  } catch (e) {
    return { ok: false, error: (e && e.message ? e.message : String(e)) };
  }
}

/**
 * Save lane controls for a profile. Writes laneControlsJSON to Admin_Profiles.
 * laneControls: { "lane_key": { is_enabled: bool, allowed_bank_role_ids: string[] } }
 */
function setProfileLaneControls(profileId, laneControls) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: false, error: "profileId is empty." };

    var sh = assertSheetExists_("Admin_Profiles");
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return { ok: false, error: "Admin_Profiles has no data." };

    var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0].map(function (h) { return String(h || "").trim(); });
    var idxProfile = headers.indexOf("profileId");
    if (idxProfile === -1) return { ok: false, error: "Admin_Profiles missing profileId." };

    var rowIndex = -1;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idxProfile] || "").trim() === pid) {
        rowIndex = r;
        break;
      }
    }
    if (rowIndex === -1) return { ok: false, error: "Profile not found." };

    var idxLaneControls = headers.indexOf("laneControlsJSON");
    if (idxLaneControls === -1) {
      lastCol++;
      idxLaneControls = lastCol - 1;
      sh.getRange(1, lastCol).setValue("laneControlsJSON");
    }

    var jsonStr = (laneControls && typeof laneControls === "object") ? JSON.stringify(laneControls) : "{}";
    sh.getRange(rowIndex + 1, idxLaneControls + 1).setValue(jsonStr);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message ? e.message : String(e)) };
  }
}

/**
 * Suggested bank role ids from parse (match suggested role titles to bank by role_name/aliases).
 * For "Use parse suggestions" in Lane Controls. Callable from client.
 */
function getSuggestedBankRoleIdsForProfile(profileId) {
  try {
    var pid = String(profileId || "").trim();
    if (!pid) return { ok: true, suggestedIds: {} };
    var rows = getAllStagingRowsForProfile_(pid);
    var bank = getLaneRoleBank_();
    var suggestedIds = {};
    var lower = function (s) { return String(s || "").toLowerCase().trim(); };
    for (var i = 0; i < rows.length; i++) {
      var title = lower(rows[i].roleTitle);
      if (!title) continue;
      for (var j = 0; j < bank.length; j++) {
        var b = bank[j];
        if (lower(b.role_name) === title) {
          suggestedIds[b.lane_key] = suggestedIds[b.lane_key] || [];
          if (suggestedIds[b.lane_key].indexOf(b.id) === -1) suggestedIds[b.lane_key].push(b.id);
          break;
        }
        var aliases = b.aliases || [];
        for (var k = 0; k < aliases.length; k++) {
          if (lower(aliases[k]) === title) {
            suggestedIds[b.lane_key] = suggestedIds[b.lane_key] || [];
            if (suggestedIds[b.lane_key].indexOf(b.id) === -1) suggestedIds[b.lane_key].push(b.id);
            break;
          }
        }
      }
    }
    return { ok: true, suggestedIds: suggestedIds };
  } catch (e) {
    return { ok: false, error: (e && e.message ? e.message : String(e)) };
  }
}
