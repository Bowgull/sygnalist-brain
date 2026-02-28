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
    stageChangedAt: new Date(),
    location: String(j.location || "").trim(),
    roleType: String(j.roleType || "").trim(),
    laneLabel: String(j.laneLabel || "").trim(),
    category: String(j.category || "").trim(),
    jobSummary: String(j.jobSummary || "").trim(),
    whyFit: String(j.whyFit || "").trim(),
    salary: String(j.salary || "").trim() || "",
    goodFit: "",
    goodFitUpdatedAt: "",
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
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return false;
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
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
      case "stageChangedAt": return (entry.stageChangedAt instanceof Date) ? entry.stageChangedAt : (entry.stageChangedAt ? new Date(entry.stageChangedAt) : entry.added_at instanceof Date ? entry.added_at : new Date(entry.added_at));
      case "location": return entry.location || "";
      case "roleType": return entry.roleType || "";
      case "laneLabel": return entry.laneLabel || "";
      case "category": return entry.category || "";
      case "jobSummary": return entry.jobSummary || "";
      case "whyFit": return entry.whyFit || "";
      case "salary": return entry.salary || "";
      case "goodFit": return entry.goodFit || "";
      case "goodFitUpdatedAt": return entry.goodFitUpdatedAt || "";
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
 * { url, company, title, status, notes, dateApplied, location?, salary?, title?, company? }
 * Optional: location, title, salary, company (client-editable job details).
 */
