/****************************************************
 * admin_analytics.gs
 * 📊 Admin_Analytics — formulas-first, fixed anchors, no spill collisions
 *
 * Source of Truth (Blueprint):
 * - Minimum metrics per profile / source / lane
 * - Debug panel: last errors, last fetch, last enrichment, last health check, soft-locked profiles
 * - Start with formulas (QUERY/PIVOT). computeAnalytics_ optional later.
 ****************************************************/

function refreshAdminAnalytics_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet_("📊 Admin_Analytics");

  sh.clear();
  sh.setFrozenRows(1);

  // ============================================================
  // ROW 1: Header
  // ============================================================
  sh.getRange(1, 1).setValue("📊 Admin Analytics");
  sh.getRange(1, 1).setFontWeight("bold").setFontSize(14);
  sh.getRange(1, 2).setValue("Version");
  sh.getRange(1, 3).setValue(Sygnalist_VERSION);
  sh.getRange(1, 5).setValue("Last Refresh");
  sh.getRange(1, 6).setValue(new Date());
  sh.getRange(1, 1, 1, 8).setBackground("#1a1f2e");

  // ============================================================
  // DASHBOARD ABOVE THE FOLD (rows 2–32)
  // Logs columns: A=emoji, B=time, C=Profile, D=Action, E=Source, F=Details
  // ============================================================
  var row = 2;

  // --- A) System Status ---
  buildSectionTitle_(sh, row++, "System Status");
  sh.getRange(row, 1).setValue("Engine version");
  sh.getRange(row, 2).setValue(Sygnalist_VERSION);
  row++;
  sh.getRange(row, 1).setValue("Last refresh");
  sh.getRange(row, 2).setValue(new Date());
  row++;
  sh.getRange(row, 1).setValue("Active profiles");
  sh.getRange(row, 2).setFormula("=IFERROR(QUERY(Admin_Profiles!A:D,\"select count(A) where D='active' label count(A) ''\",0),0)");
  row++;
  sh.getRange(row, 1).setValue("Locked profiles");
  sh.getRange(row, 2).setFormula("=IFERROR(QUERY(Admin_Profiles!A:D,\"select count(A) where D='inactive_soft_locked' label count(A) ''\",0),0)");
  sh.getRange(row, 2).setBackground("#fff3cd");
  row += 2;

  // --- B) Fetch Health (last run from Logs) ---
  buildSectionTitle_(sh, row++, "Fetch Health");
  sh.getRange(row, 1).setValue("Last fetch (any profile)");
  sh.getRange(row, 2).setFormula("=IFERROR(INDEX(QUERY('📓 Logs'!A2:G,\"select max(B) where D contains 'fetch' or E contains 'fetch'\",0),1,1),\"—\")");
  row++;
  sh.getRange(row, 1).setValue("Fetch events (recent)");
  sh.getRange(row, 2).setFormula("=IFERROR(COUNTIF('📓 Logs'!D2:D,\"fetch_enriched\")+COUNTIF('📓 Logs'!D2:D,\"fetch\"),0)");
  row += 2;

  // --- C) Enrichment Health ---
  buildSectionTitle_(sh, row++, "Enrichment Health");
  sh.getRange(row, 1).setValue("Enrich events (recent)");
  sh.getRange(row, 2).setFormula("=IFERROR(COUNTA(FILTER('📓 Logs'!D2:D,REGEXMATCH(LOWER('📓 Logs'!D2:D),\"enrich\"))),0)");
  row += 2;

  // --- D) Scoring / Feed Health (Engine_Inbox tier) ---
  buildSectionTitle_(sh, row++, "Scoring / Feed Health");
  sh.getRange(row, 1).setValue("S-tier (inbox)");
  sh.getRange(row, 2).setFormula("=IFERROR(SUMPRODUCT((Engine_Inbox!C:C=\"S\")*1),0)");
  sh.getRange(row, 2).setBackground("#d4edda");
  row++;
  sh.getRange(row, 1).setValue("A/B/C (inbox)");
  sh.getRange(row, 2).setFormula("=IFERROR(SUMPRODUCT((Engine_Inbox!C:C=\"A\")*1)+SUMPRODUCT((Engine_Inbox!C:C=\"B\")*1)+SUMPRODUCT((Engine_Inbox!C:C=\"C\")*1),0)");
  row++;
  sh.getRange(row, 1).setValue("F-tier (inbox)");
  sh.getRange(row, 2).setFormula("=IFERROR(SUMPRODUCT((Engine_Inbox!C:C=\"F\")*1),0)");
  sh.getRange(row, 2).setBackground("#f8d7da");
  row++;
  sh.getRange(row, 1).setValue("% F-tier");
  sh.getRange(row, 2).setFormula("=IFERROR(IF(COUNTA(Engine_Inbox!C2:C)=0,0,SUMPRODUCT((Engine_Inbox!C2:C=\"F\")*1)/COUNTA(Engine_Inbox!C2:C)*100),0)%");
  row += 2;

  // --- E) Top Alerts (Last 5 Errors) — filter on Action D or Level G; show "No recent errors found" when none ---
  buildSectionTitle_(sh, row++, "Top Alerts (Last 5 Errors)");
  sh.getRange(row, 1, 1, 4).setValues([["Time", "Profile", "Source", "Summary"]]);
  sh.getRange(row, 1, 1, 4).setFontWeight("bold");
  row++;
  // Logs: A=emoji, B=time, C=Profile, D=Action, E=Source, F=Details, G=Level
  sh.getRange(row, 1).setFormula(
    "=IF(COUNTIF('📓 Logs'!D2:D,\"error\")+COUNTIF('📓 Logs'!G2:G,\"ERROR\")=0,\"No recent errors found\",IFERROR(QUERY('📓 Logs'!A2:G,\"select B,C,E,F where D='error' or G='ERROR' order by B desc limit 5\",0),\"No recent errors found\"))"
  );
  row += 6;

  // ============================================================
  // SECTION ANCHORS (below the fold)
  // ============================================================
  const A_PROFILE = row;
  const A_SOURCE  = A_PROFILE + 27;
  const A_LANE    = A_SOURCE + 25;
  const A_DEBUG   = A_LANE + 30;

  // ============================================================
  // 1) Per Profile — Tracker Stats (+ conversion rates)
  // ============================================================
  buildSectionTitle_(sh, A_PROFILE, "Per Profile — Tracker Stats (Conversion)");

  // Table header (static, no spill)
  sh.getRange(A_PROFILE + 1, 1, 1, 7).setValues([[
    "profileId",
    "jobs_in_tracker",
    "applications",
    "interviews",
    "offers_or_hires",
    "application_rate",
    "interview_rate"
  ]]);
  sh.getRange(A_PROFILE + 1, 1, 1, 7).setFontWeight("bold");

  // One spill ONLY: QUERY returns full table incl. rates
  sh.getRange(A_PROFILE + 2, 1).setFormula(
`=QUERY(
  {
    Engine_Tracker!A2:A,
    Engine_Tracker!H2:H,
    ARRAYFORMULA(IF(Engine_Tracker!A2:A="",, IF(REGEXMATCH(LOWER(Engine_Tracker!H2:H),"applied"),1,0))),
    ARRAYFORMULA(IF(Engine_Tracker!A2:A="",, IF(REGEXMATCH(LOWER(Engine_Tracker!H2:H),"interview"),1,0))),
    ARRAYFORMULA(IF(Engine_Tracker!A2:A="",, IF(REGEXMATCH(LOWER(Engine_Tracker!H2:H),"offer|hired"),1,0)))
  },
  "select Col1,
          count(Col1),
          sum(Col3),
          sum(Col4),
          sum(Col5),
          (sum(Col3)/count(Col1)),
          (sum(Col4)/count(Col1))
   where Col1 is not null
   group by Col1
   label count(Col1) 'jobs_in_tracker',
         sum(Col3) 'applications',
         sum(Col4) 'interviews',
         sum(Col5) 'offers_or_hires',
         (sum(Col3)/count(Col1)) 'application_rate',
         (sum(Col4)/count(Col1)) 'interview_rate'",
  0
)`
  );

  // ============================================================
  // 2) Per Source — Inbox Stats (count, avg score, tier buckets)
  // Engine_Inbox columns:
  // B score, C tier, G source
  // ============================================================
  buildSectionTitle_(sh, A_SOURCE, "Per Source — Inbox Stats");

  sh.getRange(A_SOURCE + 1, 1, 1, 5).setValues([[
    "source",
    "jobs_in_inbox",
    "avg_score",
    "tier_SA_count",
    "tier_BC_count"
  ]]);
  sh.getRange(A_SOURCE + 1, 1, 1, 5).setFontWeight("bold");

  sh.getRange(A_SOURCE + 2, 1).setFormula(
`=QUERY(
  {
    Engine_Inbox!G2:G,
    Engine_Inbox!B2:B,
    Engine_Inbox!C2:C,
    ARRAYFORMULA(IF(Engine_Inbox!G2:G="",, IF(Engine_Inbox!C2:C="S",1,0))),
    ARRAYFORMULA(IF(Engine_Inbox!G2:G="",, IF(Engine_Inbox!C2:C="A",1,0))),
    ARRAYFORMULA(IF(Engine_Inbox!G2:G="",, IF(Engine_Inbox!C2:C="B",1,0))),
    ARRAYFORMULA(IF(Engine_Inbox!G2:G="",, IF(Engine_Inbox!C2:C="C",1,0)))
  },
  "select Col1,
          count(Col1),
          avg(Col2),
          (sum(Col4)+sum(Col5)),
          (sum(Col6)+sum(Col7))
   where Col1 is not null
   group by Col1
   label count(Col1) 'jobs_in_inbox',
         avg(Col2) 'avg_score',
         (sum(Col4)+sum(Col5)) 'tier_SA_count',
         (sum(Col6)+sum(Col7)) 'tier_BC_count'",
  0
)`
  );

  // ============================================================
  // 3) Per Lane — Inbox Tier Distribution + Tracker Lane Counts
  // Engine_Inbox: J laneLabel, C tier
  // Engine_Tracker: K laneLabel
  // ============================================================
  buildSectionTitle_(sh, A_LANE, "Per Lane — Inbox Tier Distribution + Tracker Lane Counts");

  // Left table: inbox lane distribution
  sh.getRange(A_LANE + 1, 1, 1, 7).setValues([[
    "laneLabel",
    "jobs_in_inbox",
    "tier_S",
    "tier_A",
    "tier_B",
    "tier_C",
    "tier_F"
  ]]);
  sh.getRange(A_LANE + 1, 1, 1, 7).setFontWeight("bold");

  sh.getRange(A_LANE + 2, 1).setFormula(
`=QUERY(
  {
    Engine_Inbox!J2:J,
    Engine_Inbox!C2:C,
    ARRAYFORMULA(IF(Engine_Inbox!J2:J="",, IF(Engine_Inbox!C2:C="S",1,0))),
    ARRAYFORMULA(IF(Engine_Inbox!J2:J="",, IF(Engine_Inbox!C2:C="A",1,0))),
    ARRAYFORMULA(IF(Engine_Inbox!J2:J="",, IF(Engine_Inbox!C2:C="B",1,0))),
    ARRAYFORMULA(IF(Engine_Inbox!J2:J="",, IF(Engine_Inbox!C2:C="C",1,0))),
    ARRAYFORMULA(IF(Engine_Inbox!J2:J="",, IF(Engine_Inbox!C2:C="F",1,0)))
  },
  "select Col1,
          count(Col1),
          sum(Col3),
          sum(Col4),
          sum(Col5),
          sum(Col6),
          sum(Col7)
   where Col1 is not null
   group by Col1
   label count(Col1) 'jobs_in_inbox',
         sum(Col3) 'tier_S',
         sum(Col4) 'tier_A',
         sum(Col5) 'tier_B',
         sum(Col6) 'tier_C',
         sum(Col7) 'tier_F'",
  0
)`
  );

  // Right table: tracker lane counts
  sh.getRange(A_LANE + 1, 9, 1, 2).setValues([["laneLabel", "jobs_in_tracker"]]);
  sh.getRange(A_LANE + 1, 9, 1, 2).setFontWeight("bold");

  sh.getRange(A_LANE + 2, 9).setFormula(
`=QUERY(
  Engine_Tracker!K2:K,
  "select Col1, count(Col1)
   where Col1 is not null
   group by Col1
   label count(Col1) 'jobs_in_tracker'",
  0
)`
  );

  // ============================================================
  // 4) Debug Panel (Blueprint-required)
  // Logs assumed: '📓 Logs' columns A timestamp, B profileId, C action, D source, E details
  // Admin_Profiles assumed includes status + statusReason
  // ============================================================
  buildSectionTitle_(sh, A_DEBUG, "Debug Panel");

  // 4.1 Last 5 Errors
  sh.getRange(A_DEBUG + 1, 1).setValue("Last 5 Errors");
  sh.getRange(A_DEBUG + 1, 1).setFontWeight("bold");
  sh.getRange(A_DEBUG + 2, 1, 1, 4).setValues([["timestamp", "profileId", "source", "details"]]);
  sh.getRange(A_DEBUG + 2, 1, 1, 4).setFontWeight("bold");

  // Logs: A=emoji, B=time, C=Profile, D=Action, E=Source, F=Details, G=Level
  sh.getRange(A_DEBUG + 3, 1).setFormula(
    "=IF(COUNTIF('📓 Logs'!D2:D,\"error\")+COUNTIF('📓 Logs'!G2:G,\"ERROR\")=0,\"No recent errors found\",IFERROR(QUERY('📓 Logs'!A2:G,\"select B,C,E,F where D='error' or G='ERROR' order by B desc limit 5\",0),\"No recent errors found\"))"
  );

  // 4.2 Last Fetch Per Profile (simple)
  sh.getRange(A_DEBUG + 1, 6).setValue("Last Scan Per Profile");
  sh.getRange(A_DEBUG + 1, 6).setFontWeight("bold");
  sh.getRange(A_DEBUG + 2, 6, 1, 3).setValues([["profileId", "last_fetch_time", "source"]]);
  sh.getRange(A_DEBUG + 2, 6, 1, 3).setFontWeight("bold");

  sh.getRange(A_DEBUG + 3, 6).setFormula(
`=QUERY(
  '📓 Logs'!A2:D,
  "select B, max(A), D
   where C='fetch'
   group by B, D
   label max(A) 'last_fetch_time'",
  1
)`
  );

  // 4.3 Last Enrichment Per Profile
  sh.getRange(A_DEBUG + 10, 1).setValue("Last Enrichment Per Profile");
  sh.getRange(A_DEBUG + 10, 1).setFontWeight("bold");
  sh.getRange(A_DEBUG + 11, 1, 1, 2).setValues([["profileId", "last_enrich_time"]]);
  sh.getRange(A_DEBUG + 11, 1, 1, 2).setFontWeight("bold");

  sh.getRange(A_DEBUG + 12, 1).setFormula(
`=QUERY(
  '📓 Logs'!A2:C,
  "select B, max(A)
   where C='enrich'
   group by B
   label max(A) 'last_enrich_time'",
  1
)`
  );

  // 4.4 Last Health Check
  sh.getRange(A_DEBUG + 10, 6).setValue("Last Health Check");
  sh.getRange(A_DEBUG + 10, 6).setFontWeight("bold");
  sh.getRange(A_DEBUG + 11, 6, 1, 2).setValues([["timestamp", "source"]]);
  sh.getRange(A_DEBUG + 11, 6, 1, 2).setFontWeight("bold");

  sh.getRange(A_DEBUG + 12, 6).setFormula(
`=QUERY(
  '📓 Logs'!A2:D,
  "select max(A), max(D)
   where D='health_check' or D='health_check_probe'
   label max(A) 'timestamp', max(D) 'source'",
  0
)`
  );

  // 4.5 Soft-Locked Profiles
  sh.getRange(A_DEBUG + 18, 1).setValue("Soft-Locked Profiles");
  sh.getRange(A_DEBUG + 18, 1).setFontWeight("bold");
  sh.getRange(A_DEBUG + 19, 1, 1, 3).setValues([["profileId", "displayName", "statusReason"]]);
  sh.getRange(A_DEBUG + 19, 1, 1, 3).setFontWeight("bold");

  // NOTE: This assumes Admin_Profiles columns A,B,D,E are profileId, displayName, status, statusReason (common in your engine)
  // If your header order differs, we can switch this to a header-indexed array build later.
  sh.getRange(A_DEBUG + 20, 1).setFormula(
`=QUERY(
  Admin_Profiles!A:Z,
  "select A, B, E
   where D='inactive_soft_locked'
   label A 'profileId', B 'displayName', E 'statusReason'",
  1
)`
  );

  try {
    if (sh && sh.getLastRow() >= 1) formatAdminAnalytics_(sh);
  } catch (err) { /* format optional; safe when run from web app */ }

  logEvent_({
    timestamp: Date.now(),
    profileId: null,
    action: "admin",
    source: "admin_analytics",
    details: {
      level: "INFO",
      message: "Admin analytics refreshed",
      meta: { sheet: "📊 Admin_Analytics" },
      version: Sygnalist_VERSION
    }
  });

  try { formatAdminProfilesSheet_(); } catch (e) { /* optional */ }
  try { ensureAdminProfilesView_(); } catch (e) { /* optional */ }
}

