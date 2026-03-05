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
    var acceptRemote = data.acceptRemote === true || data.acceptRemote === "true";
    var acceptHybrid = data.acceptHybrid === true || data.acceptHybrid === "true";
    var acceptOnsite = data.acceptOnsite === true || data.acceptOnsite === "true";
    if (!acceptRemote && !acceptHybrid && !acceptOnsite) {
      acceptRemote = true;
    }
    var remoteRegionScope = String(data.remoteRegionScope || "remote_global").trim();
    if (remoteRegionScope !== "remote_preferred_countries_only") remoteRegionScope = "remote_global";
    var preferredCountriesRaw = data.preferredCountries;
    var preferredCountries = normalizePreferredCountries_(preferredCountriesRaw);
    if (preferredCountries.length === 0) {
      return { ok: false, error: "At least one preferred country (United States or Canada) is required." };
    }
    var preferredCities = String(data.preferredCities || "").trim();
    var currentCity = String(data.currentCity || "").trim();
    var distanceRangeKm = parseInt(data.distanceRangeKm, 10);
    if (isNaN(distanceRangeKm) || distanceRangeKm < 0) distanceRangeKm = 999;
    var salaryMin = parseInt(data.salaryMin, 10) || 0;
    var preferredLocations = String(data.preferredLocations || "").trim();
    if (!preferredLocations && preferredCountries.length) preferredLocations = preferredCountries.join(", ");

    if (!profileId || profileId.length < 2) {
      return { ok: false, error: "Profile ID must be at least 2 characters." };
    }
    if (profileId.length > 20) {
      return { ok: false, error: "Profile ID must be 20 characters or less." };
    }
    if (!displayName) {
      return { ok: false, error: "Display Name is required." };
    }

    var remotePreference = "remote_only";
    if (acceptOnsite && acceptHybrid && acceptRemote) remotePreference = "onsite_ok";
    else if (acceptHybrid && acceptRemote) remotePreference = "remote_or_hybrid";

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
      setByHeader_(headers, row, "acceptRemote", acceptRemote ? "TRUE" : "FALSE");
      setByHeader_(headers, row, "acceptHybrid", acceptHybrid ? "TRUE" : "FALSE");
      setByHeader_(headers, row, "acceptOnsite", acceptOnsite ? "TRUE" : "FALSE");
      setByHeader_(headers, row, "preferredCountries", preferredCountries.join(", "));
      setByHeader_(headers, row, "preferredCities", preferredCities);
      setByHeader_(headers, row, "currentCity", currentCity);
      setByHeader_(headers, row, "distanceRangeKm", distanceRangeKm);
      setByHeader_(headers, row, "remoteRegionScope", remoteRegionScope);
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

/**
 * Normalize preferred countries to only "United States" and/or "Canada".
 * @param {string|string[]} raw - Comma-separated string or array from client
 * @return {string[]} Array of "United States" and/or "Canada" (may be empty)
 */
function normalizePreferredCountries_(raw) {
  var list = [];
  if (Array.isArray(raw)) {
    list = raw.map(function (c) { return String(c || "").trim(); }).filter(Boolean);
  } else if (typeof raw === "string" && raw.trim()) {
    list = raw.split(",").map(function (c) { return c.trim(); }).filter(Boolean);
  }
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var v = list[i].toLowerCase();
    if (v === "united states" || v === "us" || v === "usa") {
      if (out.indexOf("United States") === -1) out.push("United States");
    } else if (v === "canada" || v === "ca") {
      if (out.indexOf("Canada") === -1) out.push("Canada");
    }
  }
  return out;
}
