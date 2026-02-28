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
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) throw new Error("Admin_Profiles has no data rows.");
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
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

  // roleTracksJSON: only written via "Apply Approved Lanes" from Resume_Staging (see resume_staging.js)
  if (idxRoleTracksJSON !== -1 && suggestedRoles.length > 0) {
    const roleTracksJSON = buildRoleTracksFromSuggested_(suggestedRoles);
    sheet.getRange(rowNumber, idxRoleTracksJSON + 1).setValue(roleTracksJSON);
  }
}

/**
 * Write only skillProfileText, topSkills, signatureStories (no roleTracks).
 * Used when resume parse writes to staging; lanes applied later via Apply Approved Lanes.
 */
function writeSkillProfileOnlyTextAndStories_(profileId, parsed) {
  const sheet = assertSheetExists_("Admin_Profiles");
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) throw new Error("Admin_Profiles has no data rows.");
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  if (values.length < 2) throw new Error("Admin_Profiles has no data rows.");

  const headers = values[0].map(String);
  const idxProfileId = headers.indexOf("profileId");
  const idxSkillProfileText = headers.indexOf("skillProfileText");
  const idxTopSkills = headers.indexOf("topSkills");
  const idxSignatureStories = headers.indexOf("signatureStories");

  if (idxProfileId === -1 || idxSkillProfileText === -1 || idxTopSkills === -1 || idxSignatureStories === -1) {
    throw new Error("Admin_Profiles missing required headers.");
  }

  const pid = String(profileId || "").trim();
  if (!pid) throw new Error("profileId is empty.");

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
  if (!skillProfileText) throw new Error("Parsed skillProfileText is empty.");

  const rowNumber = rowIndex + 1;
  sheet.getRange(rowNumber, idxSkillProfileText + 1).setValue(skillProfileText);
  sheet.getRange(rowNumber, idxTopSkills + 1).setValue(topSkills.join(", "));
  sheet.getRange(rowNumber, idxSignatureStories + 1).setValue(signatureStories.join("\n"));

  // Optional: write structured parse fields so fetch/scoring use them
  var idxPreferred = headers.indexOf("preferredLocations");
  if (idxPreferred !== -1 && Array.isArray(parsed.preferredLocations) && parsed.preferredLocations.length > 0) {
    sheet.getRange(rowNumber, idxPreferred + 1).setValue(parsed.preferredLocations.join(", "));
  }
  var idxRemote = headers.indexOf("remotePreference");
  if (idxRemote !== -1 && parsed.remotePreference) {
    var rp = String(parsed.remotePreference).trim().toLowerCase();
    sheet.getRange(rowNumber, idxRemote + 1).setValue(rp === "onsite_ok" ? "onsite_ok" : rp === "hybrid_ok" ? "remote_or_hybrid" : "remote_only");
  }
  var idxAcceptRemote = headers.indexOf("acceptRemote");
  var idxAcceptHybrid = headers.indexOf("acceptHybrid");
  var idxAcceptOnsite = headers.indexOf("acceptOnsite");
  if (idxAcceptRemote !== -1 && idxAcceptHybrid !== -1 && idxAcceptOnsite !== -1) {
    var pref = String(parsed.remotePreference || "").trim().toLowerCase();
    var ar = pref === "remote_only" || pref === "hybrid_ok" || pref === "onsite_ok";
    var ah = pref === "hybrid_ok" || pref === "onsite_ok";
    var ao = pref === "onsite_ok";
    sheet.getRange(rowNumber, idxAcceptRemote + 1).setValue(ar ? "TRUE" : "FALSE");
    sheet.getRange(rowNumber, idxAcceptHybrid + 1).setValue(ah ? "TRUE" : "FALSE");
    sheet.getRange(rowNumber, idxAcceptOnsite + 1).setValue(ao ? "TRUE" : "FALSE");
  }
  var idxPreferredCountries = headers.indexOf("preferredCountries");
  if (idxPreferredCountries !== -1 && Array.isArray(parsed.preferredCountries) && parsed.preferredCountries.length > 0) {
    sheet.getRange(rowNumber, idxPreferredCountries + 1).setValue(parsed.preferredCountries.join(", "));
  }
  var idxPreferredCities = headers.indexOf("preferredCities");
  if (idxPreferredCities !== -1 && Array.isArray(parsed.preferredCities) && parsed.preferredCities.length > 0) {
    sheet.getRange(rowNumber, idxPreferredCities + 1).setValue(parsed.preferredCities.join(", "));
  }
  var idxCurrentCity = headers.indexOf("currentCity");
  if (idxCurrentCity !== -1 && parsed.currentCity) {
    sheet.getRange(rowNumber, idxCurrentCity + 1).setValue(String(parsed.currentCity).trim());
  }
  var idxRemoteScope = headers.indexOf("remoteRegionScope");
  if (idxRemoteScope !== -1) {
    sheet.getRange(rowNumber, idxRemoteScope + 1).setValue("remote_global");
  }
}

