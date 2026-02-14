# Latency Map — Add to Tracker & Tab Switch

**Phase 1 Discovery (no code changes).** File citations and line refs for tightening Add to Tracker and Inbox ↔ Tracker tab switch.

---

## A) Add to Tracker — Full Request Path

### 1) UI component and handler

| What | Where |
|------|--------|
| Button markup | `portal_scripts.html` — `renderInbox()` builds cards; button at ~1140: `'<button type="button" class="btn btn-primary btn-card" data-promote="' + esc(key) + '">' + iconHtml('addToTracker', 18) + ' Add to Tracker</button>'` |
| Click binding | `portal_scripts.html` 1147–1150: `container.querySelectorAll('[data-promote]').forEach(...)` gets `data-promote` key, finds job `j`, `btn.addEventListener('click', function() { promote(j); });` |
| Handler | `portal_scripts.html` 1154–1167: `function promote(job)` |

### 2) Request path (UI → response → UI)

1. **Click**  
   - `promote(job)` (`portal_scripts.html` 1154).  
   - **Before any network:** `setLoading(true, 'Adding to Tracker...')` (1156) → sets `isBusy`, shows overlay, disables Scan/Refresh.  
   - No optimistic “added” state; button stays enabled until response.

2. **Client API**  
   - `api('promote', job)` (`portal_scripts.html` 545–576).  
   - Single `google.script.run...portal_api(profileId, { op: 'promote', data: job })` with retry (API_RETRIES=2, API_RETRY_DELAY_MS=800).  
   - One network round-trip per attempt.

3. **Server route**  
   - `webapp.js` 70–71: `portal_api()` → `portal_api_()`.  
   - `webapp.js` 195–196: `case "promote": return promoteEnrichedJobToTracker_(profile.profileId, data);`

4. **Promote service** (`promote.js`)  
   - `promoteEnrichedJobToTracker_(profileId, enrichedJob)` (11–63).  
   - **Lock:** `withProfileLock_(profile.profileId, "promote", () => { ... })` (`stability.js` 1–14) — script lock tryLock(25s), then run body.  
   - **Throttle:** `assertNotThrottled_(profile.profileId, "promote", 1500)` (`stability.js` 18–29) — PropertiesService read/write.  
   - **Build entry:** `buildTrackerEntryFromEnrichedJob_(enrichedJob, profile.profileId)` (`tracker.js` 16–38).  
   - **Dedupe:** `trackerHasDuplicateForProfile_(profile.profileId, entry)` (`promote.js` 166–213) — **read** `Engine_Tracker` (bounded: `getRange(1,1, lastRow, lastCol).getValues()`).  
   - If duplicate: `logEvent_()` then `return uiError_("DUPLICATE", "Already in Tracker.", { batchId })` (24–42).  
   - If new: `appendTrackerEntry_(entry)` (`tracker.js` 94–125) — **write** one row to `Engine_Tracker` (`setValues([row])`).  
   - Then `logEvent_()` (46–59) — **write** one row to `📓 Logs` (`logging.js` 9–41: `sheet.appendRow(row)`).  
   - Return `{ ok: true, version, batchId }` (60). No tracker row DTO returned.

5. **Response → UI**  
   - `portal_scripts.html` 1157–1165:  
     - Success: `showToast('Added to Tracker.', 'success')`, `trackerCache.push(job)` (inbox job object, not full tracker row), `updateCommandBarCounts()`, if `currentTab === 'tracker'` then `renderTrackerPipeline()` + `renderTracker(getFilteredTrackerList())`.  
     - Failure: `showToast(res.message || 'Already in Tracker.', 'error')`.  
     - Always: `setLoading(false)`.

### 3) Network calls per single click

- **One** logical request: `portal_api(profileId, { op: 'promote', data: job })`.  
- Retries (on failure only) add extra round-trips; no other hidden refetch for promote.  
- **No** `getTracker` or `getInbox` after promote success; client updates `trackerCache` in place and re-renders Tracker if visible.

### 4) What blocks the response

All on the **critical path** (synchronous in Apps Script):

