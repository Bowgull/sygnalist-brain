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

  const targetId = String(profileId).trim();
  const keptRows = values.slice(1).filter(function (row) {
    return String(row[idxProfile] || "").trim() !== targetId;
  });
  const removed = (values.length - 1) - keptRows.length;
  if (removed === 0) return 0;

  sh.getRange(1, 1, 1, lastCol).setValues([headers]);
  if (keptRows.length > 0) {
    var numRows = keptRows.length;
    var numCols = lastCol;
    if (numRows !== keptRows.length) throw new Error("Engine_Inbox clear: range rows " + numRows + " != data rows " + keptRows.length);
    sh.getRange(2, 1, numRows, numCols).setValues(keptRows);
  }
  for (let r = lastRow; r >= 2 + keptRows.length; r--) {
    sh.deleteRow(r);
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
        case "salary_source": return "missing";
        case "added_at": return now;
        default: return "";
      }
    });
    return row;
  });

  if (rows.length) {
    var numRows = rows.length;
    var numCols = headers.length;
    if (numRows !== rows.length) throw new Error("Engine_Inbox write: range rows " + numRows + " != data rows " + rows.length);
    sh.getRange(sh.getLastRow() + 1, 1, numRows, numCols).setValues(rows);
  }

  return rows.length;
}
