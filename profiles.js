function loadProfiles_() {
  const sheet = assertSheetExists_("Admin_Profiles");
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  const headers = values[0].map(String);
  const rows = values.slice(1);

  return rows
    .filter(r => String(r[0] || "").trim() !== "")
    .map(r => rowToProfile_(headers, r));
}

function getProfileById_(profileId) {
  const id = String(profileId || "").trim();
  if (!id) return null;

  const profiles = loadProfiles_();
  return profiles.find(p => p.profileId === id) || null;
}

function getProfileByIdOrThrow_(profileId) {
  const p = getProfileById_(profileId);
  if (!p) {
    const err = uiError_("INVALID_PROFILE", "Profile not found.");
    logEvent_({
      timestamp: Date.now(),
      profileId: null,
      action: "error",
      source: "profiles",
      details: {
        level: "ERROR",
        message: err.message,
        meta: { profileId: String(profileId || "") },
        version: Sygnalist_VERSION
      }
    });
    throw new Error(err.message);
  }
  return p;
}

function assertProfileActiveOrThrow_(profile) {
  if (!profile || profile.status === "active") return;

  const err = uiError_(
    "LOCKED_PROFILE",
    "Profile is locked: " + (profile.statusReason || "No reason set.")
  );

  logEvent_({
    timestamp: Date.now(),
    profileId: profile.profileId || null,
    action: "error",
    source: "profiles",
    details: {
      level: "WARN",
      message: err.message,
      meta: { status: profile.status, reason: profile.statusReason || "" },
      version: Sygnalist_VERSION
    }
  });

  throw new Error(err.message);
}

/** Known country strings (lowercase) for splitting preferredLocations into countries vs cities. */
var PREFERRED_LOCATION_COUNTRY_NAMES_ = [
  "united states", "usa", "us", "canada", "uk", "united kingdom", "germany", "france",
  "australia", "netherlands", "ireland", "spain", "italy", "mexico", "brazil", "india",
  "singapore", "japan", "new zealand", "sweden", "switzerland", "austria", "belgium",
  "portugal", "poland", "remote", "worldwide", "global", "anywhere"
];

function parseWorkPreferencesFromLegacy_(remotePreference) {
  const p = String(remotePreference || "remote_only").trim().toLowerCase();
  if (p === "remote_only") return { acceptRemote: true, acceptHybrid: false, acceptOnsite: false };
  if (p === "remote_or_hybrid" || p === "hybrid") return { acceptRemote: true, acceptHybrid: true, acceptOnsite: false };
  if (p === "onsite_ok" || p === "onsite") return { acceptRemote: true, acceptHybrid: true, acceptOnsite: true };
  return { acceptRemote: true, acceptHybrid: false, acceptOnsite: false };
}

function splitPreferredLocationsToCountriesAndCities_(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return { preferredCountries: [], preferredCities: [] };
  const countries = [];
  const cities = [];
  const countrySet = new Set(PREFERRED_LOCATION_COUNTRY_NAMES_);
  (arr || []).forEach(function (s) {
    const t = String(s || "").trim();
    if (!t) return;
    const lower = t.toLowerCase();
    if (countrySet.has(lower) || lower === "remote" || lower === "worldwide" || lower === "global" || lower === "anywhere") {
      if (lower !== "remote" && lower !== "worldwide" && lower !== "global" && lower !== "anywhere") countries.push(t);
    } else {
      cities.push(t);
    }
  });
  return { preferredCountries: countries, preferredCities: cities };
}

