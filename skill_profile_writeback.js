/****************************************************
 * skill_profile_writeback.gs
 * Save skill profile fields back into Admin_Profiles
 *
 * Writes:
 *  - skillProfileText  (column header: skillProfileText)
 *  - topSkills         (column header: topSkills)  -> comma-separated
 *  - signatureStories  (column header: signatureStories) -> newline-separated
 *  - roleTracksJSON    (column header: roleTracksJSON) -> JSON string
 ****************************************************/

function writeSkillProfileToAdminProfiles_(profileId, parsed) {
  const sheet = assertSheetExists_("Admin_Profiles");
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error("Admin_Profiles has no data rows.");

  const headers = values[0].map(String);

  const idxProfileId = headers.indexOf("profileId");
  const idxSkillProfileText = headers.indexOf("skillProfileText");
  const idxTopSkills = headers.indexOf("topSkills");
  const idxSignatureStories = headers.indexOf("signatureStories");
  const idxRoleTracksJSON = headers.indexOf("roleTracksJSON");

  if (idxProfileId === -1) throw new Error("Admin_Profiles missing header: profileId");
  if (idxSkillProfileText === -1) throw new Error("Admin_Profiles missing header: skillProfileText");
  if (idxTopSkills === -1) throw new Error("Admin_Profiles missing header: topSkills");
  if (idxSignatureStories === -1) throw new Error("Admin_Profiles missing header: signatureStories");

  const pid = String(profileId || "").trim();
  if (!pid) throw new Error("profileId is empty.");

  // find row
  let rowIndex = -1;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idxProfileId] || "").trim() === pid) {
      rowIndex = r;
      break;
    }
  }
  if (rowIndex === -1) throw new Error("Profile not found in Admin_Profiles: " + pid);

  const skillProfileText = String(parsed.skillProfileText || "").trim();
  const topSkills = Array.isArray(parsed.topSkills) ? parsed.topSkills : [];
  const signatureStories = Array.isArray(parsed.signatureStories) ? parsed.signatureStories : [];
  const suggestedRoles = Array.isArray(parsed.suggestedRoles) ? parsed.suggestedRoles : [];

  if (!skillProfileText) throw new Error("Parsed skillProfileText is empty.");

  const rowNumber = rowIndex + 1; // sheet rows are 1-indexed
  sheet.getRange(rowNumber, idxSkillProfileText + 1).setValue(skillProfileText);
  sheet.getRange(rowNumber, idxTopSkills + 1).setValue(topSkills.join(", "));
  sheet.getRange(rowNumber, idxSignatureStories + 1).setValue(signatureStories.join("\n"));
  
  // Build and save roleTracksJSON from suggested roles
  if (idxRoleTracksJSON !== -1 && suggestedRoles.length > 0) {
    const roleTracksJSON = buildRoleTracksFromSuggested_(suggestedRoles);
    sheet.getRange(rowNumber, idxRoleTracksJSON + 1).setValue(roleTracksJSON);
  }
}
