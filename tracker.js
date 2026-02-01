/****************************************************
 * tracker.gs
 * Engine_Tracker helpers
 *
 * Stable rules:
 * - Always per-profile dedupe (URL first, fallback company||title)
 * - Normalize URLs (strip utm/ref/source, fragments, trailing slash)
 * - Writes via setValues (not appendRow)
 * - Tracker updates are patch-based + locked by caller
 ****************************************************/

/**
 * Build tracker entry DTO from an enriched job card.
 * NOTE: Store added_at as Date for Sheets sanity.
 */
function buildTrackerEntryFromEnrichedJob_(job, profileId) {
  const j = job || {};
  return {
    profileId: String(profileId || "").trim(),
    added_at: new Date(),
    company: String(j.company || "").trim(),
    title: String(j.title || "").trim(),
    url: String(j.url || "").trim(),
    source: String(j.source || "").trim(),
    dateApplied: "", // blank by default
    status: "Prospect",
    location: String(j.location || "").trim(),
    roleType: String(j.roleType || "").trim(),
    laneLabel: String(j.laneLabel || "").trim(),
    category: String(j.category || "").trim(),
    jobSummary: String(j.jobSummary || "").trim(),
    whyFit: String(j.whyFit || "").trim(),
    notes: ""
  };
}

/**
 * Strict dedupe for a given profile.
 * Primary: normalized URL
 * Fallback: company||title key (only when URL missing)
 */
function trackerHasDuplicate_(entry) {
  ensureEngineTables_();

  const sh = assertSheetExists_("Engine_Tracker");
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return false;

  const headers = values[0].map(h => String(h).trim());

  const idxProfile = headers.indexOf("profileId");
  const idxCompany = headers.indexOf("company");
  const idxTitle = headers.indexOf("title");
  const idxUrl = headers.indexOf("url");

  if (idxProfile === -1) throw new Error("Engine_Tracker missing header: profileId");
  if (idxCompany === -1) throw new Error("Engine_Tracker missing header: company");
  if (idxTitle === -1) throw new Error("Engine_Tracker missing header: title");
  if (idxUrl === -1) throw new Error("Engine_Tracker missing header: url");

  const pid = String(entry && entry.profileId || "").trim();
  if (!pid) throw new Error("trackerHasDuplicate_: entry.profileId is empty.");

  const entryUrl = normalizeUrl_(entry && entry.url);
  const entryKey = fallbackKey_(entry && entry.company, entry && entry.title);

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;

    const rowUrl = normalizeUrl_(row[idxUrl]);
    if (entryUrl && rowUrl && rowUrl === entryUrl) return true;

    if (!entryUrl && entryKey) {
      const rowKey = fallbackKey_(row[idxCompany], row[idxTitle]);
      if (rowKey && rowKey === entryKey) return true;
    }
  }

  return false;
}

/**
 * Append a tracker entry (header-driven mapping).
 * Uses setValues instead of appendRow for consistency + speed.
 */
function appendTrackerEntry_(entry) {
  ensureEngineTables_();

  const sh = assertSheetExists_("Engine_Tracker");
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());

  const row = headers.map(h => {
    switch (h) {
      case "profileId": return entry.profileId;
      case "added_at": return (entry.added_at instanceof Date) ? entry.added_at : new Date(entry.added_at);
      case "company": return entry.company;
      case "title": return entry.title;
      case "url": return entry.url;
      case "source": return entry.source;
      case "dateApplied": return entry.dateApplied ? entry.dateApplied : "";
      case "status": return entry.status || "Prospect";
      case "location": return entry.location || "";
      case "roleType": return entry.roleType || "";
      case "laneLabel": return entry.laneLabel || "";
      case "category": return entry.category || "";
      case "jobSummary": return entry.jobSummary || "";
      case "whyFit": return entry.whyFit || "";
      case "notes": return entry.notes || "";
      default: return "";
    }
  });

  sh.getRange(sh.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
}

/**
 * Patch update for tracker entry (per profile).
 * Matches by normalized URL (preferred) else fallback company||title.
 *
 * patch shape (expected):
 * { url, company, title, status, notes, dateApplied }
 */
function updateTrackerEntryForProfile_(profileId, patch) {
  ensureEngineTables_();

  const pid = String(profileId || "").trim();
  if (!pid) throw new Error("updateTrackerEntryForProfile_: profileId empty.");

  const sh = assertSheetExists_("Engine_Tracker");
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return { updated: 0 };

  const headers = values[0].map(h => String(h).trim());

  const idxProfile = headers.indexOf("profileId");
  const idxUrl = headers.indexOf("url");
  const idxCompany = headers.indexOf("company");
  const idxTitle = headers.indexOf("title");
  const idxStatus = headers.indexOf("status");
  const idxNotes = headers.indexOf("notes");
  const idxDateApplied = headers.indexOf("dateApplied");

  if (idxProfile === -1) throw new Error("Engine_Tracker missing header: profileId");
  if (idxUrl === -1) throw new Error("Engine_Tracker missing header: url");
  if (idxCompany === -1) throw new Error("Engine_Tracker missing header: company");
  if (idxTitle === -1) throw new Error("Engine_Tracker missing header: title");
  if (idxStatus === -1) throw new Error("Engine_Tracker missing header: status");
  if (idxNotes === -1) throw new Error("Engine_Tracker missing header: notes");
  if (idxDateApplied === -1) throw new Error("Engine_Tracker missing header: dateApplied");

  const wantUrl = normalizeUrl_(patch && patch.url);

  const wantCompany = String(patch && patch.company || "").toLowerCase().trim();
  const wantTitle = String(patch && patch.title || "").toLowerCase().trim();
  const wantKey = (wantCompany && wantTitle) ? (wantCompany + "||" + wantTitle) : "";

  const newStatus = String(patch && patch.status || "").trim();
  const newNotes = String(patch && patch.notes || "").trim();
  const newDate = String(patch && patch.dateApplied || "").trim(); // yyyy-mm-dd

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;

    const rowUrl = normalizeUrl_(row[idxUrl]);

    const rowCompany = String(row[idxCompany] || "").toLowerCase().trim();
    const rowTitle = String(row[idxTitle] || "").toLowerCase().trim();
    const rowKey = (rowCompany && rowTitle) ? (rowCompany + "||" + rowTitle) : "";

    const match =
      (wantUrl && rowUrl && rowUrl === wantUrl) ||
      (!wantUrl && wantKey && rowKey && rowKey === wantKey);

    if (!match) continue;

    // status only if provided (lets UI keep it stable)
    if (newStatus) sh.getRange(r + 1, idxStatus + 1).setValue(newStatus);

    // notes always set (allows clearing)
    sh.getRange(r + 1, idxNotes + 1).setValue(newNotes);

    // dateApplied: set to Date or clear
    if (newDate) {
      const d = new Date(newDate);
      if (isNaN(d.getTime())) throw new Error("Invalid dateApplied: " + newDate);
      sh.getRange(r + 1, idxDateApplied + 1).setValue(d);
    } else {
      sh.getRange(r + 1, idxDateApplied + 1).setValue("");
    }

    return { updated: 1 };
  }

  return { updated: 0 };
}

/****************************************************
 * helpers
 * Note: normalizeUrl_() and buildFallbackKey_() are in core_utils.js
 ****************************************************/

// Legacy alias for backward compatibility
function fallbackKey_(company, title) {
  return buildFallbackKey_(company, title);
}