function rowToProfile_(headers, row) {
  const get = (key) => {
    const idx = headers.indexOf(key);
    return idx === -1 ? null : row[idx];
  };

  const preferredLocations = csvToArray_(get("preferredLocations"));
  const remotePreference = String(get("remotePreference") || "remote_only").trim();

  const acceptRemoteVal = get("acceptRemote");
  const acceptHybridVal = get("acceptHybrid");
  const acceptOnsiteVal = get("acceptOnsite");
  const hasWorkPrefColumns = acceptRemoteVal !== undefined && acceptRemoteVal !== null && acceptRemoteVal !== "";
  const workPref = hasWorkPrefColumns
    ? {
        acceptRemote: toBool_(acceptRemoteVal),
        acceptHybrid: toBool_(acceptHybridVal),
        acceptOnsite: toBool_(acceptOnsiteVal)
      }
    : parseWorkPreferencesFromLegacy_(remotePreference);

  const preferredCountriesCol = csvToArray_(get("preferredCountries"));
  const preferredCitiesCol = csvToArray_(get("preferredCities"));
  const hasLocationColumns = preferredCountriesCol.length > 0 || preferredCitiesCol.length > 0 ||
    (get("preferredCountries") !== null && String(get("preferredCountries") || "").trim() !== "") ||
    (get("preferredCities") !== null && String(get("preferredCities") || "").trim() !== "");
  const splitLoc = hasLocationColumns
    ? { preferredCountries: preferredCountriesCol, preferredCities: preferredCitiesCol }
    : splitPreferredLocationsToCountriesAndCities_(preferredLocations);
  if (splitLoc.preferredCountries.length === 0 && preferredLocations.length > 0) {
    splitLoc.preferredCountries = preferredLocations;
  }
  if (preferredLocations.length === 0 && (splitLoc.preferredCountries.length > 0 || splitLoc.preferredCities.length > 0)) {
    preferredLocations = splitLoc.preferredCountries.concat(splitLoc.preferredCities);
  }

  const currentCity = (function () {
    const v = get("currentCity");
    if (v != null && String(v).trim() !== "") return String(v).trim();
    return "";
  })();
  const remoteRegionScope = (function () {
    const v = get("remoteRegionScope");
    if (v != null && String(v).trim() !== "") return String(v).trim();
    return "remote_global";
  })();

  return {
    profileId: String(get("profileId") || "").trim(),
    displayName: String(get("displayName") || "").trim(),
    email: String(get("email") || "").trim(),

    status: String(get("status") || "active").trim(),
    statusReason: String(get("statusReason") || "").trim(),

    salaryMin: Number(get("salaryMin") || 0),
    preferredLocations: preferredLocations,
    locationBlacklist: csvToArray_(get("locationBlacklist")),
    remotePreference: remotePreference,

    acceptRemote: workPref.acceptRemote,
    acceptHybrid: workPref.acceptHybrid,
    acceptOnsite: workPref.acceptOnsite,
    preferredCountries: splitLoc.preferredCountries,
    preferredCities: splitLoc.preferredCities,
    currentCity: currentCity,
    remoteRegionScope: remoteRegionScope,

    bannedKeywords: csvToArray_(get("bannedKeywords")),
    disqualifyingSeniority: csvToArray_(get("disqualifyingSeniority")),

    allowSalesHeavy: toBool_(get("allowSalesHeavy")),
    allowPhoneHeavy: toBool_(get("allowPhoneHeavy")),
    allowWeekendWork: toBool_(get("allowWeekendWork")),
    allowShiftWork: toBool_(get("allowShiftWork")),

    skillKeywordsPlus: csvToArray_(get("skillKeywordsPlus")),
    skillKeywordsMinus: csvToArray_(get("skillKeywordsMinus")),

    skillProfileText: String(get("skillProfileText") || "").trim(),
    topSkills: csvToArray_(get("topSkills")),
    signatureStories: parseStories_(get("signatureStories")),

    roleTracks: parseRoleTracks_(get("roleTracksJSON")),
    laneControls: parseLaneControls_(get("laneControlsJSON")),

    portalSpreadsheetId: String(get("portalSpreadsheetId") || "").trim(),
    webAppUrl: String(get("webAppUrl") || "").trim(),
    isAdmin: toBool_(get("isAdmin")),
    clientCopyLink: String(get("clientCopyLink") || "").trim(),

    last_fetch_at: (function () {
      const v = get("last_fetch_at");
      if (v == null || v === "") return null;
      const s = String(v).trim();
      return s || null;
    })()
  };
}

/**
 * Update last_fetch_at for a profile (only call on successful fetch). Non-fatal: logs and returns on failure.
 */
function setProfileLastFetchAt_(profileId, isoString) {
  try {
    const pid = String(profileId || "").trim();
    if (!pid) return;

    const sh = assertSheetExists_("Admin_Profiles");
    const lastRow = sh.getLastRow();
    let lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return;

    const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = values[0].map(function (h) { return String(h || "").trim(); });
    const idxId = headers.indexOf("profileId");
    if (idxId === -1) return;

    let rowNum = -1;
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][idxId] || "").trim() === pid) {
        rowNum = r + 1;
        break;
      }
    }
    if (rowNum === -1) return;

    let colNum;
    const idxLastFetch = headers.indexOf("last_fetch_at");
    if (idxLastFetch === -1) {
      lastCol += 1;
      sh.getRange(1, lastCol).setValue("last_fetch_at");
      colNum = lastCol;
    } else {
      colNum = idxLastFetch + 1;
    }

    sh.getRange(rowNum, colNum).setValue(isoString);
  } catch (e) {
    if (typeof logEvent_ === "function") {
      logEvent_({
        timestamp: Date.now(),
        profileId: profileId || null,
        action: "error",
        source: "profiles",
        details: {
          level: "WARN",
          message: "Failed to update last scan",
          meta: { error: (e && e.message) ? e.message : String(e) },
          version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : ""
        }
      });
    }
  }
}