function updateTrackerEntryForProfile_(profileId, patch) {
  ensureEngineTrackerSheet_();

  const pid = String(profileId || "").trim();
  if (!pid) throw new Error("updateTrackerEntryForProfile_: profileId empty.");

  const sh = assertSheetExists_("Engine_Tracker");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { updated: 0 };
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 2) return { updated: 0 };

  const headers = values[0].map(h => String(h).trim());

  const idxProfile = headers.indexOf("profileId");
  const idxUrl = headers.indexOf("url");
  const idxCompany = headers.indexOf("company");
  const idxTitle = headers.indexOf("title");
  const idxStatus = headers.indexOf("status");
  const idxNotes = headers.indexOf("notes");
  const idxDateApplied = headers.indexOf("dateApplied");
  const idxStageChangedAt = headers.indexOf("stageChangedAt");
  const idxLocation = headers.indexOf("location");
  const idxSalary = headers.indexOf("salary");

  if (idxProfile === -1) throw new Error("Engine_Tracker missing header: profileId");
  if (idxUrl === -1) throw new Error("Engine_Tracker missing header: url");
  if (idxCompany === -1) throw new Error("Engine_Tracker missing header: company");
  if (idxTitle === -1) throw new Error("Engine_Tracker missing header: title");
  if (idxStatus === -1) throw new Error("Engine_Tracker missing header: status");
  if (idxNotes === -1) throw new Error("Engine_Tracker missing header: notes");
  if (idxDateApplied === -1) throw new Error("Engine_Tracker missing header: dateApplied");
  // stageChangedAt optional (backfill: use added_at when missing)

  const wantUrl = normalizeUrl_(patch && patch.url);
  const matchCompany = (patch && patch.matchCompany !== undefined) ? String(patch.matchCompany || "").toLowerCase().trim() : null;
  const matchTitle = (patch && patch.matchTitle !== undefined) ? String(patch.matchTitle || "").toLowerCase().trim() : null;
  const wantCompany = (matchCompany !== null ? matchCompany : String(patch && patch.company || "").toLowerCase().trim());
  const wantTitle = (matchTitle !== null ? matchTitle : String(patch && patch.title || "").toLowerCase().trim());
  const wantKey = (wantCompany && wantTitle) ? (wantCompany + "||" + wantTitle) : "";

  const newStatus = String(patch && patch.status || "").trim();
  const newNotes = String(patch && patch.notes || "").trim();
  const newDate = String(patch && patch.dateApplied || "").trim(); // yyyy-mm-dd
  const newLocation = (patch && patch.location !== undefined) ? String(patch.location || "").trim() : null;
  const newTitle = (patch && patch.title !== undefined) ? String(patch.title || "").trim() : null;
  const newCompany = (patch && patch.company !== undefined) ? String(patch.company || "").trim() : null;
  const newSalary = (patch && patch.salary !== undefined && patch.salary !== null) ? String(patch.salary).trim() : null;

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

    const oldStatus = String(row[idxStatus] || "").trim();

    const indicesToUpdate = [idxStatus, idxNotes, idxDateApplied];
    if (idxStageChangedAt !== -1) indicesToUpdate.push(idxStageChangedAt);
    if (idxLocation !== -1 && newLocation !== null) indicesToUpdate.push(idxLocation);
    if (idxTitle !== -1 && newTitle !== null) indicesToUpdate.push(idxTitle);
    if (idxCompany !== -1 && newCompany !== null) indicesToUpdate.push(idxCompany);
    if (idxSalary !== -1 && newSalary !== null) indicesToUpdate.push(idxSalary);
    const minCol = Math.min.apply(null, indicesToUpdate);
    const maxCol = Math.max.apply(null, indicesToUpdate);

    const dateAppliedValue = newDate
      ? (function () {
          const d = new Date(newDate);
          if (isNaN(d.getTime())) throw new Error("Invalid dateApplied: " + newDate);
          return d;
        })()
      : "";

    const slice = [];
    for (let c = minCol; c <= maxCol; c++) {
      let val = row[c];
      if (c === idxStatus) val = newStatus ? newStatus : row[idxStatus];
      else if (c === idxStageChangedAt) val = newStatus ? new Date() : row[idxStageChangedAt];
      else if (c === idxNotes) val = newNotes;
      else if (c === idxDateApplied) val = dateAppliedValue;
      else if (c === idxLocation && newLocation !== null) val = newLocation;
      else if (c === idxTitle && newTitle !== null) val = newTitle;
      else if (c === idxCompany && newCompany !== null) val = newCompany;
      else if (c === idxSalary && newSalary !== null) val = newSalary;
      slice.push(val);
    }
    sh.getRange(r + 1, minCol + 1, r + 1, maxCol + 1).setValues([slice]);

    if (oldStatus !== newStatus && !isInterviewStatus_(oldStatus) && isInterviewStatus_(newStatus)) {
      const trackerKey = (wantUrl && wantUrl.length) ? wantUrl : wantKey;
      const rowObject = {};
      for (let i = 0; i < headers.length; i++) {
        if (headers[i]) rowObject[headers[i]] = row[i];
      }
      rowObject.status = newStatus;
      rowObject.notes = newNotes;
      rowObject.dateApplied = dateAppliedValue;
      if (idxStageChangedAt !== -1) rowObject.stageChangedAt = newStatus ? new Date() : row[idxStageChangedAt];
      const statusesAtOrAfterApplied = ["Applied", "Interview 1", "Interview 2", "Final Round", "Offer 🎉"];
      let appliedCount = 0;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][idxProfile] || "").trim() !== pid) continue;
        const s = (i === r) ? newStatus : String(values[i][idxStatus] || "").trim();
        const lower = s.toLowerCase();
        const match = statusesAtOrAfterApplied.indexOf(s) !== -1 || lower.indexOf("applied") === 0 || lower.indexOf("interview") === 0 || lower.indexOf("offer") !== -1;
        if (match) appliedCount++;
      }
      try {
        onMovedToInterview_(pid, trackerKey, { oldStatus, newStatus, transitionedAtMs: Date.now() }, { row: rowObject, appliedCount: appliedCount });
      } catch (interviewErr) {
        // Do not block tracker update; interview email failure is logged inside onMovedToInterview_
      }
    }

    return { updated: 1 };
  }

  return { updated: 0 };
}

