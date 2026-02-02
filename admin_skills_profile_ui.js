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
 */
function skillProfile_buildAndSave_(profileId, rawResumeText) {
  try {
    const pid = String(profileId || "").trim();
    const raw = String(rawResumeText || "").trim();

    if (!pid) throw new Error("profileId is empty.");
    if (!raw) throw new Error("Resume text is empty.");

    const profile = getProfileByIdOrThrow_(pid);
    assertProfileActiveOrThrow_(profile);

    const parsed = parseResumeToSkillProfile_(raw);
    writeSkillProfileToAdminProfiles_(pid, parsed);

    logEvent_({
      timestamp: Date.now(),
      profileId: pid,
      action: "admin",
      source: "skill_profile_ui",
      details: {
        level: "INFO",
        message: "Skill profile built + saved",
        meta: {
          topSkillsCount: (parsed.topSkills || []).length,
          storiesCount: (parsed.signatureStories || []).length,
          rolesCount: (parsed.suggestedRoles || []).length
        },
        version: (typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "unknown")
      }
    });

    return { 
      ok: true, 
      parsed: parsed,
      version: (typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "unknown") 
    };

  } catch (e) {
    return {
      ok: false,
      error: (e && e.message) ? e.message : String(e),
      version: (typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "unknown")
    };
  }
}
