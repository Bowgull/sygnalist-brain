/**
 * Admin tools for Phase 2 testing (Tracker system of record).
 * This file should NOT contain real business logic.
 * It only calls the real engine entrypoints to prove they work.
 */

function adminInitEngineTables_() {
  ensureEngineTables_();
  SpreadsheetApp.getUi().alert("✅ Engine tables ready: Engine_Inbox + Engine_Tracker");
}

/** DEPRECATED: Debug menu only. */
function adminTestTrackerWrite_() {
  Logger.log("DEPRECATED: adminTestTrackerWrite_ called");
  const ui = SpreadsheetApp.getUi();

  const res = ui.prompt(
    "Enter profileId",
    "Example: josh, client1",
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const profileId = res.getResponseText().trim();

  // Validate profile + soft lock
  const profile = getProfileByIdOrThrow_(profileId);
  assertProfileActiveOrThrow_(profile);

  // Ensure engine tables exist
  ensureEngineTables_();

  // Fake enriched job (minimal fields required by buildTrackerEntryFromEnrichedJob_)
  const fakeEnrichedJob = {
    company: "TestCo",
    title: "Test Role",
    url: "https://example.com/test-role",
    source: "manual_test",
    location: "Remote",
    roleType: "cs",
    laneLabel: "Use CS lane",
    category: "Customer Success",
    jobSummary: "Test summary. This is a fake job.",
    whyFit: "- Test reason 1\n- Test reason 2\n- Test risk: none"
  };

  // Call the REAL promote flow (lock + throttle + dedupe + write + log)
  const out = promoteEnrichedJobToTracker_(profileId, fakeEnrichedJob);

  if (!out || out.ok !== true) {
    // promoteEnrichedJobToTracker_ returns uiError_() on known issues
    const msg = (out && out.message) ? out.message : "Unknown promote failure.";
    throw new Error(msg);
  }

  ui.alert("✅ Promote OK\nbatchId: " + out.batchId + "\nCheck Engine_Tracker tab.");
}

/** DEPRECATED: No callers. Remove when confirmed no triggers use it. */
function adminTestFilterTierGate_() {
  Logger.log("DEPRECATED: adminTestFilterTierGate_ called");
  const withS = filterTierGate_([{ tier: "S" }, { tier: "F" }]);
  if (withS.length !== 1 || String(withS[0].tier).toUpperCase() !== "S") {
    SpreadsheetApp.getUi().alert("FAIL: mixed S+F should return only S, got " + withS.length);
    return;
  }
  const onlyF = filterTierGate_([{ tier: "F" }, { tier: "F" }]);
  if (onlyF.length !== 2) {
    SpreadsheetApp.getUi().alert("FAIL: F-only list should be unchanged, got " + onlyF.length);
    return;
  }
  SpreadsheetApp.getUi().alert("✅ filterTierGate_ OK");
}
