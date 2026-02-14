/****************************************************
 * menu.js
 * Sygnalist Admin Menu
 *
 * Sanity Report: see SANITY_REPORT.md (KEEP/DEPRECATE/REMOVE per function and menu item).
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
    .addItem("➕ Create New Profile", "openCreateProfileSidebar_")
    .addItem("🧬 Build Skill Profile", "openSkillProfileBuilder_")
    .addItem("🔗 List Profile URLs", "listProfileUrls_")
    .addSeparator()
    
    // ═══════════════════════════════════════════════════
    // ADMIN & OPS (Lock/Unlock/Toggle Admin are in Admin_Profiles sheet)
    // ═══════════════════════════════════════════════════
    .addItem("🧪 Health Check", "runHealthCheck_")
    .addItem("📊 Refresh Analytics", "refreshAdminAnalytics_")
    .addItem("📤 Export Logs", "exportLogsWithChoice_")
    .addItem("📓 Format Logs Sheet", "formatLogsSheet")
    .addItem("🧱 Init Engine Tables", "adminInitEngineTables_")
    .addSeparator()
    
    // ═══════════════════════════════════════════════════
    // DEBUG & TESTING (deprecated; in submenu until removed)
    // ═══════════════════════════════════════════════════
    .addSubMenu(ui.createMenu("🔧 Debug")
      .addItem("👤 List Profiles", "debugListProfiles_")
      .addItem("🔍 Inspect Profile", "debugInspectProfileRow_")
      .addItem("🧪 Test Bootstrap", "debugBootstrap_")
      .addItem("⭐ Test Tracker Write", "adminTestTrackerWrite_")
      .addItem("📥 Fetch Jobs (Raw)", "adminFetchJobsRawTest_")
      .addItem("🧹 Clear Inbox", "adminClearInboxForProfile_")
      .addItem("🧾 Debug Scores", "adminDebugScoresTop10_")
      .addItem("✅ Apply Approved Lanes (legacy)", "applyApprovedLanes_")
      .addItem("🧪 Lane Bank + Resolver Tests", "runLaneBankResolverTests_"))
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
