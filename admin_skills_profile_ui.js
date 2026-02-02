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

  const values = sh.getDataRange().getValues();
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

    // Write results back
    try {
      writeSkillProfileToAdminProfiles_(pid, parsed);
    } catch (writeErr) {
      return { ok: false, error: "Write Error: " + (writeErr.message || String(writeErr)) };
    }

    return { 
      ok: true, 
      parsed: parsed,
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