/**
 * Write only the parts of the parsed result that the admin approved.
 * options = { applySkills: boolean, applyPreferences: boolean }.
 * Used after review step; no write to Admin_Profiles until admin approves.
 */
function writeSkillProfileApproved_(profileId, parsed, options) {
  const applySkills = options && options.applySkills === true;
  const applyPreferences = options && options.applyPreferences === true;
  if (!applySkills && !applyPreferences) return;

  const sheet = assertSheetExists_("Admin_Profiles");
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  if (values.length < 2) return;

  const headers = values[0].map(String);
  const idxProfileId = headers.indexOf("profileId");
  if (idxProfileId === -1) return;

  const pid = String(profileId || "").trim();
  if (!pid) return;

  let rowIndex = -1;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idxProfileId] || "").trim() === pid) {
      rowIndex = r;
      break;
    }
  }
  if (rowIndex === -1) throw new Error("Profile not found in Admin_Profiles: " + pid);

  const rowNumber = rowIndex + 1;

  if (applySkills) {
    const idxSkillProfileText = headers.indexOf("skillProfileText");
    const idxTopSkills = headers.indexOf("topSkills");
    const idxSignatureStories = headers.indexOf("signatureStories");
    if (idxSkillProfileText === -1 || idxTopSkills === -1 || idxSignatureStories === -1) return;
    const skillProfileText = String(parsed.skillProfileText || "").trim();
    if (!skillProfileText) return;
    const topSkills = Array.isArray(parsed.topSkills) ? parsed.topSkills : [];
    const signatureStories = Array.isArray(parsed.signatureStories) ? parsed.signatureStories : [];
    sheet.getRange(rowNumber, idxSkillProfileText + 1).setValue(skillProfileText);
    sheet.getRange(rowNumber, idxTopSkills + 1).setValue(topSkills.join(", "));
    sheet.getRange(rowNumber, idxSignatureStories + 1).setValue(signatureStories.join("\n"));
  }

  if (applyPreferences) {
    var idxPreferred = headers.indexOf("preferredLocations");
    if (idxPreferred !== -1 && Array.isArray(parsed.preferredLocations) && parsed.preferredLocations.length > 0) {
      sheet.getRange(rowNumber, idxPreferred + 1).setValue(parsed.preferredLocations.join(", "));
    }
    var idxRemote = headers.indexOf("remotePreference");
    if (idxRemote !== -1 && parsed.remotePreference) {
      var rp = String(parsed.remotePreference).trim().toLowerCase();
      sheet.getRange(rowNumber, idxRemote + 1).setValue(rp === "onsite_ok" ? "onsite_ok" : rp === "hybrid_ok" ? "remote_or_hybrid" : "remote_only");
    }
    var idxAcceptRemote = headers.indexOf("acceptRemote");
    var idxAcceptHybrid = headers.indexOf("acceptHybrid");
    var idxAcceptOnsite = headers.indexOf("acceptOnsite");
    if (idxAcceptRemote !== -1 && idxAcceptHybrid !== -1 && idxAcceptOnsite !== -1) {
      var pref = String(parsed.remotePreference || "").trim().toLowerCase();
      var ar = pref === "remote_only" || pref === "hybrid_ok" || pref === "onsite_ok";
      var ah = pref === "hybrid_ok" || pref === "onsite_ok";
      var ao = pref === "onsite_ok";
      sheet.getRange(rowNumber, idxAcceptRemote + 1).setValue(ar ? "TRUE" : "FALSE");
      sheet.getRange(rowNumber, idxAcceptHybrid + 1).setValue(ah ? "TRUE" : "FALSE");
      sheet.getRange(rowNumber, idxAcceptOnsite + 1).setValue(ao ? "TRUE" : "FALSE");
    }
    var idxPreferredCountries = headers.indexOf("preferredCountries");
    if (idxPreferredCountries !== -1 && Array.isArray(parsed.preferredCountries) && parsed.preferredCountries.length > 0) {
      sheet.getRange(rowNumber, idxPreferredCountries + 1).setValue(parsed.preferredCountries.join(", "));
    }
    var idxPreferredCities = headers.indexOf("preferredCities");
    if (idxPreferredCities !== -1 && Array.isArray(parsed.preferredCities) && parsed.preferredCities.length > 0) {
      sheet.getRange(rowNumber, idxPreferredCities + 1).setValue(parsed.preferredCities.join(", "));
    }
    var idxCurrentCity = headers.indexOf("currentCity");
    if (idxCurrentCity !== -1 && parsed.currentCity) {
      sheet.getRange(rowNumber, idxCurrentCity + 1).setValue(String(parsed.currentCity).trim());
    }
    var idxRemoteScope = headers.indexOf("remoteRegionScope");
    if (idxRemoteScope !== -1) {
      sheet.getRange(rowNumber, idxRemoteScope + 1).setValue("remote_global");
    }
  }
}
