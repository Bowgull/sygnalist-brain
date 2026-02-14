# Sygnalist Sheets Cockpit — Theme + Boomer-Proof Plan

**Use this document in Agent mode:** Follow the **AGENT MODE IMPLEMENTATION RUNBOOK** at the bottom. The plan above defines scope, rules, and per-tab behavior; the runbook gives ordered steps to implement.

---

## Scope & rules

**Rules (locked):** No tab renames. No column reorder/delete. No header renames unless every reader uses name lookup and Admin_Analytics has no position dependency for that sheet. No business logic changes. Formatting and validation only (or minimal safe control surface). All claims cited with file + line.

### 🔥 TOP PRIORITY — CANONICAL WORKFLOW LOCK (LANES)

**Resume Parse → Resume_Staging → Admin checks Approved → "Apply Approved Lanes" → writes Admin_Profiles.roleTracksJSON.**

- Do **NOT** expand, refactor, or migrate lane logic to laneControlsJSON in this initiative.
- **Lane_Role_Bank** remains a global taxonomy only; **Resume_Staging** remains the per-profile control surface.
- Do **NOT** add any new tabs or columns for lane selection.

---

## PHASE 0 — BASELINE (REFERENCE)

- **Format functions:** sheet_format.js — formatLogSheet_, formatLogsSheet, formatAdminAnalytics_, formatEngineInboxSheet_, formatEngineTrackerSheet_, formatAdminProfilesSheet_, formatResumeStagingSheet_. Lane_Role_Bank has no format call (add formatLaneRoleBankSheet_).
- **Positional coupling:** Admin_Analytics QUERYs use Logs A2:G, Admin_Profiles A/B/D/E, Engine_Inbox B/C/G/J, Engine_Tracker A/H/K. Resume_Staging: row 1 = headers only; no row above row 1. All readers use header name (indexOf) for Resume_Staging and Admin_Profiles; Engine_* use fixed order from engine_tables.js.

---

## PHASE 1 — THEME (DESIGN ONLY)

Constants in **sheet_theme.js**: BACKGROUND_DARK, PANEL_DARK, HEADER_BG, HEADER_TEXT, ACCENT_TEAL, ACCENT_GREEN, ACCENT_PURPLE, WARNING_AMBER, ERROR_RED, MUTED_TEXT, FONT, ROW_HEIGHT_DEFAULT, ROW_HEIGHT_HEADER, BORDER_STYLE. Use in all format functions.

---

## PHASE 2 — PER-TAB FORMATTING (SAFE ONLY)

- **📓 Logs:** Theme filter row + header row; style derived H–K as muted; conditional format ERROR/WARN/fetch (optionally ACCENT_TEAL). Do not change cols 3,4,5,7 or range D,G.
- **Admin_Profiles:** Column-group backgrounds by header name (Identity, Status, Preferences, Skill Profile, Lanes/JSON, System); “do not touch” styling on JSON/System columns; keep status/isAdmin validation; optional conditional format for inactive_soft_locked and blank displayName/email.
- **Resume_Staging:** Row 1 = header only; checkboxes on Approved/Applied (data rows 2..lastRow); theme header; conditional format Applied=TRUE dim, Approved=TRUE & !Applied highlight; **comments/notes on Approved & Applied header cells + small legend** (Approved = “Include lane on next Apply”, Applied = “Already applied to roleTracksJSON”); no rows above row 1; no code may assume legend rows.
- **Lane_Role_Bank:** Theme header; is_active checkboxes; conditional format is_active=FALSE dim; **do not over-validate lane_key** (no strict dropdown unless dynamic from existing values and non-blocking for intake).
- **Engine_Inbox / Engine_Tracker:** Theme header; widths (title/company/url/notes); conditional format tier and status; no header/order change.
- **📊 Admin_Analytics:** Theme row 1 and buildSectionTitle_; optional “action required” cell highlights; no QUERY or position changes.

---

## PHASE 3 — SAFETY & INSTRUCTIONS

- **Checklist:** No tab/header/column renames or reorders; QUERY positions unchanged; Resume_Staging row 1 headers, checkboxes valid; format idempotent; changes only sheet_theme.js + sheet_format.js + lane_bank.js (one call).
- **Plain-English instructions:** Deliver per-tab “What Josh edits” / “What Josh must NOT touch” (see table in full plan). Include Approved/Applied one-liners for Resume_Staging. Prefer sheet comments or Instructions cell.

