# Admin Dashboard UX Upgrade — Audit Notes

## Files touched

| File | Change |
|------|--------|
| `admin_analytics.js` | Top Alerts formula: "No recent errors found" when no errors; QUERY uses D='error' or G='ERROR' and A2:G; call `formatAdminAnalytics_(sh)` at end; all Logs refs use A2: range to skip filter row. |
| `sheet_format.js` | Added `formatAdminAnalytics_`, `setLogFilterDropdowns_`, `applyLogsFilterFromRow1_`; updated `formatLogSheet_` (2-row freeze, filter row, header row 2, dropdowns); updated `formatAdminProfilesSheet_` (header/style, banding, widths); added `ensureAdminProfilesView_`. |
| `logging.js` | `ensureLogHeaders_`: new sheets get filter row + header (rows 1–2); existing sheets get one-time migration (insert row 1, set filter row). |
| `admin_profiles_onedit.js` | `onEdit`: branch for 📓 Logs row 1 → `applyLogsFilterFromRow1_(sheet)`. |
| `webapp.js` | `portal_api_`: added cases `getProfileList` (admin-only), `logAdminSwitch` (admin-only, logs switch). |
| `client_portal.html` | Profile section: added `#profileSwitcherWrap` and `#profileSwitcherSelect` for admin profile switcher. |
| `portal_scripts.html` | When `BOOT.profile.isAdmin`: show switcher, call `getProfileList`, populate select, on change call `logAdminSwitch` and navigate to `?profile=X&viewAs=1`. When not admin: hide switcher and Admin link. |
| `portal_styles.html` | Added `.profile-switcher-wrap`, `.profile-switcher-label`, `.profile-switcher-select`. |
| `logs_export.js` | Export reads from Logs rows 2–lastRow (header row 2, data from 3); `lastRow < 3` check; 7 columns including Level. |

## Functions touched

- **admin_analytics.js:** `refreshAdminAnalytics_`, `buildSectionTitle_` (section title background).
- **sheet_format.js:** `formatAdminAnalytics_` (new), `formatLogSheet_`, `setLogFilterDropdowns_` (new), `applyLogsFilterFromRow1_` (new), `formatAdminProfilesSheet_`, `ensureAdminProfilesView_` (new).
- **logging.js:** `ensureLogHeaders_`.
- **admin_profiles_onedit.js:** `onEdit`.
- **webapp.js:** `portal_api_` (getProfileList, logAdminSwitch).

## Unused code

- No functions or files were removed. No code was proven unused and deleted in this pass.

## Potential bugs / caveats

1. **Logs migration:** Existing workbooks with 📓 Logs already populated get row 1 inserted and headers moved to row 2. Any external references to "row 1 = headers" or fixed row numbers must use row 2 for headers and 3+ for data. All internal QUERY/COUNTIF in `admin_analytics.js` and `logs_export.js` were updated to A2: or row 2+.
2. **Filter criteria:** `applyLogsFilterFromRow1_` uses `removeColumnFilterCriteria`. If the Sheets API differs in some environments, clearing "All" may need a fallback (e.g. recreate filter).
3. **Admin Profiles View:** `ensureAdminProfilesView_()` depends on `loadProfiles_()`. If Admin_Profiles is missing or has no data, the View sheet is not created/updated.
4. **Profile switcher:** Non-admin users never receive profile list (API returns `ok: false, reason: "Forbidden"`). Admin link is hidden for non-admins; switcher is only shown when `BOOT.profile.isAdmin` is true.

## How to test

1. **Admin Analytics**
   - Menu → 📡 Sygnalist → 📊 Refresh Analytics.
   - Confirm: larger title row, KPI blocks readable, section titles with gray background, Top Alerts shows last 5 errors or "No recent errors found".
   - Run again and confirm formatting is stable (idempotent).

2. **Logs**
   - Ensure 📓 Logs has at least a few rows (or run an action that logs).
   - New workbook: confirm row 1 = filter bar ("All" in Profile/Action/Source/Level), row 2 = headers, row 3+ = data; freeze 2 rows; header font 12, row height 28.
   - Existing workbook: after first write/format, confirm row 1 was inserted and headers are in row 2.
   - Set dropdowns in row 1 to a specific Profile/Action/Source/Level; confirm table filters.
   - Append a log (e.g. run Health Check); confirm new row appends and format still applied.

3. **Admin Profiles**
   - Open Admin_Profiles sheet; confirm header styling (dark background, font 12), column widths, banding on data rows, status/isAdmin validation and highlighting.
   - After refreshing Analytics, confirm "Admin Profiles View" sheet exists with profileId, displayName, status, isAdmin, Lanes (read-only); Lanes shows comma-separated lane labels or "—".

4. **Web portal — admin profile switcher**
   - Open client portal as an **admin** profile (`?profile=<adminProfileId>` with that profile’s isAdmin=TRUE in Admin_Profiles).
   - Confirm "Switch to" dropdown appears in header; select another profile; confirm navigation to `?profile=<selected>&viewAs=1` and view-as banner shows.
   - Open client portal as a **non-admin** profile; confirm no "Switch to" dropdown and Admin link hidden.
   - As admin, open DevTools → Network; trigger getProfileList; confirm response includes profiles. As non-admin, call same (e.g. via console); confirm ok: false / Forbidden.

5. **Lane roles**
   - Confirm Admin Profiles View "Lanes (read-only)" column shows lanes from roleTracksJSON. Edit lanes only via Resume_Staging + Apply Approved Lanes (no new write path added).

6. **Soft lock / admin toggles**
   - No new toggles; status and isAdmin remain editable in Admin_Profiles with existing onEdit and validation. Confirm status dropdown and isAdmin dropdown still work and onEdit still runs.

## Summary of sheet/UI changes

- **📊 Admin_Analytics:** Larger title (font 18, row height 28), KPI block font 12 and row height 24, section titles with #e9ecef background, column widths 140/120. Top Alerts shows last 5 errors (Action=error or Level=ERROR) or "No recent errors found". Format re-applied on each refresh.
- **📓 Logs:** Row 1 = filter bar with dropdowns (Profile, Action, Source, Level) populated from data; row 2 = headers (font 12, height 28); row 3+ = data (font 11, height 26). Filter on full table; changing row 1 dropdowns applies filter. Append-only writes unchanged.
- **Admin_Profiles:** Header row styled (font 12, dark background), key column widths set, banding on data rows, status/isAdmin validation and highlight (isAdmin column light purple).
- **Admin Profiles View:** New sheet (created on analytics refresh) with profileId, displayName, status, isAdmin, Lanes (read-only). Lanes derived from roleTracksJSON; not editable here.
- **Client portal (admin only):** "Switch to" dropdown in header; lists other profiles; on select, logs switch and navigates to view-as URL. Non-admins do not see dropdown or Admin link.
