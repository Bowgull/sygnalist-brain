function loadProfiles_() {
  const sheet = assertSheetExists_("Admin_Profiles");
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

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
  // If no profile provided, throw (defensive check)
  if (!profile) {
    throw new Error("assertProfileActiveOrThrow_: profile is null or undefined");
  }
  
  // If profile is active, allow through
  if (profile.status === "active") return;

  // Profile exists but is not active - throw with details
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

function rowToProfile_(headers, row) {
  const get = (key) => {
    const idx = headers.indexOf(key);
    return idx === -1 ? null : row[idx];
  };

  return {
    profileId: String(get("profileId") || "").trim(),
    displayName: String(get("displayName") || "").trim(),
    email: String(get("email") || "").trim(),

    status: String(get("status") || "active").trim(),
    statusReason: String(get("statusReason") || "").trim(),

    salaryMin: Number(get("salaryMin") || 0),
    preferredLocations: csvToArray_(get("preferredLocations")),
    locationBlacklist: csvToArray_(get("locationBlacklist")),
    remotePreference: String(get("remotePreference") || "remote_only").trim(),

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

    portalSpreadsheetId: String(get("portalSpreadsheetId") || "").trim(),
    webAppUrl: String(get("webAppUrl") || "").trim(),
    isAdmin: toBool_(get("isAdmin")),
    clientCopyLink: String(get("clientCopyLink") || "").trim()
  };
}
