/****************************************************
 * engine_tables.gs
 * Stability-first engine sheet ensure helpers
 *
 * SoT:
 * - Engine tables power portal reads
 * - “ensure” must actually ENSURE (create + heal)
 ****************************************************/

function ensureEngineTables_() {
  ensureEngineInboxSheet_();
  ensureEngineTrackerSheet_();
}

function ensureEngineInboxSheet_() {
  const sh = getOrCreateSheet_("Engine_Inbox");

  const wanted = [
    "profileId",
    "score","tier",
    "company","title","url","source","location",
    "roleType","laneLabel","category",
    "jobSummary","whyFit",
    "added_at"
  ];

  ensureHeaderRow_(sh, wanted);
}

function ensureEngineTrackerSheet_() {
  const sh = getOrCreateSheet_("Engine_Tracker");

  const wanted = [
    "profileId",
    "added_at",
    "company","title","url","source",
    "dateApplied","status",
    "location","roleType","laneLabel","category",
    "jobSummary","whyFit",
    "notes"
  ];

  ensureHeaderRow_(sh, wanted);
}

/****************************************************
 * helpers
 * Note: getOrCreateSheet_ is an alias for ensureSheet_ in core_utils.js
 ****************************************************/

function getOrCreateSheet_(name) {
  return ensureSheet_(name);
}

/**
 * Ensures row 1 matches the expected header list exactly.
 * - If sheet is empty: write headers
 * - If row 1 is wrong: rewrite row 1 only (data rows preserved)
 */
function ensureHeaderRow_(sh, wantedHeaders) {
  const lastRow = sh.getLastRow();
  const lastCol = Math.max(sh.getLastColumn(), wantedHeaders.length);

  if (lastRow === 0) {
    sh.getRange(1, 1, 1, wantedHeaders.length).setValues([wantedHeaders]);
    return;
  }

  const existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x || "").trim());
  const existingTrimmed = existing.slice(0, wantedHeaders.length);

  const matches = wantedHeaders.every((h, i) => String(existingTrimmed[i] || "").trim() === h);

  if (!matches) {
    sh.getRange(1, 1, 1, wantedHeaders.length).setValues([wantedHeaders]);
  }
}