/****************************************************
 * helpers
 * Note: ensureSheet_() is now in core_utils.js
 ****************************************************/

function buildSectionTitle_(sh, row, title) {
  sh.getRange(row, 1).setValue(title);
  sh.getRange(row, 1).setFontWeight("bold");
  sh.getRange(row, 1, row, 8).setBackground("#e9ecef");
}

/**
 * Compute analytics for admin UI (no sheet write). One read per sheet; returns KPIs and chart data.
 */
function getAdminAnalyticsForUI_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sevenDays = 7 * 24 * 60 * 60 * 1000;
  var now = Date.now();

  var kpis = {
    activeProfiles: 0,
    lockedProfiles: 0,
    lastFetchTime: null,
    fetchEventsRecent: 0,
    enrichEventsRecent: 0,
    inboxTotal: 0,
    trackerTotal: 0,
    addedThisWeek: 0,
    sTier: 0,
    aTier: 0,
    bTier: 0,
    cTier: 0,
    fTier: 0,
    pctFTier: 0
  };
  var tierDistribution = { S: 0, A: 0, B: 0, C: 0, F: 0 };
  var byStatus = {};
  var topErrors = [];

  var profiles = [];
  try {
    profiles = loadProfiles_();
  } catch (e) { /* ignore */ }
  for (var i = 0; i < profiles.length; i++) {
    var s = String(profiles[i].status || "").trim();
    if (s === "active") kpis.activeProfiles++;
    else if (s === "inactive_soft_locked") kpis.lockedProfiles++;
  }

  function headerIndex(headers, names) {
    for (var n = 0; n < names.length; n++) {
      var idx = -1;
      for (var h = 0; h < headers.length; h++) {
        if (String(headers[h] || "").trim().toLowerCase() === names[n]) { idx = h; break; }
      }
      if (idx !== -1) return idx;
    }
    return -1;
  }

  var shInbox = ss.getSheetByName("Engine_Inbox");
  if (shInbox && shInbox.getLastRow() >= 2) {
    var lastRow = shInbox.getLastRow();
    var lastCol = Math.min(shInbox.getLastColumn(), 20);
    var inboxValues = shInbox.getRange(1, 1, lastRow, lastCol).getValues();
    var inboxHeaders = inboxValues[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
    var idxProfile = headerIndex(inboxValues[0].map(function(h) { return String(h || "").trim(); }), ["profileId", "profile_id"]);
    var idxTier = headerIndex(inboxValues[0].map(function(h) { return String(h || "").trim(); }), ["tier"]);
    var idxAdded = headerIndex(inboxValues[0].map(function(h) { return String(h || "").trim(); }), ["added_at", "addedat"]);
    for (var r = 1; r < inboxValues.length; r++) {
      var row = inboxValues[r];
      if (idxProfile >= 0 && !String(row[idxProfile] || "").trim()) continue;
      kpis.inboxTotal++;
      var tier = String(row[idxTier] || "").trim().toUpperCase();
      if (tier === "S") { kpis.sTier++; tierDistribution.S++; }
      else if (tier === "A") { kpis.aTier++; tierDistribution.A++; }
      else if (tier === "B") { kpis.bTier++; tierDistribution.B++; }
      else if (tier === "C") { kpis.cTier++; tierDistribution.C++; }
      else if (tier === "F") { kpis.fTier++; tierDistribution.F++; }
      if (idxAdded >= 0 && row[idxAdded]) {
        var t = row[idxAdded] instanceof Date ? row[idxAdded].getTime() : new Date(row[idxAdded]).getTime();
        if (!isNaN(t) && (now - t) < sevenDays) kpis.addedThisWeek++;
      }
    }
    if (kpis.inboxTotal > 0) kpis.pctFTier = Math.round((kpis.fTier / kpis.inboxTotal) * 100);
  }

  var shTracker = ss.getSheetByName("Engine_Tracker");
  if (shTracker && shTracker.getLastRow() >= 2) {
    lastRow = shTracker.getLastRow();
    lastCol = Math.min(shTracker.getLastColumn(), 20);
    var trackerValues = shTracker.getRange(1, 1, lastRow, lastCol).getValues();
    idxProfile = headerIndex(trackerValues[0].map(function(h) { return String(h || "").trim(); }), ["profileId", "profile_id"]);
    var idxStatus = headerIndex(trackerValues[0].map(function(h) { return String(h || "").trim(); }), ["status"]);
    idxAdded = headerIndex(trackerValues[0].map(function(h) { return String(h || "").trim(); }), ["added_at", "addedat"]);
    for (var r = 1; r < trackerValues.length; r++) {
      var row = trackerValues[r];
      if (idxProfile >= 0 && !String(row[idxProfile] || "").trim()) continue;
      kpis.trackerTotal++;
      var status = String(row[idxStatus] || "").trim();
      if (status) {
        byStatus[status] = (byStatus[status] || 0) + 1;
      }
      if (idxAdded >= 0 && row[idxAdded]) {
        var t = row[idxAdded] instanceof Date ? row[idxAdded].getTime() : new Date(row[idxAdded]).getTime();
        if (!isNaN(t) && (now - t) < sevenDays) kpis.addedThisWeek++;
      }
    }
  }

  var shLogs = ss.getSheetByName("📓 Logs");
  if (shLogs && shLogs.getLastRow() >= 2) {
    lastRow = shLogs.getLastRow();
    var startRow = Math.max(2, lastRow - 499);
    var logValues = shLogs.getRange(startRow, 1, lastRow, 7).getValues();
    var maxFetchTime = null;
    for (var i = 0; i < logValues.length; i++) {
      var row = logValues[i];
      var timeVal = row[1];
      var action = String(row[3] || "").toLowerCase();
      var source = String(row[4] || "").toLowerCase();
      var level = String(row[6] || "").toUpperCase();
      var isFetch = (action.indexOf("fetch") !== -1 || source.indexOf("fetch") !== -1);
      var isEnrich = (action.indexOf("enrich") !== -1 || source.indexOf("enrich") !== -1);
      var isError = (action === "error" || level === "ERROR");
      if (isFetch) {
        kpis.fetchEventsRecent++;
        if (timeVal) {
          var ts = timeVal instanceof Date ? timeVal.getTime() : new Date(timeVal).getTime();
          if (!isNaN(ts) && (!maxFetchTime || ts > maxFetchTime)) maxFetchTime = ts;
        }
      }
      if (isEnrich) kpis.enrichEventsRecent++;
      if (isError) {
        topErrors.push({
          time: timeVal ? (timeVal instanceof Date ? timeVal.toISOString() : String(timeVal)) : "—",
          profile: String(row[2] || "—"),
          source: String(row[4] || "—"),
          summary: String(row[5] || "").slice(0, 80)
        });
      }
    }
    if (maxFetchTime) kpis.lastFetchTime = maxFetchTime;
    topErrors.sort(function(a, b) {
      var ta = new Date(a.time).getTime();
      var tb = new Date(b.time).getTime();
      return isNaN(tb) ? -1 : (isNaN(ta) ? 1 : tb - ta);
    });
    topErrors = topErrors.slice(0, 5);
  }

  return { kpis: kpis, tierDistribution: tierDistribution, byStatus: byStatus, topErrors: topErrors };
}

