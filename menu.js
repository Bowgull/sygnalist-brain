/****************************************************
 * menu.gs
 * Sygnalist menu (Admin)
 ****************************************************/

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📡 Sygnalist")

    // Health / Ops
    .addItem("🧪 Health Check", "runHealthCheck_")
    .addItem("📊 Refresh Admin Analytics", "refreshAdminAnalytics_")
    .addItem("📤 Export Logs ", "exportLogsToPrettySheet_")
    .addSeparator()

    // Profile admin
    .addItem("🧬 Build Skill Profile from Resume", "openSkillProfileBuilder_")
    .addSeparator()
    .addItem("🔒 Soft-lock Profile", "adminPromptSoftLockProfile_")
    .addItem("🔓 Unlock Profile", "adminPromptUnlockProfile_")
    .addSeparator()

    // Fetch / pipeline
    .addItem("✨ Fetch Jobs (Enriched)", "adminFetchJobsEnriched_")
    .addSeparator()

    // Debug / utilities (keep your existing stuff)
    .addItem("👤 List Profiles (Debug)", "debugListProfiles_")
    .addItem("➕ Create Profile (Stub)", "createProfileStub_")
    .addSeparator()
    .addItem("🧬 Load Profile Bootstrap (Test)", "debugBootstrap_")
    .addItem("🧱 Init Engine Tables", "adminInitEngineTables_")
    .addItem("⭐ Test Tracker Write (Admin)", "adminTestTrackerWrite_")
    .addSeparator()
    .addItem("📥 Fetch Jobs Raw (Test)", "adminFetchJobsRawTest_")
    .addItem("🧹 Clear Engine Inbox (Profile)", "adminClearInboxForProfile_")
    .addItem("🧾 Debug Scores (Top 10)", "adminDebugScoresTop10_")
    .addSeparator()

    // Footer
    .addItem("🧠 Version: " + Sygnalist_VERSION, "noop_")
    .addToUi();
}

function noop_() {}
