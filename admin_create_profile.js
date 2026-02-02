/****************************************************
 * admin_create_profile.js
 * Profile Creation Form (sidebar) - backend
 * 
 * Note: Target roles are set via the Skill Profile Builder,
 * not during initial profile creation.
 ****************************************************/

/**
 * Open the Create Profile sidebar.
 */
function openCreateProfileSidebar_() {
  const tpl = HtmlService.createTemplateFromFile("sidebar_create_profile");
  tpl.version = (typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "unknown");
  
  const html = tpl.evaluate()
    .setTitle("➕ Create Profile")
    .setWidth(320);
  
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Create a profile from the sidebar form.
 * Called by the frontend.
 */
function createProfileFromSidebar_(data) {
  try {
    const profileId = String(data.profileId || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const displayName = String(data.displayName || "").trim();
    const email = String(data.email || "").trim();
    const remotePreference = String(data.remotePreference || "remote_only");
    const salaryMin = parseInt(data.salaryMin) || 0;
    const preferredLocations = String(data.preferredLocations || "").trim();
    
    // Validation
    if (!profileId || profileId.length < 2) {
      return { ok: false, error: "Profile ID must be at least 2 characters." };
    }
    if (profileId.length > 20) {
      return { ok: false, error: "Profile ID must be 20 characters or less." };
    }
    if (!displayName) {
      return { ok: false, error: "Display Name is required." };
    }
    
    // Check for duplicate
    const existingProfiles = loadProfiles_();
    if (existingProfiles.some(function(p) { return p.profileId === profileId; })) {
      return { ok: false, error: "Profile ID '" + profileId + "' already exists." };
    }
    
    // Generate portal URL
    var portalUrl = "";
    if (CONFIG.WEB_APP_URL) {
      portalUrl = CONFIG.WEB_APP_URL + "?profile=" + profileId;
    }
    
    // Get sheet and headers
    var sheet = assertSheetExists_("Admin_Profiles");
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    if (!headers || headers.length < 5) {
      return { ok: false, error: "Admin_Profiles headers not set up correctly." };
    }
    
    // Build row (roleTracksJSON left empty - will be set by Skill Profile Builder)
    var row = new Array(headers.length).fill("");
    
    setByHeader_(headers, row, "profileId", profileId);
    setByHeader_(headers, row, "displayName", displayName);
    setByHeader_(headers, row, "email", email);
    setByHeader_(headers, row, "status", "active");
    setByHeader_(headers, row, "statusReason", "");
    setByHeader_(headers, row, "salaryMin", salaryMin);
    setByHeader_(headers, row, "preferredLocations", preferredLocations);
    setByHeader_(headers, row, "remotePreference", remotePreference);
    setByHeader_(headers, row, "roleTracksJSON", "[]"); // Empty - set via Skill Profile Builder
    setByHeader_(headers, row, "webAppUrl", portalUrl);
    setByHeader_(headers, row, "isAdmin", "FALSE");
    
    sheet.appendRow(row);
    
    // Log
    logEvent_({
      timestamp: Date.now(),
      profileId: profileId,
      action: "admin",
      source: "create_profile",
      details: {
        level: "INFO",
        message: "Profile created",
        meta: { profileId: profileId, displayName: displayName },
        version: Sygnalist_VERSION
      }
    });
    
    return {
      ok: true,
      profileId: profileId,
      portalUrl: portalUrl,
      version: Sygnalist_VERSION
    };
    
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Helper to set value by header name.
 */
function setByHeader_(headers, row, key, value) {
  var idx = headers.indexOf(key);
  if (idx !== -1) {
    row[idx] = value;
  }
}
