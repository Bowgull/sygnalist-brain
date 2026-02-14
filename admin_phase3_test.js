/** DEPRECATED: Debug menu only. */
function adminFetchJobsRawTest_() {
  Logger.log("DEPRECATED: adminFetchJobsRawTest_ called");
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("Fetch Raw Jobs", "Enter profileId (e.g. josh, client1)", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const profileId = res.getResponseText().trim();
  const out = fetchJobsRawForProfile_(profileId);

  if (!out || out.ok !== true) {
    const msg = out && out.message ? out.message : "Fetch failed.";
    ui.alert("❌ " + msg);
    return;
  }

  ui.alert(`✅ Fetch complete\nJobs written: ${out.count}\nbatchId: ${out.batchId}\nCheck Engine_Inbox tab.`);
}

/** DEPRECATED: Debug menu only. */
function adminClearInboxForProfile_() {
  Logger.log("DEPRECATED: adminClearInboxForProfile_ called");
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("Clear Inbox", "Enter profileId (e.g. josh, client1)", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const profileId = res.getResponseText().trim();
  const removed = clearEngineInboxForProfile_(profileId);
  ui.alert(`🧹 Cleared Engine_Inbox for ${profileId}\nRows removed: ${removed}`);
}
