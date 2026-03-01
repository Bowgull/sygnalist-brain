# Logs Overhaul — Step-by-Step Plan and Verification

## 1. Step-by-Step Plan (what changed, why)

### logging.js
- **formatLogDetailsInline_**  
  Extended to append high-value meta keys to the details string so "written", pipeline counts, and RapidAPI status appear in the sheet and in the UI.  
  Keys added (when present): `written`, `rawFetched` / `totalFetchedBeforeDedupe`, `rawFetchedMain`, `rawFetchedRapid`, `afterDedupe`, `eligible` / `eligibleAfterHardFilters`, `candidates` / `candidatesSelected`, `enriched`, `enrichPhaseMs` / `fetchPhaseMs` / `durationMs`, and RapidAPI: `rapidDecision`, `rapidReason`, `rapidStatus`, `rapidRawCount`, `rapidParsedCount`, `rapidRejectedCount`, `rapidAdded`, `rapidLinkedInCount`, `rapidATSCount`, `httpStatus`.  
  **Why:** Stored details were missing receipt facts; the UI could show "pipeline complete" without "written" or Rapid status.

### fetch_enriched.js
- **RapidAPI block**  
  - Check quota before calling APIs; if over limit, log once with `rapidStatus: "QUOTA_EXCEEDED"` and skip calls.  
  - Use new return shape from `fetchRapidLinkedInActive1h_` / `fetchRapidATSActiveExpired_`: `{ jobs, rawCount, parsedCount, rejectedCount, quotaExceeded?, httpStatus? }`.  
  - Aggregate `rapidRawCount`, `rapidParsedCount`, `rapidRejectedCount`; set `rapidStatus` to `QUOTA_EXCEEDED` | `HTTP_ERROR` | `SUCCESS_EMPTY` | `SUCCESS` (and `SKIP` / `DISABLED` when gate does not run).  
  - Replace message "quota or API returned 0 jobs" with "RapidAPI run complete; 0 jobs added" and always include `rapidStatus`, `rapidRawCount`, `rapidParsedCount`, `rapidRejectedCount`, `rapidAdded`, and `httpStatus` when relevant.  
  **Why:** Disambiguate quota vs empty response vs HTTP error; make counts visible in logs.
- **BATCH RECEIPT**  
  One log event at end of run (after "Fetch+Enrich pipeline complete") with message `"BATCH RECEIPT"` and meta: `batchId`, `profileId`, `rawFetchedMain`, `rawFetchedRapid`, `afterDedupe`, `eligible`, `candidates`, `enriched`, `written`, `rapidDecision`, `rapidStatus`, `durationMs`.  
  **Why:** Single row per batch with full receipt facts for debugging and UI filtering.

### fetch_pipeline.js
- **BATCH RECEIPT**  
  One log event after "Fetch pipeline complete" with same receipt shape; `rawFetchedRapid: 0`, `enriched: 0`, `rapidDecision: "SKIP"`, `rapidStatus: "N/A"`, `durationMs: 0`.  
  **Why:** Consistency with enriched pipeline and "Receipts only" filter.

### fetch_rapid.js
- **fetchRapidLinkedInActive1h_** / **fetchRapidATSActiveExpired_**  
  Return `{ jobs, rawCount, parsedCount, rejectedCount }` (and when applicable `quotaExceeded`, `httpStatus`, `error`). Callers use `.jobs` for the array.  
  **Why:** Enables logging raw/parsed/rejected and explicit Rapid status without per-job logging.

### admin_api.js
- **adminGetLogs(limit, profileIdFilter, actionFilter, batchIdFilter)**  
  Added optional 4th argument `batchIdFilter`; when present, filter rows where the details string contains that value (e.g. `"b_0301_0950"`).  
  **Why:** Quick filter by batch ID in the Logs UI.

### admin_tab_content.html / admin_portal.html
- **Logs toolbar**  
  Added: Batch ID input (`logsBatchFilter`), "Receipts only" checkbox (`logsReceiptsOnly`), "Hide debug" checkbox (`logsHideDebug`), and an extra column for the View button.  
- **Log detail modal**  
  Added `#logDetailModal` with `#logDetailContent` and `#logDetailModalClose` to show full details for a row.  
  **Why:** Receipts-only view, less noise from debug, batch filter, and full details without truncation.

