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
 * 
 * NOTE: No trailing underscore - must be callable from client via google.script.run
 */
function createProfileFromSidebar(data) {
  try {
    var profileId = String(data.profileId || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    var displayName = String(data.displayName || "").trim();
    var email = String(data.email || "").trim();
    var remotePreference = String(data.remotePreference || "remote_only");
    var salaryMin = parseInt(data.salaryMin, 10) || 0;
    var preferredLocations = String(data.preferredLocations || "").trim();

    if (!profileId || profileId.length < 2) {
      return { ok: false, error: "Profile ID must be at least 2 characters." };
    }
    if (profileId.length > 20) {
      return { ok: false, error: "Profile ID must be 20 characters or less." };
    }
    if (!displayName) {
      return { ok: false, error: "Display Name is required." };
    }

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
      return { ok: false, error: "System busy. Try again in a moment." };
    }
    try {
      var sheet = ensureSheet_("Admin_Profiles");
      var lastCol = sheet.getLastColumn();
      if (lastCol < 1) {
        return { ok: false, error: "Admin_Profiles has no columns. Add a header row first." };
      }

      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      if (!headers || headers.length < 5) {
        return { ok: false, error: "Admin_Profiles headers not set up correctly. Found: " + (headers ? headers.length : 0) + " columns." };
      }

      var profileIdColIdx = headers.indexOf("profileId");
      if (profileIdColIdx === -1) {
        return { ok: false, error: "Admin_Profiles missing 'profileId' header." };
      }

      var lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        var existingIds = sheet.getRange(2, profileIdColIdx + 1, lastRow, profileIdColIdx + 1).getValues();
        for (var i = 0; i < existingIds.length; i++) {
          if (String(existingIds[i][0] || "").trim() === profileId) {
            return { ok: false, error: "Profile ID '" + profileId + "' already exists." };
          }
        }
      }

      var portalUrl = (typeof CONFIG !== "undefined" && CONFIG.WEB_APP_URL)
        ? CONFIG.WEB_APP_URL + "?profile=" + profileId
        : "";

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

      logEvent_({
        timestamp: Date.now(),
        profileId: profileId,
        action: "admin",
        source: "admin_create_profile",
        details: {
          level: "INFO",
          message: "Profile created",
          meta: { profileId: profileId },
          version: Sygnalist_VERSION
        }
      });

      return {
        ok: true,
        profileId: profileId,
        portalUrl: portalUrl,
        version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "unknown"
      };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { ok: false, error: "Error: " + (e.message || String(e)) };
  }
}

// setByHeader_ is in core_utils.js (shared)