---

## PHASE 4 — DELIVERABLE

Theme in sheet_theme.js; all format functions use it; Admin_Profiles column-group + system styling; Resume_Staging checkboxes + legend/comments; formatLaneRoleBankSheet_ added and called from lane_bank.js; Engine + Logs + Admin_Analytics themed; plain-English instructions (doc or comments).

---

# AGENT MODE IMPLEMENTATION RUNBOOK

Execute in order. Do not rename tabs or reorder/delete columns or headers. Formatting and validation only.

## Step 1 — Create sheet_theme.js

- **File:** `sheet_theme.js` (new, repo root or same folder as sheet_format.js).
- **Content:** Single object or set of constants:
  - `BACKGROUND_DARK` = `"#1a1f2e"`
  - `PANEL_DARK` = `"#374151"`
  - `HEADER_BG` = `"#1f2937"`
  - `HEADER_TEXT` = `"#ffffff"`
  - `ACCENT_TEAL` = `"#14b8a6"` (or `"#0d9488"`)
  - `ACCENT_GREEN` = `"#10b981"` (or `"#059669"`)
  - `ACCENT_PURPLE` = `"#a78bfa"` (or `"#8b5cf6"`)
  - `WARNING_AMBER` = `"#f59e0b"` (or `"#fff3cd"`)
  - `ERROR_RED` = `"#ef4444"` (or `"#f8d7da"`)
  - `MUTED_TEXT` = `"#6b7280"` (or `"#9ca3af"`)
  - `FONT` = `"Arial"` (or `"Roboto"`)
  - `ROW_HEIGHT_DEFAULT` = 22 (or 24)
  - `ROW_HEIGHT_HEADER` = 26 (or 28)
  - `BORDER_STYLE` = optional (e.g. solid + color)
- Expose so sheet_format.js can read them (global vars or one theme object). Add a short comment that this is the Sygnalist Sheets theme (design only; used by sheet_format.js).

## Step 2 — sheet_format.js: use theme in existing format functions