### admin_tab_script.html / admin_portal.html (script)
- **Load logs handler**  
  - Read `logsBatchFilter`, `logsReceiptsOnly`, `logsHideDebug`.  
  - Call `adminGetLogs(200, profileFilter, actionFilter, batchIdFilter || null)`.  
  - Client-side: apply "Receipts only" (details contains "BATCH RECEIPT" or "Fetch+Enrich pipeline complete" or "Fetch pipeline complete") and "Hide debug" (source !== "debug").  
  - Render details with 220-character preview and "View" button; View opens modal with full time/profileId/action/source/level/details.  
  - Wire modal Close to hide modal.  
  **Why:** Longer preview, expand for full text, and toggles without changing server row limit.

---

## 2. Backward compatibility
- **Old logs:** Still display; `formatLogDetailsInline_` only appends keys that exist.  
- **Export:** Unchanged; still reads 📓 Logs and exports; no schema change.  
- **Sheet:** Still 7 columns.  
- **Rapid callers:** Only `fetch_enriched.js` uses the new return shape; it supports both object (`result.jobs`) and legacy array for safety.

---

## 3. How to verify (example batchId: `b_0301_0950`)

1. **Stored details include `written`**  
   Run an enriched fetch for a profile. In 📓 Logs, find the row with message "Fetch+Enrich pipeline complete" or "BATCH RECEIPT". The Details cell should contain `written: N` (and other meta such as `rawFetched`, `candidates`, `enriched`).  
   *If you use a batchId like `b_0301_0950`*, filter or search that batch and confirm the receipt row shows `written`.

2. **UI shows `written` without truncation**  
   In Admin → Logs, click Load logs. Find a "BATCH RECEIPT" or "Fetch+Enrich pipeline complete" row. The Details column should show at least 220 characters (so `written: 0` or `written: N` is visible). Click **View** and confirm the full details string is shown in the modal.

3. **RapidAPI status is explicit and includes counts**  
   Trigger a run where RapidAPI is used (gate RUN). In 📓 Logs, find "RapidAPI run complete; 0 jobs added" or "RapidAPI fallback ran; second pass complete". Details should include `rapidStatus` (e.g. `SUCCESS_EMPTY`, `QUOTA_EXCEEDED`, `HTTP_ERROR`, `SUCCESS`) and at least `rapidRawCount`, `rapidParsedCount`, `rapidRejectedCount`, `rapidAdded` (and `httpStatus` when applicable).

4. **Receipts-only toggle**  
   Load logs with several non-receipt rows (e.g. "Fetch plan built", "Plan summary"). Check "Receipts only". Click Load logs again. Table should show only rows whose details contain "BATCH RECEIPT", "Fetch+Enrich pipeline complete", or "Fetch pipeline complete".

5. **BatchId filter**  
   In Batch ID field enter a known batchId (e.g. `b_0301_0950` or a prefix like `b_0301`). Load logs. Only rows whose details contain that string should appear.

6. **Hide debug**  
   Load logs so that some rows have source "debug". Check "Hide debug", load again. No row should have source "debug".

7. **Export still works**  
   Use the Export logs button; export should complete and the exported sheet should contain the same log rows (with the new details format).

---

## 4. Files touched (summary)

| File | Changes |
|------|--------|
| logging.js | formatLogDetailsInline_: added receipt + Rapid meta keys; rawFetchedMain/rawFetchedRapid |
| fetch_enriched.js | Rapid block: quota check, new return shape, rapidStatus + counts; BATCH RECEIPT log |
| fetch_pipeline.js | BATCH RECEIPT log after pipeline complete |
| fetch_rapid.js | fetchRapidLinkedInActive1h_, fetchRapidATSActiveExpired_: return { jobs, rawCount, parsedCount, rejectedCount, ... } |
| admin_api.js | adminGetLogs 4th param batchIdFilter; filter by details containing string |
| admin_tab_content.html | Logs: batch filter input, Receipts only / Hide debug, View column, log detail modal |
| admin_portal.html | Same Logs UI + modal |
| admin_tab_script.html | Load logs: batchIdFilter, receiptsOnly, hideDebug, 220-char preview, View → modal; modal close |
| admin_portal.html (script) | Same Load logs + modal behavior |
