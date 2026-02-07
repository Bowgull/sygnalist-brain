function clearEngineInboxForProfile_(profileId) {
  ensureEngineTables_();
  const sh = assertSheetExists_("Engine_Inbox");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return 0;
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (values.length < 2) return 0;

  const headers = values[0];
  const idxProfile = headers.indexOf("profileId");
  if (idxProfile === -1) throw new Error("Engine_Inbox missing profileId header");

  let removed = 0;

  // Delete bottom-up to avoid index shifting
  for (let r = values.length - 1; r >= 1; r--) {
    if (String(values[r][idxProfile] || "").trim() === String(profileId).trim()) {
      sh.deleteRow(r + 1); // sheet rows are 1-indexed
      removed++;
    }
  }

  return removed;
}

function writeEngineInbox_(scoredJobs, profileId) {
  ensureEngineTables_();
  const sh = assertSheetExists_("Engine_Inbox");
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  // v1 behavior: clear and replace for that profile (as spec says)
  clearEngineInboxForProfile_(profileId);

  const now = new Date();
  const rows = (scoredJobs || []).map(j => {
    const row = headers.map(h => {
      switch (h) {
        case "profileId": return profileId;
        case "score": return Number(j.score || 0);
        case "tier": return String(j.tier || "");
        case "company": return String(j.company || "");
        case "title": return String(j.title || "");
        case "url": return String(j.url || "");
        case "source": return String(j.source || "");
        case "location": return j.location || "";
        case "roleType": return String(j.roleType || "");
        case "laneLabel": return String(j.laneLabel || "");
        case "category": return String(j.category || "");
        case "jobSummary": return ""; // NO AI YET
        case "whyFit": return "";     // NO AI YET
        case "salary": return "";
        case "added_at": return now;
        default: return "";
      }
    });
    return row;
  });

  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }

  return rows.length;
}