/**
 * Delete one tracker entry by profileId and trackerKey (url or company||title).
 * Returns { deleted: 1 } or { deleted: 0 } if not found.
 */
function deleteTrackerEntryForProfile_(profileId, trackerKey) {
  ensureEngineTables_();

  const pid = String(profileId || "").trim();
  if (!pid) throw new Error("deleteTrackerEntryForProfile_: profileId empty.");
  const keyStr = String(trackerKey || "").trim();
  if (!keyStr) throw new Error("deleteTrackerEntryForProfile_: trackerKey empty.");

  const sh = assertSheetExists_("Engine_Tracker");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { deleted: 0 };
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 2) return { deleted: 0 };

  const headers = values[0].map(h => String(h).trim());
  const idxProfile = headers.indexOf("profileId");
  const idxUrl = headers.indexOf("url");
  const idxCompany = headers.indexOf("company");
  const idxTitle = headers.indexOf("title");
  if (idxProfile === -1 || idxUrl === -1 || idxCompany === -1 || idxTitle === -1) return { deleted: 0 };

  const keyUrl = keyStr.indexOf("||") === -1 ? normalizeUrl_(keyStr) : "";
  const keyParts = keyStr.indexOf("||") !== -1 ? keyStr.split("||").map(s => s.trim().toLowerCase()) : [];
  const keyCompanyTitle = keyParts.length === 2 ? keyParts[0] + "||" + keyParts[1] : "";

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;

    const rowUrl = normalizeUrl_(row[idxUrl]);
    const rowCompany = String(row[idxCompany] || "").toLowerCase().trim();
    const rowTitle = String(row[idxTitle] || "").toLowerCase().trim();
    const rowKey = (rowCompany && rowTitle) ? (rowCompany + "||" + rowTitle) : "";

    const match =
      (keyUrl && rowUrl && rowUrl === keyUrl) ||
      (keyCompanyTitle && rowKey && rowKey === keyCompanyTitle);
    if (!match) continue;

    sh.deleteRow(r + 1);
    return { deleted: 1 };
  }
  return { deleted: 0 };
}

/**
 * Find one tracker row by profileId and key (url or company||title).
 * Returns row as object keyed by header names, or null if not found.
 */
function getTrackerRowByKey_(profileId, key) {
  ensureEngineTables_();

  const pid = String(profileId || "").trim();
  if (!pid) throw new Error("getTrackerRowByKey_: profileId empty.");
  const keyStr = String(key || "").trim();
  if (!keyStr) throw new Error("getTrackerRowByKey_: key empty.");

  const sh = assertSheetExists_("Engine_Tracker");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return null;
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 2) return null;

  const headers = values[0].map(h => String(h).trim());
  const idxProfile = headers.indexOf("profileId");
  const idxUrl = headers.indexOf("url");
  const idxCompany = headers.indexOf("company");
  const idxTitle = headers.indexOf("title");
  if (idxProfile === -1 || idxUrl === -1 || idxCompany === -1 || idxTitle === -1) return null;

  const keyUrl = keyStr.indexOf("||") === -1 ? normalizeUrl_(keyStr) : "";
  const keyParts = keyStr.indexOf("||") !== -1 ? keyStr.split("||").map(s => s.trim().toLowerCase()) : [];
  const keyCompanyTitle = keyParts.length === 2 ? keyParts[0] + "||" + keyParts[1] : "";

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;

    const rowUrl = normalizeUrl_(row[idxUrl]);
    const rowCompany = String(row[idxCompany] || "").toLowerCase().trim();
    const rowTitle = String(row[idxTitle] || "").toLowerCase().trim();
    const rowKey = (rowCompany && rowTitle) ? (rowCompany + "||" + rowTitle) : "";

    const match =
      (keyUrl && rowUrl && rowUrl === keyUrl) ||
      (keyCompanyTitle && rowKey && rowKey === keyCompanyTitle);
    if (!match) continue;

    const out = {};
    for (let i = 0; i < headers.length; i++) {
      if (headers[i]) out[headers[i]] = row[i];
    }
    return out;
  }
  return null;
}

