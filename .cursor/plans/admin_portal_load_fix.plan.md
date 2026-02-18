# Admin Portal Load Fix Plan

## Problem summary

- **"Admin script failed to load"**: The `<script src="...?asset=admin">` request fails (browser `onerror`) because the response is not valid JavaScript (e.g. HTML error/login page) or the request fails.
- **"Request timed out"** (pill): Comes from Inbox/Tracker `portal_api` timeouts (15s/25s), not from the admin script; cold start can affect these too.
- **Root causes**: (1) Script URL may point to a different deployment than the page (`CONFIG.WEB_APP_URL` vs actual opener URL). (2) Apps Script cold start can exceed the 20s client timeout. (3) If the server throws when serving `?asset=admin`, Apps Script returns an HTML error page → script fails to parse → `onerror`.

## Avoiding HTML / Malformed HTML errors

**Goal:** Do not reintroduce HtmlService "Malformed HTML content" or similar errors (as encountered when the admin script was previously inlined). Ensure every response that is supposed to be HTML or JS is well-formed and safe.

### Rules (must follow)

1. **Never inline the admin script in the main portal HTML.**  
   The admin script stays served as a separate asset via `?asset=admin` (returned as `ContentService.createTextOutput(...).setMimeType(ContentService.MimeType.JAVASCRIPT)`). Do not embed the contents of `admin_tab_script.html` into [client_portal.html](client_portal.html) or [portal_scripts.html](portal_scripts.html) via scriptlets or `<?!= ... ?>`. Inlining large script content has caused "Malformed HTML content: Portal load failed" in the past.

2. **Keep template output safe for HtmlService.**  
   - All values injected into HTML templates (scriptlets) must be sanitized so they cannot break the parser or close tags. Continue using [webapp.js](webapp.js) helpers:
     - `sanitizeForScriptlet_()` for any string that might contain `?>` (replaces with `?\u003e`).
     - `escapeJsonForScriptTag_()` for JSON embedded inside `<script>` (escapes `</script>`, `?>`, `</`).
   - Use these for `BOOTSTRAP_JSON`, `ADMIN_BOOT_SCRIPT_TAG`, `ADMIN_SCRIPT_SRC`, and any other dynamic values written into [client_portal.html](client_portal.html) or included partials.

3. **Never return non–well-formed HTML from doGet.**  
   HtmlService expects valid HTML when you use `createHtmlOutput(...)`. The current catch block in [webapp.js](webapp.js) (lines 129–132) returns:
   `createHtmlOutput("Portal load failed:\n" + String(err...))`  
   That is **not** valid HTML (no DOCTYPE, no `<html>`, `<head>`, `<body>`). Such output can trigger "Malformed HTML content" when GAS serves it.
   - **Change:** In the `doGet` catch block, return a **minimal valid HTML document** instead of raw text, e.g. `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Error</title></head><body><p>Portal load failed. Try again later.</p></body></html>`. Optionally include a sanitized (HTML-escaped) error message in a `<pre>` or `<p>` so it does not contain `<`, `>`, or `&` that could break the document.

4. **Asset endpoint must return only JavaScript.**  
   For `?asset=admin`, the response must always be `ContentService.createTextOutput(...).setMimeType(ContentService.MimeType.JAVASCRIPT)`. If you add a server-side fallback (e.g. when `createHtmlOutputFromFile("admin_tab_script").getContent()` throws), the fallback must still be a string of **JavaScript** (e.g. a one-liner that sets a global and dispatches `sygnalist-admin-ready`), not HTML. That way the browser never receives HTML for the script tag and will not fire `onerror` due to "not valid JS".

5. **No unescaped user or server data in HTML.**  
   When inserting error messages or dynamic text into HTML (including the minimal error page above), escape `&`, `<`, `>`, `"`, `'` so the result cannot break the document or introduce script/style.

---

## Current flow

