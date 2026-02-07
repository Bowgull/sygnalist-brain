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

/**
 * List all profiles with their portal URLs.
 * Makes it easy to copy/share links with clients.
 */
function listProfileUrls_() {
  const profiles = loadProfiles_();
  const ui = SpreadsheetApp.getUi();
  
  if (!profiles.length) {
    ui.alert("No profiles yet.");
    return;
  }
  
  const baseUrl = CONFIG.WEB_APP_URL || "";
  
  const lines = profiles.map(p => {
    const url = p.webAppUrl || (baseUrl ? baseUrl + "?profile=" + p.profileId : "(no URL)");
    const status = p.status === "active" ? "✅" : "🔒";
    return `${status} ${p.profileId}\n   ${url}`;
  });
  
  ui.alert("📡 Profile Portal URLs\n\n" + lines.join("\n\n"));
}

function debugOpenSkillProfileBuilder_() {
  openSkillProfileBuilder_();
}

function createProfileStub_() {
  const ui = SpreadsheetApp.getUi();
  const sheet = assertSheetExists_("Admin_Profiles");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (!headers || headers.length < 5) {
    ui.alert("Admin_Profiles headers missing. Paste row 1 first.");
    return;
  }

  // Prompt for a simple profile ID
  const response = ui.prompt(
    "➕ Create Profile",
    "Enter a simple profile ID (lowercase, no spaces):\n\n" +
    "Examples: josh, sarah, client1, acme_corp",
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) {
    ui.alert("Cancelled.");
    return;
  }
  
  // Clean and validate the profile ID
  let profileId = String(response.getResponseText() || "").trim().toLowerCase();
  profileId = profileId.replace(/[^a-z0-9_-]/g, "_"); // Replace invalid chars with underscore
  
  if (!profileId || profileId.length < 2) {
    ui.alert("Profile ID must be at least 2 characters.");
    return;
  }
  
  if (profileId.length > 20) {
    ui.alert("Profile ID must be 20 characters or less.");
    return;
  }
  
  // Check for duplicates
  const existingProfiles = loadProfiles_();
  if (existingProfiles.some(p => p.profileId === profileId)) {
    ui.alert("Profile ID '" + profileId + "' already exists. Choose a different one.");
    return;
  }
  
  // Auto-generate the portal URL
  const webAppUrl = CONFIG.WEB_APP_URL 
    ? CONFIG.WEB_APP_URL + "?profile=" + profileId
    : "";

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
      meta: { profileId, webAppUrl },
      version: Sygnalist_VERSION
    }
  });

  // Show success dialog with copyable URL
  showProfileCreatedDialog_(profileId, webAppUrl);
}

/**
 * Show a dialog with the profile URL that's easy to copy.
 */
function showProfileCreatedDialog_(profileId, portalUrl) {
  const tpl = HtmlService.createTemplateFromFile("dialog_profile_created");
  tpl.profileId = profileId;
  tpl.portalUrl = portalUrl || "(URL not available - set WEB_APP_URL in config.js)";
  
  const html = tpl.evaluate()
    .setWidth(420)
    .setHeight(380);
  
  SpreadsheetApp.getUi().showModalDialog(html, "✅ Profile Created");
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
  const res = ui.prompt("Inspect Profile", "Enter profileId (e.g., josh, client1)", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const pid = String(res.getResponseText() || "").trim();
  if (!pid) return ui.alert("No profileId provided.");

  const sh = assertSheetExists_("Admin_Profiles");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return ui.alert("Admin_Profiles is empty.");
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
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
  const res = ui.prompt("Enter profileId", "Example: josh, client1", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const profileId = res.getResponseText().trim();
  try {
    const out = getProfileBootstrap_(profileId);
    ui.alert("✅ OK\n" + JSON.stringify(out, null, 2));
  } catch (e) {
    ui.alert("❌ ERROR\n" + e.message);
  }
}
