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

  // Hard reset so NO stale cells block spill expansion
  sh.clear();
  sh.setFrozenRows(2);

  // Top header (rows 1–2 are reserved)
  sh.getRange(1, 1).setValue("📊 Admin Analytics");
  sh.getRange(1, 1).setFontWeight("bold");
  sh.getRange(1, 2).setValue("Version");
  sh.getRange(1, 3).setValue(Sygnalist_VERSION);
  sh.getRange(1, 5).setValue("Last Refresh");
  sh.getRange(1, 6).setValue(new Date());

  // ============================================================
  // SECTION ANCHORS (fixed rows so spills never collide)
  // ============================================================
  const A_PROFILE = 3;   // Per Profile block starts here
  const A_SOURCE  = 30;  // Per Source block
  const A_LANE    = 55;  // Per Lane block
  const A_DEBUG   = 85;  // Debug panel block

  // ============================================================
  // 1) Per Profile — Tracker Stats (+ conversion rates)
  // Engine_Tracker columns (from your engine_tables):
  // A profileId, H status
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

  sh.getRange(A_DEBUG + 3, 1).setFormula(
`=ARRAY_CONSTRAIN(
  SORT(
    FILTER(
      { '📓 Logs'!A:A, '📓 Logs'!B:B, '📓 Logs'!D:D, '📓 Logs'!E:E },
      '📓 Logs'!C:C="error"
    ),
    1, FALSE
  ),
  5, 4
)`
  );

  // 4.2 Last Fetch Per Profile (simple)
  sh.getRange(A_DEBUG + 1, 6).setValue("Last Fetch Per Profile");
  sh.getRange(A_DEBUG + 1, 6).setFontWeight("bold");
  sh.getRange(A_DEBUG + 2, 6, 1, 3).setValues([["profileId", "last_fetch_time", "source"]]);
  sh.getRange(A_DEBUG + 2, 6, 1, 3).setFontWeight("bold");

  sh.getRange(A_DEBUG + 3, 6).setFormula(
`=QUERY(
  '📓 Logs'!A:D,
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
  '📓 Logs'!A:C,
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
  '📓 Logs'!A:D,
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

  // Light formatting
  sh.autoResizeColumns(1, 12);

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

  SpreadsheetApp.getUi().alert("✅ Refreshed 📊 Admin_Analytics");
}

/****************************************************
 * helpers
 * Note: ensureSheet_() is now in core_utils.js
 ****************************************************/

function buildSectionTitle_(sh, row, title) {
  sh.getRange(row, 1).setValue(title);
  sh.getRange(row, 1).setFontWeight("bold");
}
