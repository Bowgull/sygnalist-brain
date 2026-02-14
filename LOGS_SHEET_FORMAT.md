# 📓 Logs sheet formatting

## Reapply formatting

- **From menu:** Sygnalist → **📓 Format Logs Sheet**. This runs `formatLogsSheet()`, which applies freeze, fonts, emoji size, conditional formatting, and (if applicable) filter views and derived column headers/formulas.
- **From script editor:** Run `formatLogsSheet()` or `formatLogSheet_(sheet)` with the 📓 Logs sheet. Existing callers (`ensureLogHeaders_`, `refreshAdminAnalytics_`) already call `formatLogSheet_`; no change required for normal logging.

## Verify logging was not impacted

- **No write changes:** [logging.js](logging.js) `logEvent_` and `ensureLogHeaders_` are unchanged (same 7 columns, same payload, no new fields).
- **Only presentation code changed:** [sheet_format.js](sheet_format.js) (and optional filter views/derived columns). No edits to the log payload or append behavior.
- **Check:** Run any action that logs (e.g. Health Check, Fetch, Refresh Analytics). Confirm one new row appears on 📓 Logs with 7 columns (A–G) and expected emoji/row color.
