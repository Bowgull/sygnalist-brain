# Portal UX, load time, card focus, and pill spacing

## 1. Remove commit-to-profile and profile selector; job bank only for job intake

**Intent:** Job intake should only support adding to the **global job bank**. Remove "commit to profile" (Commit selected to Role Bank) and the "Promote to:" profile dropdown.

**Files:** [admin_tab_content.html](admin_tab_content.html), [admin_portal.html](admin_portal.html)

- **Job intake toolbar**
  - Remove the "Promote to:" label and the `jobsIntakeProfileSelect` dropdown from the Jobs Intake section in both files.
  - Remove the **"Commit selected"** button and its click handler (it commits to Role Bank for a selected profile; no longer offered).
  - Keep only **"Add to job bank"** (already calls `adminPromoteToGlobalJobBank(jobIds)`; no profile needed).
- **Handlers**
  - In both files, remove any logic that reads `jobsIntakeProfileSelect` for job intake (e.g. commit flow). Ensure `btnAddToJobBank` does not require a profile (it already uses global job bank only in admin_tab_content.html; in admin_portal.html remove the `profileId` check and "Select profile to promote to" for Add to job bank if present).
  - Stop populating `jobsIntakeProfileSelect` in `loadAdminProfiles` / profile list success handlers (and remove the element from the DOM as above).

**Result:** Job intake has "Ingest from Gmail", "Load", and "Add to job bank" (and checkboxes to select jobs). No profile dropdown and no "Commit selected".

---

## 2. Remove redundant Profile dropdown from Master Portal header

**Intent:** With "View as" on each profile card, the global "Profile: [dropdown]" in the header is redundant. Remove it and drive profile context from the Lanes button (and similar) instead.

**Files:** [admin_portal.html](admin_portal.html), [admin_tab_content.html](admin_tab_content.html)

- **Header**
  - Remove the entire toolbar block that contains "Profile:" and `adminGlobalProfileSelect` from the Master Portal header (the block immediately under "Manage profiles, lanes…").
- **Profile context for Job Lanes**
  - Job Lanes currently uses `adminGlobalProfileSelect` to choose which profile's lanes to edit. Replace this with **context from the Lanes button**: when the user clicks "Lanes" on a profile card, store that profile id (e.g. in a variable or data attribute) and show a read-only "Editing lanes for: [Profile name]" in the Job Lanes section instead of a global dropdown.
  - For "Save lane toggles", "Parse resume", and any other flow that currently reads `adminGlobalProfileSelect`, use the same stored "current profile" when the user entered the flow via a profile card (e.g. Lanes or a dedicated entry point). If the user opens Job Lanes without having clicked Lanes on a card, show copy like "Click **Lanes** on a profile card to edit that profile's lanes" and hide the lane toggles until a profile is set.
  - Optional: add a small "Change profile" link in the Job Lanes card that either clears the context (and shows the hint) or opens a minimal profile picker (e.g. list of profile names) so they can switch without going back to the Profiles list.
- **Other uses of adminGlobalProfileSelect**
  - **Resume parse:** Already has its own `resumeParseProfileSelect` in the modal; no change needed for that.
  - **Edit profile modal:** Currently pre-fills the global select when opening edit; can be removed. No need to set a "current profile" for the edit modal.
  - **Promote to Role Bank (enrichment panel):** The "Promote to Role Bank" in the enrichment panel (if it still exists) may use a profile; determine if that flow stays (and from where it gets profile) or is removed with "commit to profile". If it stays, it could take profile from the same "current profile" context or a dropdown local to that panel.

**Result:** No Profile dropdown in the header. Job Lanes (and any other profile-scoped action) gets profile from "Lanes" (or equivalent) and shows "Editing lanes for: X" with optional "Change profile".

---

## 3. View as: open in new tab only; remove back/exit and banner

