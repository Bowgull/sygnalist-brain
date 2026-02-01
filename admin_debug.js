/****************************************************
 * admin_debug.gs
 * Admin-only debug helpers
 ****************************************************/

function debugListProfiles_() {
  const profiles = loadProfiles_();
  const msg = profiles.length
    ? profiles.map(p => `${p.profileId} — ${p.displayName} (${p.status})`).join("\n")
    : "No profiles yet.";
  SpreadsheetApp.getUi().alert(msg);
}

function debugOpenSkillProfileBuilder_() {
  openSkillProfileBuilder_();
}

function createProfileStub_() {
  const sheet = assertSheetExists_("Admin_Profiles");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!headers || headers.length < 5) {
    SpreadsheetApp.getUi().alert("Admin_Profiles headers missing. Paste row 1 first.");
    return;
  }

  const profileId = "p_" + Utilities.getUuid().slice(0, 8);
  const webAppUrl = ""; // fill after deploy

  const row = new Array(headers.length).fill("");

  setByHeader_(headers, row, "profileId", profileId);
  setByHeader_(headers, row, "displayName", "New Profile");
  setByHeader_(headers, row, "email", "");
  setByHeader_(headers, row, "status", "active");
  setByHeader_(headers, row, "salaryMin", 0);
  setByHeader_(headers, row, "remotePreference", "remote_only");
  setByHeader_(headers, row, "roleTracksJSON", "[]");
  setByHeader_(headers, row, "webAppUrl", webAppUrl);
  setByHeader_(headers, row, "isAdmin", "FALSE");

  sheet.appendRow(row);

  logEvent_({
    timestamp: Date.now(),
    profileId: profileId,
    action: "admin",
    source: "profiles",
    details: {
      level: "INFO",
      message: "Created profile stub",
      meta: { profileId },
      version: Sygnalist_VERSION
    }
  });

  SpreadsheetApp.getUi().alert(`✅ Created profile: ${profileId}\nGo fill in displayName + email + roleTracksJSON.`);
}

function setByHeader_(headers, row, key, value) {
  const idx = headers.indexOf(key);
  if (idx === -1) return;
  row[idx] = value;
}

/**
 * Quick profile inspector by profileId.
 * Useful after running Skill Profile Builder to confirm writeback.
 */
function debugInspectProfileRow_() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("Inspect Profile", "Enter profileId (e.g., p_1234abcd)", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const pid = String(res.getResponseText() || "").trim();
  if (!pid) return ui.alert("No profileId provided.");

  const sh = assertSheetExists_("Admin_Profiles");
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return ui.alert("Admin_Profiles is empty.");

  const headers = values[0].map(h => String(h).trim());
  const idxId = headers.indexOf("profileId");
  if (idxId === -1) return ui.alert("Admin_Profiles missing header: profileId");

  let row = null;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idxId] || "").trim() === pid) {
      row = values[r];
      break;
    }
  }
  if (!row) return ui.alert("Profile not found: " + pid);

  // Show key fields that matter for enrichment prompts
  const pick = (k) => {
    const i = headers.indexOf(k);
    return i === -1 ? "(missing column)" : String(row[i] || "");
  };

  const msg =
    `profileId: ${pid}\n` +
    `displayName: ${pick("displayName")}\n` +
    `status: ${pick("status")}\n\n` +
    `skillProfileText:\n${pick("skillProfileText").slice(0, 800)}\n\n` +
    `topSkills:\n${pick("topSkills").slice(0, 800)}\n\n` +
    `signatureStories:\n${pick("signatureStories").slice(0, 800)}`;

  ui.alert(msg);
}

function debugBootstrap_() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("Enter profileId", "Example: p_91917494", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const profileId = res.getResponseText().trim();
  try {
    const out = getProfileBootstrap_(profileId);
    ui.alert("✅ OK\n" + JSON.stringify(out, null, 2));
  } catch (e) {
    ui.alert("❌ ERROR\n" + e.message);
  }
}
