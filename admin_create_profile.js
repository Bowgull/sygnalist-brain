/****************************************************
 * admin_create_profile.js
 * Profile Creation Form (sidebar) - backend
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
 * Role track templates for common roles.
 */
var ROLE_TEMPLATES = {
  cs: {
    id: "cs",
    label: "Customer Success",
    roleKeywords: ["customer success", "csm", "client success", "customer success manager"],
    laneLabel: "CS Lane",
    priorityWeight: 1.0
  },
  impl: {
    id: "impl",
    label: "Implementation",
    roleKeywords: ["implementation", "onboarding", "solutions", "implementation specialist", "onboarding specialist"],
    laneLabel: "Impl Lane",
    priorityWeight: 1.0
  },
  support: {
    id: "support",
    label: "Support",
    roleKeywords: ["support", "technical support", "customer support", "support specialist", "help desk"],
    laneLabel: "Support Lane",
    priorityWeight: 0.9
  },
  am: {
    id: "am",
    label: "Account Management",
    roleKeywords: ["account manager", "account management", "account executive", "client manager"],
    laneLabel: "AM Lane",
    priorityWeight: 0.9
  },
  ops: {
    id: "ops",
    label: "Operations",
    roleKeywords: ["operations", "ops", "operations manager", "business operations"],
    laneLabel: "Ops Lane",
    priorityWeight: 0.8
  },
  pm: {
    id: "pm",
    label: "Project Management",
    roleKeywords: ["project manager", "project management", "program manager", "pmo"],
    laneLabel: "PM Lane",
    priorityWeight: 0.8
  }
};

/**
 * Create a profile from the sidebar form.
 * Called by the frontend.
 */
function createProfileFromForm_(data) {
  try {
    const profileId = String(data.profileId || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const displayName = String(data.displayName || "").trim();
    const email = String(data.email || "").trim();
    const remotePreference = String(data.remotePreference || "remote_only");
    const salaryMin = parseInt(data.salaryMin) || 0;
    const preferredLocations = String(data.preferredLocations || "").trim();
    const roles = Array.isArray(data.roles) ? data.roles : [];
    
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
    if (roles.length === 0) {
      return { ok: false, error: "Select at least one target role." };
    }
    
    // Check for duplicate
    const existingProfiles = loadProfiles_();
    if (existingProfiles.some(function(p) { return p.profileId === profileId; })) {
      return { ok: false, error: "Profile ID '" + profileId + "' already exists." };
    }
    
    // Build roleTracksJSON from selected roles
    var roleTracks = [];
    for (var i = 0; i < roles.length; i++) {
      var roleId = roles[i];
      if (ROLE_TEMPLATES[roleId]) {
        roleTracks.push(ROLE_TEMPLATES[roleId]);
      }
    }
    var roleTracksJSON = JSON.stringify(roleTracks);
    
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
    setByHeader_(headers, row, "roleTracksJSON", roleTracksJSON);
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
        message: "Profile created via form",
        meta: { profileId: profileId, displayName: displayName, roles: roles },
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
