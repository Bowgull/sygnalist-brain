# Admin Load Fix + Timeout + Duplicate Paths (Phases 1–3)

## Root cause writeup

### Why admin load failed

- **Symptom:** "Admin script could not be loaded by the server (inlining failed)" and Executions log: `Malformed HTML content: (function() { …`
- **Cause:** `admin_tab_script.html` contained **raw JavaScript** (an IIFE). `HtmlService.createHtmlOutputFromFile("admin_tab_script")` **parses the file as HTML**. The HTML parser saw `(function() {` and threw "Malformed HTML content" before any inlining or Base64.
- **Fix (Phase 1):** (1) Wrap the script in a minimal valid HTML document with a single `<script>…</script>` so `getContent()` succeeds. (2) Server-side, extract only the script body with `extractFirstScriptBody_()` and use that for inlining and for `?asset=admin`. (3) If inlining throws, set `adminScriptSrc = "?asset=admin"` so the client loads the script from the asset URL instead of leaving admin broken. (4) Log only short error messages + metadata to avoid "Logging output too large. Truncating output."

### Why "Request timed out" happens

- **Client:** `loadInbox()` raced the API call against a **15s** timeout; `loadTracker()` against **25s**. If the server (or cold start) took longer, the client showed "Request timed out."
- **Server:** `portal_api` getInbox/getTracker do sheet reads and (for getTracker) dashboard computation. Cold start + Sheets API latency can exceed those limits. Caching was already in place (ScriptCache, 45s TTL for both inbox raw and tracker response); timing was not logged.
- **Fix (Phase 2):** (1) Add server timing logs for getInbox/getTracker (op name + elapsedMs, no payload). (2) One automatic retry on timeout for loadInbox and loadTracker before showing the error. (3) Slight timeout increase: inbox 15s→18s, tracker 25s→28s.

### What duplication existed

- **Active path:** `client_portal` (doGet) + `admin_tab_content.html` (admin tab markup) + `admin_tab_script.html` (admin JS). Single bookmark; admin tab is inside the client portal. All admin UI calls `admin_api.js` via `google.script.run`.
- **Deprecated duplicate:** `admin_portal.html` — full standalone admin UI (Profiles, Job Intake, Logs, etc.), same backend. Marked "DEPRECATED: Standalone admin portal no longer served." Never served by doGet.
- **Unused shell:** `admin_only.html` — thin shell expecting server-injected `ADMIN_CONTENT_HTML` / `ADMIN_SCRIPT_INLINE`. Not wired in doGet.
- **Fix (Phase 3):** Document in doGet that only client_portal + admin_tab_content + admin_tab_script are served; do not add branches for admin_portal or admin_only. Mark admin_only.html as UNUSED. No change to admin_api surface.

---

## Phase 1 — Admin load fix (DONE)

### Edits

- **admin_tab_script.html:** Wrapped entire JS in `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>` … `</script></body></html>`.
- **webapp.js:**
  - Added `extractFirstScriptBody_(html)` (regex first `<script>…</script>`, return inner text).
  - Inlining block: `getContent("admin_tab_script")` → `extractFirstScriptBody_(adminHtml)` → base64 that only.
  - `?asset=admin`: same extraction; return `adminScriptRaw` as `ContentService.MimeType.JAVASCRIPT`.
  - On inlining failure: set `adminScriptSrc = "?asset=admin"`, empty `adminScriptB64JSON`, `adminInlineFailed = "1"`.
  - Catch logging: only `error.message` (max 300 chars) + `[file=admin_tab_script]` (no adminHtml/adminScriptRaw).
- **debug_admin_inline:** Uses extract + short message/stack on error.

### Verification (Phase 1)

1. Deploy and open portal as admin (`?profile=<adminProfileId>`).
2. Click **Admin** tab — no "inlining failed" message.
3. Console: `[ADMIN_BOOT] admin script executed` and `sygnalist-admin-ready` dispatched.
4. Profiles section loads; `loadAdminProfiles` runs and list renders.
5. (Optional) Run `debug_admin_inline()` in editor — `ok: true`, no Malformed HTML.

---

## Phase 2 — Request timed out (DONE)

### Edits

- **webapp.js (portal_api_):**
  - `t0 = Date.now()` at start.
  - getInbox: before return, `Logger.log("portal_api op=getInbox elapsedMs=" + (Date.now() - t0))`.
  - getTracker: same for cache hit and miss; on error log `elapsedMs` + error substring (max 120 chars).
- **portal_scripts.html:**
  - loadInbox: timeout 15s→18s; on timeout, one automatic retry via `runInboxRequest()`; only then show "Request timed out" and Retry button.
  - loadTracker: timeout 25s→28s; same one-retry-on-timeout pattern.

### Verification (Phase 2)

1. Open **Executions** for a getInbox/getTracker run — log line `portal_api op=getInbox elapsedMs=…` or `op=getTracker elapsedMs=…` (and optional `fromCache=true`).
2. If a request would have timed out, confirm one retry runs before error (e.g. temporarily lower timeout to test).
3. Inbox and Tracker tabs load within 18s / 28s under normal conditions; after cold start, retry may succeed without user action.

---

## Phase 3 — Duplicate admin paths (DONE)

### Edits

- **webapp.js:** Comment above `doGet`: only `client_portal`, `admin_tab_content`, `admin_tab_script` are served; do not serve `admin_portal.html` or `admin_only.html`.
- **admin_only.html:** Second-line comment: "UNUSED: This shell is not served by doGet. Admin UI is client_portal + admin_tab_content + admin_tab_script only."
- **admin_portal.html:** Already had DEPRECATED comment; no code change. doGet has no branch referencing it.

### Verification (Phase 3)

1. Grep for `createTemplateFromFile("admin_portal")` and `createTemplateFromFile("admin_only")` — none in webapp.js.
2. Only admin entry point is: open client portal → Admin tab → script from inline or `?asset=admin`.

---

## Summary

| Phase | What was wrong | What was done |
|-------|----------------|---------------|
| 1     | HtmlService parsed admin_tab_script as HTML; raw JS → Malformed HTML. Inlining failed with no fallback; logs truncated. | Wrap script in minimal HTML; extract script body server-side; serve JS only for inline and ?asset=admin; fallback to ?asset=admin on inline failure; shorten logs. |
| 2     | Timeouts at 15s/25s; no server timing; no retry on timeout. | Log getInbox/getTracker elapsedMs; one retry on timeout for inbox and tracker; timeouts 18s/28s. |
| 3     | Two admin UIs in repo (admin_tab_* vs admin_portal); admin_only unused. | Document single doGet path; mark admin_only UNUSED; keep admin_portal as deprecated reference; no new code paths. |
