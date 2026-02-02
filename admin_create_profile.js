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
    
    // Get spreadsheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return { ok: false, error: "No active spreadsheet found." };
    }
    
    // Get or create Admin_Profiles sheet
    var sheet = ss.getSheetByName("Admin_Profiles");
    if (!sheet) {
      return { ok: false, error: "Admin_Profiles sheet not found." };
    }
    
    // Get headers
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) {
      return { ok: false, error: "Admin_Profiles has no columns." };
    }
    
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (!headers || headers.length < 5) {
      return { ok: false, error: "Admin_Profiles headers not set up correctly. Found: " + headers.length + " columns." };
    }
    
    // Check for duplicate (simple check without full profile parse)
    var profileIdColIdx = headers.indexOf("profileId");
    if (profileIdColIdx === -1) {
      return { ok: false, error: "Admin_Profiles missing 'profileId' header." };
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var existingIds = sheet.getRange(2, profileIdColIdx + 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < existingIds.length; i++) {
        if (String(existingIds[i][0] || "").trim() === profileId) {
          return { ok: false, error: "Profile ID '" + profileId + "' already exists." };
        }
      }
    }
    
    // Generate portal URL
    var portalUrl = "";
    if (typeof CONFIG !== "undefined" && CONFIG.WEB_APP_URL) {
      portalUrl = CONFIG.WEB_APP_URL + "?profile=" + profileId;
    }
    
    // Build row
    var row = new Array(headers.length).fill("");
    
    setByHeader_(headers, row, "profileId", profileId);
    setByHeader_(headers, row, "displayName", displayName);
    setByHeader_(headers, row, "email", email);
    setByHeader_(headers, row, "status", "active");
    setByHeader_(headers, row, "statusReason", "");
    setByHeader_(headers, row, "salaryMin", salaryMin);
    setByHeader_(headers, row, "preferredLocations", preferredLocations);
    setByHeader_(headers, row, "remotePreference", remotePreference);
    setByHeader_(headers, row, "roleTracksJSON", "[]");
    setByHeader_(headers, row, "webAppUrl", portalUrl);
    setByHeader_(headers, row, "isAdmin", "FALSE");
    
    sheet.appendRow(row);
    
    return {
      ok: true,
      profileId: profileId,
      portalUrl: portalUrl,
      version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "unknown"
    };
    
  } catch (e) {
    return { ok: false, error: "Error: " + (e.message || String(e)) };
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
