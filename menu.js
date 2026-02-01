/****************************************************
 * menu.js
 * Sygnalist Admin Menu
 * 
 * Organized for production use:
 * - Core actions at top
 * - Admin tools in middle
 * - Debug/test items at bottom
 ****************************************************/

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu("📡 Sygnalist")
  
    // ═══════════════════════════════════════════════════
    // CORE ACTIONS (daily use)
    // ═══════════════════════════════════════════════════
    .addItem("✨ Fetch Jobs (Enriched)", "adminFetchJobsEnriched_")
    .addSeparator()
    
    // ═══════════════════════════════════════════════════
    // PROFILE MANAGEMENT
    // ═══════════════════════════════════════════════════
    .addItem("➕ Create New Profile", "createProfileStub_")
    .addItem("🔗 List Profile URLs", "listProfileUrls_")
    .addItem("🧬 Build Skill Profile", "openSkillProfileBuilder_")
    .addItem("🔒 Lock Profile", "adminPromptSoftLockProfile_")
    .addItem("🔓 Unlock Profile", "adminPromptUnlockProfile_")
    .addSeparator()
    
    // ═══════════════════════════════════════════════════
    // ADMIN & OPS
    // ═══════════════════════════════════════════════════
    .addItem("🧪 Health Check", "runHealthCheck_")
    .addItem("📊 Refresh Analytics", "refreshAdminAnalytics_")
    .addItem("📤 Export Logs (Pretty)", "exportLogsToPrettySheet_")
    .addItem("🧱 Init Engine Tables", "adminInitEngineTables_")
    .addSeparator()
    
    // ═══════════════════════════════════════════════════
    // DEBUG & TESTING (can remove later)
    // ═══════════════════════════════════════════════════
    .addItem("👤 List Profiles", "debugListProfiles_")
    .addItem("🔍 Inspect Profile", "debugInspectProfileRow_")
    .addItem("🧪 Test Bootstrap", "debugBootstrap_")
    .addItem("⭐ Test Tracker Write", "adminTestTrackerWrite_")
    .addItem("📥 Fetch Jobs (Raw)", "adminFetchJobsRawTest_")
    .addItem("🧹 Clear Inbox", "adminClearInboxForProfile_")
    .addItem("🧾 Debug Scores", "adminDebugScoresTop10_")
    .addSeparator()
    
    // ═══════════════════════════════════════════════════
    // VERSION
    // ═══════════════════════════════════════════════════
    .addItem("v" + Sygnalist_VERSION, "noop_")
    
    .addToUi();
}

function noop_() {
  // No-op for version display
}
