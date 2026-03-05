# Admin Sheets — What Josh Edits vs What Not to Touch

Use this as a quick reference when editing the Sygnalist Google Sheets cockpit. Lanes are managed only via **Resume_Staging** and **Apply Approved Lanes**; do not edit roleTracksJSON by hand.

---

## 📓 Logs

| | |
|--|--|
| **What Josh edits here (safe controls)** | Filter dropdowns on row 1 (Profile, Action, Source, Level) to narrow the view. No need to edit data rows. |
| **What Josh must NOT touch (system / brittle)** | Do not delete or reorder columns A–G. Do not insert rows above row 2 (header row). Data rows are written by the app. |

---

## Admin_Profiles

| | |
|--|--|
| **What Josh edits here (safe controls)** | displayName, email, status (active / inactive_soft_locked), statusReason, isAdmin (TRUE/FALSE), and preference/skill columns (e.g. salaryMin, preferredLocations, skillProfileText, topSkills, signatureStories). **currentCity** and **distanceRangeKm** (number: 40 = 25 mi, 80 = 50 mi, 161 = 100 mi, 999 = Any) are used for location scoring; add a column **distanceRangeKm** if missing. **Lanes are changed only via Resume_Staging + "Apply Approved Lanes."** **Preferred countries:** Sygnalist serves Canadian and US clients only; preferred countries should be "United States" and/or "Canada". The admin and sidebar Create/Edit UI restrict to these two. |
| **What Josh must NOT touch (system / brittle)** | profileId (breaks lookups). roleTracksJSON, laneControlsJSON (JSON must stay valid; edit lanes via Resume_Staging only). portalSpreadsheetId, webAppUrl, last_fetch_at (system-managed). |

---

## Resume_Staging

| | |
|--|--|
| **What Josh edits here (safe controls)** | **Approved** = "Include lane on next Apply." Check the Approved box for lanes you want, then run the menu **Apply Approved Lanes**. **Applied** = "Already applied to roleTracksJSON" (read-only after apply). |
| **What Josh must NOT touch (system / brittle)** | Do not rename column headers. Do not insert rows above row 1. Do not delete columns. profileId, roleTitle, keywords, reason are written by Resume Parse or are structural. |

---

## Lane_Role_Bank

| | |
|--|--|
| **What Josh edits here (safe controls)** | Add or edit rows (id, lane_key, role_name, aliases). Check or uncheck **is_active** to include or exclude a role from the bank. Free-form text; no new tabs/columns. |
| **What Josh must NOT touch (system / brittle)** | Do not rename or reorder columns. This sheet is a global taxonomy only; per-profile lane assignment is done via Resume_Staging + Apply Approved Lanes. |

---

## 📊 Admin_Analytics

| | |
|--|--|
| **What Josh edits here (safe controls)** | View only. Refresh via menu **📊 Refresh Analytics**. No editing of cells required. |
| **What Josh must NOT touch (system / brittle)** | Do not delete or edit formula cells; formulas depend on fixed column positions in other sheets. |

---

## Engine_Inbox / Engine_Tracker

| | |
|--|--|
| **What Josh edits here (safe controls)** | **Tracker:** status, notes, dateApplied, and GoodFit fields for pipeline management. **Inbox:** view only before promoting to Tracker. |
| **What Josh must NOT touch (system / brittle)** | Do not rename or reorder columns (Admin_Analytics and portal depend on letter positions). Do not delete profileId or url; dedupe and lookups depend on them. |