```mermaid
sequenceDiagram
  participant User
  participant Page
  participant ScriptTag
  participant Server

  User->>Page: Click Admin tab
  Page->>Page: setTab('admin')
  Page->>Page: Read data-admin-script-src (absolute or "?asset=admin")
  Page->>Page: Resolve URL (if relative: origin+pathname+query)
  Page->>ScriptTag: Append script src=resolvedUrl, async, 20s timeout
  ScriptTag->>Server: GET ?asset=admin
  alt Success
    Server-->>ScriptTag: 200 + JavaScript
    ScriptTag->>Page: Execute script, dispatch sygnalist-admin-ready
    Page->>Page: hideAdminLoadError, bindAdminUIOnce, loadAdminProfiles
  else Failure or timeout
    ScriptTag->>Page: onerror or timeout to showAdminLoadError + Retry
  end
```

---

## Implementation plan

### 1. Use same-origin relative URL for the admin script (primary fix)

**Goal:** Ensure the script is always requested from the **same** deployment that served the page.

**Change in [webapp.js](webapp.js):** When `showAdminUI` is true, set `adminScriptSrc` to the relative value `"?asset=admin"` only (remove the branch that uses `sanitizedBaseUrl + "?asset=admin"`). Keep `CONFIG.WEB_APP_URL` for redirects and links only.

### 2. Fix doGet error response (avoid Malformed HTML)

**Goal:** Ensure the catch block never returns malformed HTML.

**Change in [webapp.js](webapp.js):** In the `doGet` catch block, replace the current `createHtmlOutput("Portal load failed:\n" + ...)` with a minimal valid HTML document (DOCTYPE, html, head, body) and an HTML-escaped error message. Do not inject raw `err.message` without escaping.

### 3. Increase admin script load timeout (cold start)

**Change in [portal_scripts.html](portal_scripts.html):** Increase the timeout from 20s to 50s (use a constant e.g. `ADMIN_SCRIPT_LOAD_TIMEOUT_MS = 50000`).

### 4. Keep preload; ensure it uses the same URL

After step 1, `ADMIN_SCRIPT_SRC` will be `?asset=admin`; preload in [client_portal.html](client_portal.html) will resolve relative to the document URL. No change required unless you add a version query (step 5).

### 5. Optional: Cache-bust admin script by version

In [webapp.js](webapp.js), append version to admin script URL (e.g. `?asset=admin&v=2.2.6` from `CONFIG.Sygnalist_VERSION`). In [portal_scripts.html](portal_scripts.html), resolution already preserves the full query.

### 6. Optional: Server-side safety for `?asset=admin`

In [webapp.js](webapp.js), wrap the `asset === "admin"` block in try/catch. On catch, return a minimal JS string (with MimeType.JAVASCRIPT) that sets a global error flag and dispatches `sygnalist-admin-ready` so the client never receives HTML for the script tag.

### 7. Admin script always signals readiness; Retry UX

[admin_tab_script.html](admin_tab_script.html) already sets `_adminScriptLoaded` and dispatches `sygnalist-admin-ready` at the end of the IIFE. Retry button behavior stays as is.

---

## Files to touch

| File | Changes |
|------|--------|
| [webapp.js](webapp.js) | Use relative `"?asset=admin"` for `adminScriptSrc`; fix doGet catch to return valid HTML; optional version param and try/catch for `?asset=admin`. |
| [portal_scripts.html](portal_scripts.html) | Increase admin script load timeout to 50s (constant). |
| [client_portal.html](client_portal.html) | No change required; only if version param added, ensure preload href matches. |

---

## Verification

- Open the app as an admin profile from the deployment URL. Click Admin; admin script loads and Profiles (and other tabs) work.
- After inactivity (cold start), Admin either loads within 50s or shows "Admin took too long to load" with Retry; Retry succeeds when warm.
- Trigger a server error (e.g. temporarily break a dependency): portal shows the new minimal HTML error page, not a blank or malformed response; no "Malformed HTML content" exception.
- Confirm "Request timed out" pill only appears for Inbox/Tracker API, not for admin script load.