**Intent:** "View as" should simply open the client portal in a **new tab**. No "Back", "Exit", or "Viewing as" banner in that tab—just the normal client experience.

**Files:** [admin_tab_content.html](admin_tab_content.html), [admin_portal.html](admin_portal.html), [client_portal.html](client_portal.html), [portal_scripts.html](portal_scripts.html)

- **View as link (admin)**
  - In both admin files, change the View as `<a>` to open in a new tab: add `target="_blank"` and `rel="noopener noreferrer"` to the link. No other change to the URL (keep `?profile=...&viewAs=1` so the client still knows which profile to load).
- **Client portal when opened via View as**
  - **Remove** the "Viewing as [name]" banner and the "Exit" / "Back" link when the page is loaded with viewAs=1. In [portal_scripts.html](portal_scripts.html), in the `init()` block that runs when `VIEW_AS && BOOT.profile`, do **not** show `viewAsBanner`, do **not** set `viewAsExit` href or "Back" text, and do **not** set up `history.pushState` / `popstate` or `sessionStorage` admin return URL. Leave the banner hidden and skip all exit/back logic so the client portal is just the normal app in a new tab.
  - Optionally remove or hide the `#viewAsBanner` DOM block in [client_portal.html](client_portal.html) entirely if it is no longer used, or keep it in the DOM but never display it when viewAs=1.

**Result:** Clicking "View as" opens the client portal in a new tab with no admin chrome (no banner, no back). User closes the tab when done.

---

## 4. Batch delete ingested jobs; URL read-only and actionable

**Intent:** (1) Allow **batch delete** of selected jobs from Jobs Intake (ingested jobs). (2) In the job intake card form, **URL is not editable** but is **actionable** (open in new tab)—either show as a clickable URL or a read-only value plus an "Open" / "View" action button.

**Files:** [admin_tab_content.html](admin_tab_content.html), [admin_portal.html](admin_portal.html), [admin_api.js](admin_api.js), [jobs_inbox.js](jobs_inbox.js) (if needed)

- **Batch delete**
  - Add a **"Delete selected"** (or "Remove selected") button in the Jobs Intake toolbar, enabled when at least one job is selected (same checkbox selection as "Add to job bank"). On click: collect selected job IDs, confirm with the user, then call a new backend **`adminDeleteJobsInboxRows(jobIds)`** that deletes each row (or a single batch delete helper in jobs_inbox.js). Prefer one server call that accepts an array and deletes all (loop over IDs and call existing `deleteJobsInboxRow_(jobId)` or add a batch delete in jobs_inbox.js); return `{ ok: true, deleted: number }`. On success, show toast and call `loadJobsInbox()`.
  - In [admin_api.js](admin_api.js), add `adminDeleteJobsInboxRows(jobIds)` that accepts an array of job_ids, validates, calls delete for each (or a batch implementation), and returns count. Reuse existing `adminDeleteJobsInboxRow` / `deleteJobsInboxRow_` where possible.
- **URL field: read-only + action**
  - In the job intake **card form** (inline form when editing a job), replace the URL **input** with either:
    - **Option A:** A read-only display of the URL plus an **action button** (e.g. "Open URL" or "View") that opens `row.url` in a new tab (`target="_blank"`). Use a `<span>` or `<div>` for the URL text (truncated if long) and a `<a href="..." target="_blank" rel="noopener">` or `<button>` that navigates to the URL. Do **not** include `url` in the form's patch when saving (so URL is never updated from the form).
    - **Option B:** Keep the URL as a single **clickable link** (read-only): display the URL as an `<a href="..." target="_blank" rel="noopener">` with the URL as text (or "Open job URL"); no input. Again, omit `url` from the save payload.
  - Apply the same change in both [admin_tab_content.html](admin_tab_content.html) and [admin_portal.html](admin_portal.html) wherever the job intake card form is built (the `.jobs-intake-card-form` block with `data-field="url"`). Remove the URL from the list of fields collected in the Save handler (so saving the form does not change the URL).

