# Audit: Why the header hasn't changed after deployment (client portal)

## Flow (how the client portal is served)

1. **webapp.js** `doGet(e)`: If URL has `profile` or `profileId` → `HtmlService.createTemplateFromFile("client_portal")` → `tpl.evaluate()`.
2. **client_portal.html** is the only HTML template for the client dashboard. It includes:
   - Line 12: `<?!= HtmlService.createHtmlOutputFromFile('portal_styles').getContent() ?>` (CSS inlined at serve time)
   - Line 389–390: `statusConfig` and `portal_scripts` (scripts inlined at serve time)
3. There is no other template or "client header" component; the header is inline in client_portal.html lines 240–325.
4. **File names:** GAS resolves `createTemplateFromFile("client_portal")` to the file **client_portal.html** (or .html extension by convention). Same for `portal_styles` → portal_styles.html, `portal_scripts` → portal_scripts.html. No case or extension mismatch in the repo.

So the only way the client portal header can change is if (a) the deployed app serves the **current** client_portal.html and portal_styles.html from this repo, and (b) the browser doesn’t serve a cached copy of the page.

---

## Root cause 1: Missing inline style on `<header>` (layout not guaranteed)

**Finding:** In **client_portal.html** line 240 the header tag is:

```html
<header class="app-header"><!-- header-build:20260207 -->
```

There is **no** `style` attribute on the `<header>` element. The plan was to add:

- `style="width:100%;display:flex;flex-direction:row;justify-content:space-between;align-items:center;"`

**Impact:** All header layout (full width, flex, space-between) comes only from **portal_styles.html** (`.app-header`). If that file is cached, not deployed, or overridden by another stylesheet (e.g. Tailwind), the header never gets `display: flex` or `justify-content: space-between`, so the right cluster won’t sit on the far right. The **.header-right** div does have an inline style (`margin-left:auto;display:flex;align-items:center;`), but without the parent `<header>` being flex, the layout is incomplete.

**Fix:** Add the layout inline style to the `<header>` tag so it does not depend on portal_styles. Optionally add `padding-right:0` so the cluster is flush to the right edge (see root cause 2).

---

## Root cause 2: Right padding on the header creates the visible “gap”

**Finding:** In **portal_styles.html** the `.app-header` block has:

```css
padding: var(--space-4) var(--space-3);
```

So there is right padding (`var(--space-3)`). The telemetry cluster is aligned to the right of the header’s **content box**, but there is always a gap between the rightmost control (“View as…”) and the actual right edge of the header bar.

**Impact:** Even when layout is correct, the header still looks “not flush” because of this padding.

**Fix:** Set the header’s right padding to 0 (or a small value). Can be done inline on the header (e.g. `padding-right:0`) so it can’t be overridden by cached CSS, or in portal_styles if you prefer to keep padding only in CSS after deployment is confirmed.

---

## Root cause 3: Debug instrumentation left in portal_scripts.html

**Finding:** In **portal_scripts.html** there is still a `// #region agent log` block at the start of `init()` that sends diagnostic data to `http://127.0.0.1:7242/ingest/...`. This was added for a previous debug session.

**Impact:** No functional impact on the header, but it’s unnecessary in production and can be removed for clarity.

**Fix:** Remove the entire `// #region agent log` … `// #endregion` block from portal_scripts.html.

---

## Deployment / cache (why “deployed new code” might not show)

- **Versioned deployments:** In Google Apps Script, a **Version** deployment serves the code as it was when that version was created. Editing the script (or this repo) and saving does **not** update an existing version. You must create a **new version** and deploy it (or use **Test** deployment, which uses the latest code).
- **Browser cache:** The browser may cache the full HTML of the client portal. Use a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) or an incognito window when testing.
- **Repo vs GAS:** If you deploy from the Apps Script editor, the editor must contain the same content as this repo (e.g. after pulling or copying client_portal.html and portal_styles.html). If the editor has an older copy, “deploying” will still serve the old header.

---

## Summary

| Issue | File | Fix |
|-------|------|-----|
| Header has no inline layout style | client_portal.html | Add `style="width:100%;display:flex;flex-direction:row;justify-content:space-between;align-items:center;padding-right:0;"` to `<header class="app-header">`. |
| Right padding causes gap | client_portal.html (inline) or portal_styles | Set header `padding-right:0` (done in same inline style above). |
| Leftover debug code | portal_scripts.html | Remove the `// #region agent log` … `// #endregion` block in `init()`. |

After applying these fixes, redeploy (new version or Test), open the client URL with `?profile=...` in incognito or after a hard refresh, and confirm the header layout and flush-right cluster.