- At top of sheet_format.js (or after any existing requires), ensure theme constants are available (same script project: they are if sheet_theme.js is in project; Apps Script merges all .gs files).
- **formatLogSheet_:** Replace hardcoded colors with theme: header row use HEADER_BG, HEADER_TEXT; filter row use PANEL_DARK, MUTED_TEXT or HEADER_TEXT; row heights use ROW_HEIGHT_HEADER/ROW_HEIGHT_DEFAULT. Style derived columns (H–K) header row with MUTED_TEXT and grey background. Keep conditional format logic; optionally use ACCENT_TEAL for fetch/enrich. Do not change cols 3,4,5,7 or data range (2,1,lastRow,7).
- **formatAdminProfilesSheet_:** Header row HEADER_BG, HEADER_TEXT; use theme for status/inactive_soft_locked and isAdmin styling. Add column-group backgrounds by header indexOf (Identity: profileId, displayName, email; Status: status, statusReason; Preferences; Skill Profile: skillProfileText, topSkills, signatureStories; Lanes/JSON: roleTracksJSON, laneControlsJSON; System: portalSpreadsheetId, webAppUrl, last_fetch_at). Apply muted text + grey background to JSON/System data cells. Keep status and isAdmin validation exactly as-is. Add optional conditional format: whole-row dim when status = inactive_soft_locked; warning when displayName or email blank (by header index).
- **formatResumeStagingSheet_:** Header row (row 1) HEADER_BG, HEADER_TEXT, bold, freeze row 1. For data range (rows 2..lastRow): insert checkboxes on columns Approved and Applied (header indexOf "Approved" and "Applied" — RESUME_STAGING_HEADERS order makes them cols 6 and 7). Set conditional format rules (replace existing for this sheet): Applied=TRUE → muted background; Approved=TRUE and Applied not TRUE → ACCENT_GREEN or ACCENT_TEAL subtle. Add **cell comments/notes** on the Approved and Applied header cells (row 1): "Approved = Include lane on next Apply" and "Applied = Already applied to roleTracksJSON". If the sheet has space (e.g. one cell outside data range 1..lastRow, 1..7), set a small legend text there; ensure no code reads that as data (resume_staging.js uses getRange(1, 1, lastRow, 7)). Do not insert any row above row 1.
- **formatEngineInboxSheet_ / formatEngineTrackerSheet_:** Apply HEADER_BG, HEADER_TEXT to row 1; use ROW_HEIGHT_HEADER. Set column widths (company/title wider, url very wide, tier narrow, notes wide for tracker). Add conditional format: Engine_Inbox tier column (C) S=ACCENT_GREEN, F=ERROR_RED, etc.; Engine_Tracker status (H) optional by stage. Do not change header text or column order.
- **formatAdminAnalytics_:** Row 1 BACKGROUND_DARK, HEADER_TEXT; use theme for section titles (buildSectionTitle_ background, e.g. PANEL_DARK or #e9ecef). Optionally highlight “action required” value cells (Locked profiles, F-tier, errors). Do not change any QUERY formulas or row anchors.

## Step 3 — sheet_format.js: add formatLaneRoleBankSheet_

- **New function** `formatLaneRoleBankSheet_(sh)` in sheet_format.js:
  - If !sh or lastRow < 1 return.
  - Header row (row 1): HEADER_BG, HEADER_TEXT, bold, setFrozenRows(1).
  - Find column index of "is_active" from row 1. For data rows (2..lastRow), call range.insertCheckboxes() on the is_active column (Apps Script: `sh.getRange(2, idxActive, lastRow, idxActive).insertCheckboxes()`).
  - Conditional format: when is_active is FALSE (unchecked) → dim row (muted background). Do not add lane_key dropdown (do not over-validate lane_key per plan).

## Step 4 — lane_bank.js: call formatLaneRoleBankSheet_

- In `ensureLaneRoleBankSheet_()`, after the block that writes headers when `sh.getLastRow() === 0` (and setFrozenRows(1)), call `formatLaneRoleBankSheet_(sh)` so formatting runs whenever the sheet is ensured. Ensure no duplicate call if you already have other logic; one call at end of ensure is enough.

## Step 5 — Idempotence and conditional format rules

- For each sheet that gets new conditional format rules: **replace** the sheet’s conditional format rules for the affected range instead of appending (get existing rules, filter out old rules for that range, add new ones, setRules). This keeps format functions idempotent when run repeatedly.
- Checkboxes: set once on the data range (e.g. Resume_Staging cols 6–7 rows 2..lastRow; Lane_Role_Bank is_active column rows 2..lastRow). If the range is empty (lastRow < 2), skip checkboxes for that run.

## Step 6 — Plain-English admin instructions deliverable

- Add a short markdown or text section (e.g. in this file or a new ADMIN_SHEETS_INSTRUCTIONS.md) with the per-tab table:
  - 📓 Logs: safe = filter dropdowns; do not touch = columns A–G, row structure.
  - Admin_Profiles: safe = displayName, email, status, statusReason, isAdmin, preferences, skill columns; lanes via Resume_Staging only; do not touch = profileId, roleTracksJSON, laneControlsJSON, system columns.
  - Resume_Staging: safe = Approved (“Include lane on next Apply”), Applied (“Already applied to roleTracksJSON”); do not touch = headers, row 1, columns.
  - Lane_Role_Bank: safe = add/edit rows, is_active; do not touch = column order/names.
  - 📊 Admin_Analytics: view/refresh only; do not touch = formula cells.
  - Engine_Inbox / Engine_Tracker: safe = Tracker status, notes, dateApplied, GoodFit; do not touch = column order, profileId, url.
- Optionally add a note in sheet_format.js or in a comment that sheet comments can be set for key tabs (e.g. Admin_Profiles, Resume_Staging) with a one-line “What to edit / what not to touch” if you add a helper to set cell notes.

## Step 7 — Verify Phase 3 checklist

- Confirm: no tab names changed; no headers or columns reordered/deleted; Admin_Analytics QUERYs unchanged; Resume_Staging row 1 = headers, 7 columns, checkbox TRUE/FALSE compatible; Logs cols 3,4,5,7 and range (2,1,lastRow,7) unchanged; Admin_Profiles status/isAdmin validation unchanged; format functions idempotent; edits only in sheet_theme.js, sheet_format.js, lane_bank.js (and optional ADMIN_SHEETS_INSTRUCTIONS.md or similar).

---

**Done.** After running the runbook, the Sheets cockpit will use the Sygnalist theme and boomer-proof controls without changing any tab names, column order, or business logic. Lanes remain Resume_Staging → Apply Approved Lanes → roleTracksJSON only.
