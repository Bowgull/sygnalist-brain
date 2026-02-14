# Sygnalist Engine — Sanity Report

**Generated per Phase 1 of Engine Sanity Check and Hardening plan.**

## Sheet tabs

| Tab | Purpose | Created by code? | Verdict |
|-----|---------|------------------|---------|
| Admin_Profiles | SoT for users; profiles, status, lanes | No (assert only) | KEEP |
| Engine_Inbox | Per-profile inbox; read by getInbox, getDashboard | ensureEngineInboxSheet_() | KEEP |
| Engine_Tracker | Per-profile tracker; read by getTracker, getDashboard | ensureEngineTrackerSheet_() | KEEP |
| 📓 Logs | Event log; logEvent_() | ensureLogHeaders_ on first write | KEEP |
| 📊 Admin_Analytics | Dashboard; refreshAdminAnalytics_() | ensureSheet_ on refresh | KEEP |

Engine_Inbox and Engine_Tracker are required by webapp.js (getInbox, getTracker, getDashboard). Not dumps. Prefer Admin_Analytics for overview; these tabs are engine data with freeze, filters, and wrap applied (Phase 7).

---

## Menu items

| Item | Handler | Verdict | Reason |
|------|---------|---------|--------|
| ✨ Fetch Jobs (Enriched) | adminFetchJobsEnriched_ | KEEP | Core |
| ➕ Create New Profile | openCreateProfileSidebar_ | KEEP | Profile mgmt |
| 🧬 Build Skill Profile | openSkillProfileBuilder_ | KEEP | Profile mgmt |
| 🔗 List Profile URLs | listProfileUrls_ | KEEP | Profile mgmt |
| 🔒 Lock Profile | adminPromptSoftLockProfile_ | KEEP | Profile mgmt |
| 🔓 Unlock Profile | adminPromptUnlockProfile_ | KEEP | Profile mgmt |
| 🧪 Health Check | runHealthCheck_ | KEEP | Ops |
| 📊 Refresh Analytics | refreshAdminAnalytics_ | KEEP | Ops |
| 📤 Export Logs (Pretty) | exportLogsToPrettySheet_ | KEEP | Ops |
| 🧱 Init Engine Tables | adminInitEngineTables_ | KEEP | Ops |
| 👤 List Profiles | debugListProfiles_ | DEPRECATE | Debug; move to submenu |
| 🔍 Inspect Profile | debugInspectProfileRow_ | DEPRECATE | Debug |
| 🧪 Test Bootstrap | debugBootstrap_ | DEPRECATE | Debug |
| ⭐ Test Tracker Write | adminTestTrackerWrite_ | DEPRECATE | Debug |
| 📥 Fetch Jobs (Raw) | adminFetchJobsRawTest_ | DEPRECATE | Debug |
| 🧹 Clear Inbox | adminClearInboxForProfile_ | DEPRECATE | Debug |
| 🧾 Debug Scores | adminDebugScoresTop10_ | DEPRECATE | Debug |
| v* (version) | noop_ | KEEP | Version display |

---

## Functions: KEEP / DEPRECATE / REMOVE

### KEEP (production path or required by it)