**Result:** Users can select multiple ingested jobs and delete them in one action. In the edit form, URL is read-only and used only to open the job page in a new tab (no editing of URL).

---

## 5. Shorten tracker and inbox load times

**Intent:** Tracker and inbox are currently ~17s and ~12s. Reduce without breaking behavior.

**Backend ([webapp.js](webapp.js))**

- **getInbox**
  - Add **CacheService.getScriptCache()** for `getInbox`, similar to `getTracker`: key e.g. `"inbox:" + profileId`, TTL 30–45 seconds. On cache hit, return parsed JSON; on miss, compute via `getMergedInboxForProfile_` and `inboxRowToCardDto_`, then put in cache (ignore put errors for large payloads). Invalidate on any write that changes inbox for that profile (e.g. promote to tracker, batch fetch) if such server entry points exist.
- **getTracker**
  - Already cached. Consider slightly **lengthening TTL** (e.g. 60s) if freshness is acceptable, to reduce repeated slow calls.
  - **Avoid duplicate work:** `getDashboardLight_(pid, rows)` calls `getMergedInboxForProfile_(profileId)` again (second full merge + sheet reads). Options: (a) cache the merged inbox per profile with a short TTL and reuse in both `getTracker` and `getInbox`, or (b) for dashboard counts only, add a lighter path that only fetches counts. Option (a) is simpler: e.g. cache `getMergedInboxForProfile_` result for 30–45s keyed by profileId; both getTracker and getInbox use it so one merge per profile per TTL.
- **Shared merged-inbox cache**
  - Add a small helper that returns merged inbox for a profile (from cache if valid, else `getMergedInboxForProfile_` and cache put). Use it in both `getInbox` and inside `getTracker` when building `getDashboardLight_`, so one merge serves both endpoints when both are called close together.

**Client ([portal_scripts.html](portal_scripts.html))**

- **Inbox**
  - **Stale-while-revalidate:** When switching to Radar/Inbox tab, if `inboxCache.length > 0`, render immediately from cache and call `loadInbox()` in the background (no skeleton). Add a `loadInbox(backgroundRefresh)` flag: when true, skip skeleton and do not show error UI on failure (only refresh on success).
  - Optionally lower timeout for getInbox to 12–15s so retry happens sooner without changing backend.
- **Tracker**
  - Already has stale-while-revalidate and 25s timeout. Ensure cache invalidation is in place for all tracker mutations (already done in webapp.js for updateTracker, removeFromTracker, promote, manualAdd).

**Result:** First load can still be slow (sheets-bound); repeat loads and tab switches are fast from cache; client shows cached data immediately and refreshes in background.

---

## 6. Card comes forward and dims UI globally

**Intent:** Restore the behavior where opening a card (tracker GoodFit, editing, job intake form) brings the card forward and dims the rest of the UI. This should apply when: clicking into a tracker card (spotlight), flipping for GoodFit, editing a job intake card, and any "focus" mode for a card.

**Client portal (tracker) – [portal_scripts.html](portal_scripts.html), [client_portal.html](client_portal.html), [portal_styles.html](portal_styles.html)**

- **Spotlight**
  - Ensure when a tracker card is opened (e.g. via GoodFit or spotlight), the **spotlight overlay** is shown (dim) and the card is in the **spotlight slot** above it. Code already calls `overlay.classList.add('visible')` in `openSpotlight`; verify no mobile or other branch hides the overlay or prevents it from stacking.
  - Ensure **tracker-flip-backdrop** (when a card is flipped in-place) is still rendered and visible where intended, and that `#trackerList.has-flipped-card` is set so the list stacks above the dim. If this was removed or disabled for mobile, re-enable it for all viewports (or use a single overlay for both "flipped" and "spotlight" so behavior is consistent).