/**
 * Update goodFit and goodFitUpdatedAt for one tracker row (by profileId + key).
 * Returns { updated: 1 } or { updated: 0 }.
 */
function updateTrackerRowGoodFit_(profileId, key, goodFitString) {
  ensureEngineTables_();

  const pid = String(profileId || "").trim();
  if (!pid) throw new Error("updateTrackerRowGoodFit_: profileId empty.");
  const keyStr = String(key || "").trim();
  if (!keyStr) throw new Error("updateTrackerRowGoodFit_: key empty.");

  const sh = assertSheetExists_("Engine_Tracker");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { updated: 0 };
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 2) return { updated: 0 };

  const headers = values[0].map(h => String(h).trim());
  const idxProfile = headers.indexOf("profileId");
  const idxUrl = headers.indexOf("url");
  const idxCompany = headers.indexOf("company");
  const idxTitle = headers.indexOf("title");
  const idxGoodFit = headers.indexOf("goodFit");
  const idxGoodFitUpdatedAt = headers.indexOf("goodFitUpdatedAt");
  if (idxProfile === -1 || idxUrl === -1 || idxCompany === -1 || idxTitle === -1) return { updated: 0 };
  if (idxGoodFit === -1 || idxGoodFitUpdatedAt === -1) return { updated: 0 };

  const keyUrl = keyStr.indexOf("||") === -1 ? normalizeUrl_(keyStr) : "";
  const keyParts = keyStr.indexOf("||") !== -1 ? keyStr.split("||").map(s => s.trim().toLowerCase()) : [];
  const keyCompanyTitle = keyParts.length === 2 ? keyParts[0] + "||" + keyParts[1] : "";

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;

    const rowUrl = normalizeUrl_(row[idxUrl]);
    const rowCompany = String(row[idxCompany] || "").toLowerCase().trim();
    const rowTitle = String(row[idxTitle] || "").toLowerCase().trim();
    const rowKey = (rowCompany && rowTitle) ? (rowCompany + "||" + rowTitle) : "";

    const match =
      (keyUrl && rowUrl && rowUrl === keyUrl) ||
      (keyCompanyTitle && rowKey && rowKey === keyCompanyTitle);
    if (!match) continue;

    sh.getRange(r + 1, idxGoodFit + 1).setValue(String(goodFitString || ""));
    sh.getRange(r + 1, idxGoodFitUpdatedAt + 1).setValue(new Date());
    return { updated: 1 };
  }
  return { updated: 0 };
}

/**
 * Return Set of key strings (normalized URL and company||title) for all tracker rows for a profile.
 * Used to exclude tracker jobs from inbox write so they do not reappear until released.
 */
function getTrackerKeyStringsForProfile_(profileId) {
  ensureEngineTables_();

  const pid = String(profileId || "").trim();
  if (!pid) return new Set();

  const sh = assertSheetExists_("Engine_Tracker");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return new Set();

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 2) return new Set();

  const headers = values[0].map(h => String(h).trim());
  const idxProfile = headers.indexOf("profileId");
  const idxUrl = headers.indexOf("url");
  const idxCompany = headers.indexOf("company");
  const idxTitle = headers.indexOf("title");
  if (idxProfile === -1 || idxUrl === -1 || idxCompany === -1 || idxTitle === -1) return new Set();

  const set = new Set();
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idxProfile] || "").trim() !== pid) continue;
    const u = normalizeUrl_(row[idxUrl]);
    if (u) set.add(u);
    const k = buildFallbackKey_(row[idxCompany], row[idxTitle]);
    if (k) set.add(k);
  }
  return set;
}

/****************************************************
 * helpers
 * Note: normalizeUrl_() and buildFallbackKey_() are in core_utils.js
 ****************************************************/

// Legacy alias for backward compatibility
function fallbackKey_(company, title) {
  return buildFallbackKey_(company, title);
}