- **webapp.js**: doGet, getProfileListForAdmin_, portal_api, portal_api_, readEngineSheetForProfile_, getDashboard_, lastHeaderCol_, normalizeHeader_, findHeaderIndex_, rowToObjectNormalized_, inboxRowToLightDto_, inboxRowToCardDto_, inboxRowToDto_, getInboxDetailByKey_, getTrackerItemDetails_, getOrCreateGoodFit_, trackerRowToDto_, diagEngineSheet_
- **profiles.js**: loadProfiles_, getProfileById_, getProfileByIdOrThrow_, assertProfileActiveOrThrow_, rowToProfile_
- **bootstrap.js**: buildProfileContextLine_, getProfileBootstrap_
- **engine_bootstrap.js**: assertSheetExists_
- **engine_tables.js**: ensureEngineTables_, ensureEngineInboxSheet_, ensureEngineTrackerSheet_, getOrCreateSheet_, ensureHeaderRow_
- **core_utils.js**: getAPIKey_, getOptionalAPIKey_, ensureSheet_, normalizeUrl_, buildFallbackKey_, truncateStr_
- **parse.js**: csvToArray_, toBool_, parseStories_, parseRoleTracks_
- **config.js**: (CONFIG/Sygnalist_VERSION)
- **errors.js**: uiError_
- **stability.js**: withProfileLock_, assertNotThrottled_, newBatchId_
- **logging.js**: logEvent_, ensureLogHeaders_, getLogStyle_, formatLogDetailsInline_
- **fetch_pipeline.js**: fetchJobsRawForProfile_, buildFetchRequestForProfile_
- **fetch_adapters.js**: (all fetch/parse helpers used by fetch pipeline)
- **dedupe_classify_score.js**: dedupeJobs_, classifyJobsForProfile_, scoreJobsForProfile_, markExcluded_, tierFromScore_, filterTierGate_, hasAny_, countKeywordHits_
- **fetch_enriched.js**: adminFetchJobsEnriched_, fetchForProfileWithEnrichment_, formatSalaryDisplay_, writeEngineInboxEnriched_
- **engine_inbox.js**: clearEngineInboxForProfile_, writeEngineInbox_ (writeEngineInbox_ used by raw path; clearEngineInboxForProfile_ from debug menu)
- **enrichment.js**: (all)
- **tracker.js**: (all)
- **promote.js**: promoteEnrichedJobToTracker_, manualAddToTracker_, trackerHasDuplicateForProfile_, getLastHeaderCol_, buildDedupKey_
- **admin_soft_lock.js**: adminPromptSoftLockProfile_, adminPromptUnlockProfile_, softLockProfile_, unlockProfile_
- **admin_create_profile.js**: openCreateProfileSidebar_, createProfileFromSidebar, setByHeader_
- **admin_skills_profile_ui.js**: openSkillProfileBuilder_, skillProfile_listProfiles_, skillProfileBuildAndSave
- **skill_profile_parse.js**: parseResumeToSkillProfile_, normalizeSuggestedRoles_, buildRoleTracksFromSuggested_, normalizeStringArray_
- **skill_profile_writeback.js**: writeSkillProfileToAdminProfiles_
- **admin_analytics.js**: refreshAdminAnalytics_, buildSectionTitle_
- **health.js**: runHealthCheck_, runHealthCheckReport_, check_, summarizeHealthReport_
- **menu.js**: onOpen, noop_
- **logs_export.js**: exportLogsToPrettySheet_, exportLogsToSheet_, getLogResultStyle_, formatLogTimestamp_, formatLogDetails_
- **ai.js**: getAiConfig_, buildAiRequest_, parseAiResponse_, aiRequest_, aiBatchRequest_

### DEPRECATE (debug menu or test-only; do not remove until callers = 0)

- **admin_phase2_test.js**: adminInitEngineTables_, adminTestTrackerWrite_, adminTestFilterTierGate_ — menu or test only. adminInitEngineTables_ is also in menu (KEEP for menu). adminTestFilterTierGate_ has no callers → REMOVE candidate.
- **admin_phase3_test.js**: adminFetchJobsRawTest_, adminClearInboxForProfile_ — menu only (debug).
- **admin_debug.js**: debugListProfiles_, listProfileUrls_, debugOpenSkillProfileBuilder_, createProfileStub_, showProfileCreatedDialog_, setByHeader_, debugInspectProfileRow_, debugBootstrap_ — listProfileUrls_ is in menu (KEEP). debugOpenSkillProfileBuilder_ and createProfileStub_ have no menu item → REMOVE candidates. setByHeader_ duplicated in admin_create_profile (factor to one).
- **debug_scores.js**: adminDebugScoresTop10_, debugScoresTop10_ — menu (debug).

### REMOVE candidates (zero callers; remove only after confirming no triggers)

- **adminTestFilterTierGate_** (admin_phase2_test.js) — no references in codebase or menu.
- **debugOpenSkillProfileBuilder_** (admin_debug.js) — no menu item, no callers.
- **createProfileStub_** (admin_debug.js) — no menu item, no callers. showProfileCreatedDialog_ only called from createProfileStub_; if we remove createProfileStub_, showProfileCreatedDialog_ becomes dead too.

**Risks**: Do not remove any function that might be invoked by a time-based or installable trigger. Grep shows no trigger references; assume manual/menu only until confirmed.

---

## Duplication

- **setByHeader_**: Defined in admin_debug.js and admin_create_profile.js. Factor to a single shared helper (e.g. core_utils.js or admin_create_profile.js) and have admin_debug call it.

---

## Summary

- **Tabs**: All 5 kept; no consolidation needed.
- **Menu**: 10 production items KEEP; 7 debug items DEPRECATE (move to submenu in Phase 2).
- **Functions**: Majority KEEP; debug/test handlers DEPRECATE with comment + log; 3 REMOVE candidates after zero-caller confirmation.
- **Risk**: No removals until callers and triggers verified.