- **Dim strength**
  - In [portal_styles.html](portal_styles.html), `.spotlight-overlay` uses `background: rgba(5, 6, 10, 0.38)`. If the dim was reduced for performance (e.g. Phase 7), consider restoring a slightly stronger dim (e.g. 0.5–0.6) so "card comes forward" is obvious, unless you have evidence it hurts performance.

**Job intake (admin) – [admin_portal.html](admin_portal.html), [admin_tab_content.html](admin_tab_content.html), [portal_styles.html](portal_styles.html)**

- When a job intake card is in edit mode (`#jobsIntakeList.has-editing-card` and a card has `.is-editing`), add a **full-screen dim overlay** (same pattern as spotlight): a fixed overlay behind the jobs intake list that dims the rest of the page. The editing card already has higher z-index; ensure the list container has a stacking context and the new overlay sits behind it (e.g. z-index below the list, list and card above).
- **Implementation**
  - In admin layout, add an overlay element (e.g. `jobs-intake-dim-overlay`) that is hidden by default. When adding `has-editing-card` to `#jobsIntakeList`, show the overlay (e.g. add class `visible`); when removing `has-editing-card`, hide it. Style the overlay similarly to `.spotlight-overlay` (fixed, inset 0, dark semi-transparent background, z-index so it's above page content but below `#jobsIntakeList` and the editing card). Reuse the same overlay for both admin_portal and admin_tab_content if both have job intake.

**Result:** Tracker card open/GoodFit: dim + card on top. Job intake card editing: dim + editing card on top. One consistent "card forward + dim" behavior.

---

## 7. Fix spacing of pills in job intake section

**Intent:** Pipeline pills (All, NEW, NEEDS ENRICHMENT, ENRICHED, OUTLIERS) should have **uniform, tighter spacing** and stay on one line (as in screenshot 4).

**Files:** [portal_styles.html](portal_styles.html)

- **Jobs intake pipeline**
  - `.jobs-intake-pipeline-header.pipeline-layout .pipeline-row` already uses flex and `flex-wrap: nowrap`. Add a **gap** between the "All" chip and the `.pipeline-bar`, and between segments inside the bar, e.g. `gap: var(--space-2)` or `var(--space-3)` on `.pipeline-row` and `.jobs-intake-pipeline-header .pipeline-bar`.
  - **Segment separators:** The tracker pipeline uses `.pipeline-segment-wrap:not(:last-child)::after` with `margin-left: var(--space-4); margin-right: var(--space-3)`. For jobs intake, use a **smaller, consistent gap** so pills don't have wide gaps. Override or add a class for jobs-intake so that `.jobs-intake-pipeline-header .pipeline-segment-wrap:not(:last-child)::after` has reduced margin (e.g. `margin-left: var(--space-2); margin-right: var(--space-2)`), and set `.jobs-intake-pipeline-header .pipeline-bar { gap: var(--space-2); }` so spacing between pills is even and compact.
  - Ensure the "All" button and the pipeline bar are visually one row with consistent spacing (e.g. `.pipeline-row { gap: var(--space-3); }`).

**Result:** Pills in the job intake section are single-line, aligned, with even and reduced spacing (no large gaps).

---

## Summary of file-level changes

| Area | Files |
|------|--------|
| Commit/profile removal | admin_tab_content.html, admin_portal.html |
| Header profile dropdown removal + Job Lanes context | admin_portal.html, admin_tab_content.html |
| View as new tab + remove back/banner | admin_tab_content.html, admin_portal.html, client_portal.html, portal_scripts.html |
| Batch delete + URL read-only/actionable | admin_tab_content.html, admin_portal.html, admin_api.js, jobs_inbox.js (if needed) |
| Tracker/inbox speed | webapp.js, portal_scripts.html |
| Card forward + dim | portal_styles.html, portal_scripts.html, client_portal.html; admin_portal.html, admin_tab_content.html |
| Pill spacing | portal_styles.html |
