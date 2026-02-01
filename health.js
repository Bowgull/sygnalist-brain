/****************************************************
 * health.gs
 * Health checks (admin-only)
 *
 * Goals:
 * - Verify required secrets/config
 * - Verify required sheets/tables exist (and have headers)
 * - Verify we can write/read logs (permissions + sheet integrity)
 * - Verify lock + throttle mechanisms aren't broken
 * - Log a structured PASS/FAIL event
 ****************************************************/

function runHealthCheck_() {
  const ui = SpreadsheetApp.getUi();
  const started = Date.now();

  let report;
  try {
    report = runHealthCheckReport_();

    logEvent_({
      timestamp: Date.now(),
      profileId: null,
      action: "admin",
      source: "health_check",
      details: {
        level: "INFO",
        message: "Health check PASS",
        meta: report,
        version: Sygnalist_VERSION
      }
    });

    ui.alert(
      "Health Check: PASS\n\n" +
      summarizeHealthReport_(report)
    );

  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);

    // Best-effort: include partial report if available
    const meta = (report && typeof report === "object")
      ? report
      : { elapsedMs: Date.now() - started };

    logEvent_({
      timestamp: Date.now(),
      profileId: null,
      action: "admin",
      source: "health_check",
      details: {
        level: "ERROR",
        message: msg,
        meta: meta,
        version: Sygnalist_VERSION
      }
    });

    ui.alert("Health Check: FAIL\n\n" + msg);
  }
}

/**
 * Throws on failure; returns structured report on success.
 */
function runHealthCheckReport_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet.");

  const report = {
    spreadsheetId: ss.getId(),
    version: Sygnalist_VERSION,
    checks: [],
    elapsedMs: 0
  };

  const t0 = Date.now();

  // --- Secrets / Config ---
  report.checks.push(check_("OPENAI_API_KEY", () => {
    getAPIKey_("OPENAI_API_KEY"); // should throw if missing
    return { ok: true };
  }));

  report.checks.push(check_("CONFIG sanity", () => {
    if (!CONFIG) throw new Error("CONFIG missing.");
    if (!CONFIG.OPENAI_MODEL) throw new Error("CONFIG.OPENAI_MODEL missing.");
    if (typeof CONFIG.MIN_SCORE_FOR_INBOX !== "number") throw new Error("CONFIG.MIN_SCORE_FOR_INBOX must be a number.");
    if (typeof CONFIG.MAX_JOBS_PER_FETCH !== "number") throw new Error("CONFIG.MAX_JOBS_PER_FETCH must be a number.");
    return { ok: true, model: CONFIG.OPENAI_MODEL };
  }));

  // --- Required Sheets ---
  report.checks.push(check_("Sheets exist", () => {
    assertSheetExists_("Admin_Profiles");
    assertSheetExists_("📓 Logs");
    assertSheetExists_("📊 Admin_Analytics");
    assertSheetExists_("Engine_Inbox");
    assertSheetExists_("Engine_Tracker");
    return { ok: true };
  }));

  // --- Headers sanity ---
  report.checks.push(check_("Admin_Profiles headers", () => {
    const sh = assertSheetExists_("Admin_Profiles");
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
    if (!headers.includes("profileId")) throw new Error("Admin_Profiles missing header: profileId");
    if (!headers.includes("status")) throw new Error("Admin_Profiles missing header: status");
    if (!headers.includes("roleTracksJSON") && !headers.includes("roleTracks")) {
      // depending on your internal model, allow either
      throw new Error("Admin_Profiles missing header: roleTracksJSON (or roleTracks)");
    }
    return { ok: true, columns: headers.length };
  }));

  report.checks.push(check_("Engine tables headers", () => {
    // These are created by ensureEngineTables_()
    const inbox = assertSheetExists_("Engine_Inbox");
    const tracker = assertSheetExists_("Engine_Tracker");

    const inboxHeaders = inbox.getRange(1, 1, 1, inbox.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const trackerHeaders = tracker.getRange(1, 1, 1, tracker.getLastColumn()).getValues()[0].map(h => String(h).trim());

    if (!inboxHeaders.includes("profileId")) throw new Error("Engine_Inbox missing header: profileId");
    if (!inboxHeaders.includes("url")) throw new Error("Engine_Inbox missing header: url");
    if (!trackerHeaders.includes("profileId")) throw new Error("Engine_Tracker missing header: profileId");
    if (!trackerHeaders.includes("status")) throw new Error("Engine_Tracker missing header: status");

    return { ok: true };
  }));

  // --- Logging write sanity (best-effort) ---
  report.checks.push(check_("Logging write", () => {
    // We log a low-impact event and ensure it doesn't throw.
    logEvent_({
      timestamp: Date.now(),
      profileId: null,
      action: "admin",
      source: "health_check_probe",
      details: {
        level: "INFO",
        message: "Health check probe log",
        meta: { probe: true },
        version: Sygnalist_VERSION
      }
    });
    return { ok: true };
  }));

  // --- Lock service sanity ---
  report.checks.push(check_("LockService", () => {
    const lock = LockService.getScriptLock();
    const ok = lock.tryLock(1000);
    if (!ok) throw new Error("LockService busy (could not acquire within 1s).");
    lock.releaseLock();
    return { ok: true };
  }));

  // --- Throttle props sanity ---
  report.checks.push(check_("PropertiesService", () => {
    const props = PropertiesService.getScriptProperties();
    props.setProperty("health:lastRun", String(Date.now()));
    const v = props.getProperty("health:lastRun");
    if (!v) throw new Error("PropertiesService write/read failed.");
    return { ok: true };
  }));

  report.elapsedMs = Date.now() - t0;

  // If any check failed, throw the first failure (report still useful)
  const failed = report.checks.find(c => c.ok === false);
  if (failed) throw new Error(failed.name + " failed: " + failed.error);

  return report;
}

/**
 * Run a check and always return a structured row.
 */
function check_(name, fn) {
  const t0 = Date.now();
  try {
    const meta = fn() || {};
    return { name, ok: true, ms: Date.now() - t0, meta };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - t0, error: (e && e.message) ? e.message : String(e) };
  }
}

function summarizeHealthReport_(report) {
  const lines = [];
  lines.push(`Version: ${report.version}`);
  lines.push(`Elapsed: ${report.elapsedMs}ms`);
  lines.push("");

  for (const c of report.checks || []) {
    lines.push(`${c.ok ? "✅" : "❌"} ${c.name} (${c.ms}ms)` + (c.ok ? "" : ` — ${c.error}`));
  }
  return lines.join("\n");
}