/**
 * Compute admin dashboard globals for metrics tiles (no sheet write).
 * Returns only the fields needed for the right-side metric tiles when viewer is admin.
 */
function getAdminDashboardGlobals_() {
  var cacheKey = 'admin_dashboard_globals';
  var ttlSeconds = 45;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && typeof parsed.inboxCountAll === 'number') return parsed;
    }
  } catch (e) { /* ignore cache errors */ }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sevenDays = 7 * 24 * 60 * 60 * 1000;
  var now = Date.now();
  var out = {
    inboxCountAll: 0,
    trackerCountAll: 0,
    byStatusAll: {},
    addedLast7All: 0,
    jobsNeedingEnrichment: 0,
    activeProfiles: 0,
    lockedProfiles: 0,
    recentErrorsCount: 0
  };

  var profiles = [];
  try {
    profiles = loadProfiles_();
  } catch (e) { /* ignore */ }
  for (var i = 0; i < profiles.length; i++) {
    var s = String(profiles[i].status || "").trim();
    if (s === "active") out.activeProfiles++;
    else if (s === "inactive_soft_locked") out.lockedProfiles++;
  }

  try {
    var needRows = readJobsInbox_(["NEW", "NEEDS_ENRICHMENT"]);
    out.jobsNeedingEnrichment = needRows ? needRows.length : 0;
  } catch (e) {
    out.jobsNeedingEnrichment = 0;
  }

  function headerIndex(headers, names) {
    for (var n = 0; n < names.length; n++) {
      var idx = -1;
      for (var h = 0; h < headers.length; h++) {
        if (String(headers[h] || "").trim().toLowerCase() === names[n]) { idx = h; break; }
      }
      if (idx !== -1) return idx;
    }
    return -1;
  }

  var shInbox = ss.getSheetByName("Engine_Inbox");
  if (shInbox && shInbox.getLastRow() >= 2) {
    var lastRow = shInbox.getLastRow();
    var lastCol = Math.min(shInbox.getLastColumn(), 20);
    var inboxValues = shInbox.getRange(1, 1, lastRow, lastCol).getValues();
    var idxProfile = headerIndex(inboxValues[0].map(function(h) { return String(h || "").trim(); }), ["profileId", "profile_id"]);
    var idxAdded = headerIndex(inboxValues[0].map(function(h) { return String(h || "").trim(); }), ["added_at", "addedat"]);
    for (var r = 1; r < inboxValues.length; r++) {
      var row = inboxValues[r];
      if (idxProfile >= 0 && !String(row[idxProfile] || "").trim()) continue;
      out.inboxCountAll++;
      if (idxAdded >= 0 && row[idxAdded]) {
        var t = row[idxAdded] instanceof Date ? row[idxAdded].getTime() : new Date(row[idxAdded]).getTime();
        if (!isNaN(t) && (now - t) < sevenDays) out.addedLast7All++;
      }
    }
  }

  var shTracker = ss.getSheetByName("Engine_Tracker");
  if (shTracker && shTracker.getLastRow() >= 2) {
    lastRow = shTracker.getLastRow();
    lastCol = Math.min(shTracker.getLastColumn(), 20);
    var trackerValues = shTracker.getRange(1, 1, lastRow, lastCol).getValues();
    var idxProfile = headerIndex(trackerValues[0].map(function(h) { return String(h || "").trim(); }), ["profileId", "profile_id"]);
    var idxStatus = headerIndex(trackerValues[0].map(function(h) { return String(h || "").trim(); }), ["status"]);
    var idxAdded = headerIndex(trackerValues[0].map(function(h) { return String(h || "").trim(); }), ["added_at", "addedat"]);
    for (var r = 1; r < trackerValues.length; r++) {
      var row = trackerValues[r];
      if (idxProfile >= 0 && !String(row[idxProfile] || "").trim()) continue;
      out.trackerCountAll++;
      var status = String(row[idxStatus] || "").trim();
      if (status) out.byStatusAll[status] = (out.byStatusAll[status] || 0) + 1;
      if (idxAdded >= 0 && row[idxAdded]) {
        var t = row[idxAdded] instanceof Date ? row[idxAdded].getTime() : new Date(row[idxAdded]).getTime();
        if (!isNaN(t) && (now - t) < sevenDays) out.addedLast7All++;
      }
    }
  }

  var shLogs = ss.getSheetByName("📓 Logs");
  if (shLogs && shLogs.getLastRow() >= 2) {
    lastRow = shLogs.getLastRow();
    var startRow = Math.max(2, lastRow - 99);
    var logValues = shLogs.getRange(startRow, 1, lastRow, 7).getValues();
    for (var i = 0; i < logValues.length; i++) {
      var row = logValues[i];
      var action = String(row[3] || "").toLowerCase();
      var level = String(row[6] || "").toUpperCase();
      if (action === "error" || level === "ERROR") out.recentErrorsCount++;
    }
  }

  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(out), ttlSeconds);
  } catch (e) { /* ignore */ }
  return out;
}