- **Lock wait** (`stability.js`): tryLock(25s) — blocks if another script lock holder is running.  
- **Throttle** (`stability.js`): PropertiesService get/set — fast.  
- **Duplicate check** (`promote.js`): full read of `Engine_Tracker` (bounded by `getLastHeaderCol_`) — **heaviest read**.  
- **Append row** (`tracker.js`): one `setValues([row])` on `Engine_Tracker` — **write**.  
- **Log** (`logging.js`): `appendRow(row)` on `📓 Logs` — **write**.  

So: **one full Engine_Tracker read + one Engine_Tracker write + one Logs write** block the HTTP response. There is no separate “export” or trigger invoked by `logEvent_` on the promote path; `logs_export.js` styling is formula-based, not called from `logEvent_`.

### 5) Manual Add (for comparison)

- **Button:** `client_portal.html` 227: `onclick="submitManualAdd()"`.  
- **Flow:** `portal_scripts.html` 1070–1082: `setLoading(true)` → `api('manualAdd', { title, company, url, location, notes })` → on success **`await loadTracker()`** (full refetch). So manual add does **two** network calls: `manualAdd` then `getTracker`.

---

## B) Switch to Tracker — Tab logic and data load

### 1) Where tabs are controlled

| What | Where |
|------|--------|
| Tab buttons | `client_portal.html` 336–337: `<button class="tab-btn active" data-tab="inbox" id="tabBtnInbox">Inbox</button>`, `<button class="tab-btn" data-tab="tracker" id="tabBtnTracker">Tracker</button>`. |
| Tab state | `portal_scripts.html` 15–17: `currentTab`, `inboxCache`, `trackerCache`. |
| Switch handler | `portal_scripts.html` 317–321: `tabBtnInbox` / `tabBtnTracker` → `setTab('inbox')` or `setTab('tracker')`. |
| setTab() | `portal_scripts.html` 218–232: toggles visibility of `tabInbox` / `tabTracker`, active class on buttons, `updateCommandBarCounts()`, then **`if (tab === 'tracker' && trackerCache.length === 0) loadTracker();`** |

So: **first** time switching to Tracker triggers `loadTracker()`; **subsequent** switches do not (cache already filled).

### 2) What happens on switch

- **Inbox → Tracker (first time)**  
  - `setTab('tracker')` → DOM show/hide, `updateCommandBarCounts()`, then `loadTracker()` because `trackerCache.length === 0`.  
  - `loadTracker()` (`portal_scripts.html` 692–718):  
    - `showTrackerSkeleton()` (skeleton in `#trackerList`).  
    - **One** `api('getTracker')` (with 15s timeout race).  
    - On success: `trackerCache = res.tracker || []`, `renderTrackerPipeline()`, `renderTracker(getFilteredTrackerList())`, **`loadDashboard()`** (another **`api('getDashboard')`**).  
  - So **two** network calls: `getTracker` + `getDashboard`.

- **Inbox → Tracker (later times)**  
  - Only DOM + `updateCommandBarCounts()`; no `loadTracker()`, no network.

- **Tracker → Inbox**  
  - Only `setTab('inbox')`; Inbox was already loaded at init (`loadInbox()` at 315). No refetch on switch.

### 3) Heaviest work on tab switch

- **First switch to Tracker:**  
  - **Network:** `getTracker` (read full Engine_Tracker for profile) + `getDashboard` (dashboard aggregates).  
  - **Renders:** `renderTrackerPipeline()` (metric cards, filters, pipeline pills), then `renderTracker(getFilteredTrackerList())` (full list/table innerHTML).  
- **Rerenders:** Entire `#trackerList` is replaced (`container.innerHTML = ...` in `renderTracker`); no granular diff. `getFilteredTrackerList()` derives from `trackerCache` + filters/sort/search (no extra network).

---

## Latency Map Summary

### Add to Tracker

| Metric | Current behavior |
|--------|-------------------|
| **Click → immediate UI response** | Loading overlay + “Adding to Tracker...” immediately; **no** optimistic “added” on the card; button not disabled for double-click. |
| **Request duration** | Dominated by: lock + throttle + **full Engine_Tracker read** (duplicate check) + **one Engine_Tracker append** + **one 📓 Logs append**. All synchronous; no fire-and-forget. |
| **Number of network calls** | **1** (promote). No post-success refetch for promote path. |
| **Post-success refetch** | **None** for promote. Client does `trackerCache.push(job)` and re-renders Tracker if visible. (Manual add does `await loadTracker()`.) |

**Single biggest bottlenecks (Add to Tracker):**

1. **No optimistic UI** — User waits for full server round-trip before seeing “added” or button disabled.  
2. **Log on critical path** — `logEvent_()` (📓 Logs append) runs before return; if Logs sheet is slow, it delays the response.  
3. **Duplicate check** — Full bounded read of Engine_Tracker on every promote; acceptable for correctness but costly at scale.

### Tab switch (Tracker)

| Metric | Current behavior |
|--------|-------------------|
| **Switch time (first time)** | `setTab('tracker')` is instant (DOM + counts); then `loadTracker()` runs: skeleton → **getTracker** → **getDashboard** → full render. Perceived latency = time to first paint of real data (after getTracker + getDashboard). |
| **Switch time (later)** | Instant; no network, cache used. |
| **Network calls on first switch** | **2**: `getTracker`, `getDashboard`. |
| **Major rerenders** | `renderTrackerPipeline()` then `renderTracker()` — full list innerHTML replace. |

**Single biggest bottleneck (Tab switch):**

- **First-time load:** Two sequential (or parallel) API calls + full list re-render. Cache-after-first-load is already in place; making “already loaded” feel instant is mostly done; optional background revalidate can be added later.

---

## File reference quick list

- **Button / promote UI:** `portal_scripts.html` 1140, 1147–1150, 1154–1167, 545–576, 581–597.  
- **Server route:** `webapp.js` 70–71, 79, 195–196.  
- **Promote flow:** `promote.js` 11–63, 166–213; `tracker.js` 16–38, 94–125; `stability.js` 1–29.  
- **Logging (blocking):** `logging.js` 9–41.  
- **Tab / load Tracker:** `portal_scripts.html` 218–232, 231, 692–718, 944–956; `client_portal.html` 336–337, 353.  
- **Manual add refetch:** `portal_scripts.html` 1072–1076 (`await loadTracker()`).

---

## Recommended order of implementation (from Phase 3)

1. **Optimistic UI for Add to Tracker** — Immediate “added” + disable button; revert + toast on failure; guard double-click (no server change).  
2. **Idempotent server** — Already in place: duplicate returns `uiError_("DUPLICATE", ...)`; no double insert. Optional: return created tracker DTO in success response for client to merge into `trackerCache` instead of inbox `job`.  
3. **Remove full refetch after add** — Promote path already does **not** call `loadTracker()`. Manual add does `await loadTracker()`; optional: have `manualAdd` return new tracker row and update cache instead of full refetch.  
4. **Sheets/logs non-blocking** — Move `logEvent_()` off critical path (e.g. fire-and-forget or queue) so response returns after `appendTrackerEntry_()` only; failures must not fail the user-facing response.  
5. **Tab switch caching** — Already: “if trackerCache.length === 0” then load; otherwise instant. Optional: background revalidate or short TTL.  
6. **Rerenders** — Only if instrumentation shows hotspots; no broad refactors.

---

## Implementation summary (Phases 2–3)

- **Phase 2 – Instrumentation:** Opt-in timing via `window.SYGNALIST_TIMING = true`. `timingLog(label, data)` in `portal_scripts.html`. Add-to-tracker: `t_click`, `t_optimistic_ui`, `t_response`, `phase: 'settled'`, `reqId`, `profileId`, `deduped`. Tab switch: `t_switch_start`, `cacheHadData`; in `loadTracker()`: `t_first_render_tracker`, `t_data_ready`, `phase: 'skeleton'|'data'`.
- **Phase 3A – Optimistic UI:** `promote(job, optButton)` — on click, button is disabled and set to "In Tracker" immediately; no full-page loading overlay. On failure, button is reverted and a toast is shown. Double-click guarded by `if (btn && btn.disabled) return`.
- **Phase 3D – Logs non-blocking:** In `promote.js`, all `logEvent_()` calls (promote and manual_add paths) are wrapped in `try/catch`; logging failures no longer affect the user-facing response.
- **Phase 3B (optional):** Not implemented; server already idempotent (duplicate returns DUPLICATE). Returning created tracker row in response can be added later if client needs full DTO without refetch.
