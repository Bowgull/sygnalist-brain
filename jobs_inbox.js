/**
 * jobs_inbox.js
 * Jobs_Inbox (Gmail intake staging) + Role_Bank (curated job store).
 * Manual-first; no triggers. URL is unique key for dedupe.
 */

var JOBS_INBOX_HEADERS = [
  "job_id", "created_at", "email_received_at", "title", "source", "url",
  "enrichment_status", "missing_fields", "role_id", "promoted_at", "notes",
  "company", "location", "work_mode", "job_family", "description_snippet",
  "job_summary", "why_fit"
];

var ROLE_BANK_HEADERS = [
  "url", "profile_id", "created_at", "company", "title", "source", "location",
  "work_mode", "job_family", "description_snippet", "job_summary", "why_fit"
];

/** Global_Job_Bank: same as Role_Bank but no profile_id; one row per job (dedupe by url). All clients can use this pool. */
var GLOBAL_JOB_BANK_HEADERS = [
  "url", "created_at", "company", "title", "source", "location",
  "work_mode", "job_family", "description_snippet", "job_summary", "why_fit"
];

var REQUIRED_FIELDS_FOR_PROMOTION = ["company", "location", "work_mode", "job_family", "description_snippet"];

function ensureJobsInboxSheet_() {
  var sh = ensureSheet_("Jobs_Inbox");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, JOBS_INBOX_HEADERS.length).setValues([JOBS_INBOX_HEADERS]);
    sh.getRange(1, 1, 1, JOBS_INBOX_HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    ensureHeaderRow_(sh, JOBS_INBOX_HEADERS);
  }
  if (typeof formatJobsInboxSheet_ === "function") formatJobsInboxSheet_(sh);
  return sh;
}

function ensureRoleBankSheet_() {
  var sh = ensureSheet_("Role_Bank");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, ROLE_BANK_HEADERS.length).setValues([ROLE_BANK_HEADERS]);
    sh.getRange(1, 1, 1, ROLE_BANK_HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    ensureHeaderRow_(sh, ROLE_BANK_HEADERS);
  }
  if (typeof formatRoleBankSheet_ === "function") formatRoleBankSheet_(sh);
  return sh;
}

function ensureGlobalJobBankSheet_() {
  var sh = ensureSheet_("Global_Job_Bank");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, GLOBAL_JOB_BANK_HEADERS.length).setValues([GLOBAL_JOB_BANK_HEADERS]);
    sh.getRange(1, 1, 1, GLOBAL_JOB_BANK_HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    ensureHeaderRow_(sh, GLOBAL_JOB_BANK_HEADERS);
  }
  return sh;
}

/**
 * Read all rows from Global_Job_Bank. Returns array of objects keyed by header.
 */
function readGlobalJobBank_() {
  ensureGlobalJobBankSheet_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Global_Job_Bank");
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var data = sh.getRange(1, 1, lastRow, GLOBAL_JOB_BANK_HEADERS.length).getValues();
  var headers = GLOBAL_JOB_BANK_HEADERS;
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}

/**
 * Upsert a job into Global_Job_Bank by url. No profile_id. Returns true if inserted/updated.
 */
function upsertGlobalJobBank_(job) {
  ensureGlobalJobBankSheet_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Global_Job_Bank");
  var norm = normalizeUrlForJobsInbox_(job.url);
  if (!norm) return false;

  var lastRow = sh.getLastRow();
  var headers = GLOBAL_JOB_BANK_HEADERS;
  var idxUrl = headers.indexOf("url");

  for (var r = 2; r <= (lastRow || 1); r++) {
    var rowUrl = sh.getRange(r, idxUrl + 1).getValue();
    if (normalizeUrlForJobsInbox_(rowUrl) === norm) {
      var row = headers.map(function(h) {
        if (h === "created_at") return sh.getRange(r, headers.indexOf("created_at") + 1).getValue() || new Date();
        return job[h] !== undefined ? job[h] : sh.getRange(r, headers.indexOf(h) + 1).getValue();
      });
      var idxCa = headers.indexOf("created_at");
      if (!row[idxCa]) row[idxCa] = new Date();
      sh.getRange(r, 1, r, headers.length).setValues([row]);
      return true;
    }
  }

  var now = new Date();
  var newRow = headers.map(function(h) {
    if (h === "url") return job.url || "";
    if (h === "created_at") return now;
    return job[h] !== undefined ? job[h] : "";
  });
  sh.appendRow(newRow);
  return true;
}

/**
 * Check if normalized URL exists in Jobs_Inbox or Role_Bank.
 */
function urlExistsInJobsInboxOrRoleBank_(url) {
  var norm = normalizeUrlForJobsInbox_(url);
  if (!norm) return false;

  ensureJobsInboxSheet_();
  ensureRoleBankSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shInbox = ss.getSheetByName("Jobs_Inbox");
  var shBank = ss.getSheetByName("Role_Bank");

  if (shInbox) {
    var lastRow = shInbox.getLastRow();
    if (lastRow >= 2) {
      var idxUrl = getJobsInboxHeaderIndex_(shInbox, "url");
      if (idxUrl !== -1) {
        var urls = shInbox.getRange(2, idxUrl + 1, lastRow, idxUrl + 1).getValues();
        for (var i = 0; i < urls.length; i++) {
          if (normalizeUrlForJobsInbox_(urls[i][0]) === norm) return true;
        }
      }
    }
  }

  if (shBank) {
    var lastRow = shBank.getLastRow();
    if (lastRow >= 2) {
      var idxUrl = getRoleBankHeaderIndex_(shBank, "url");
      if (idxUrl !== -1) {
        var urls = shBank.getRange(2, idxUrl + 1, lastRow, idxUrl + 1).getValues();
        for (var j = 0; j < urls.length; j++) {
          if (normalizeUrlForJobsInbox_(urls[j][0]) === norm) return true;
        }
      }
    }
  }

  return false;
}

/**
 * Return a set (object) of all normalized URLs in Jobs_Inbox and Role_Bank.
 * Used by Gmail ingest to avoid O(N) full-column reads per URL.
 */
function getExistingNormalizedUrlsForIngest_() {
  ensureJobsInboxSheet_();
  ensureRoleBankSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var set = {};
  var shInbox = ss.getSheetByName("Jobs_Inbox");
  if (shInbox) {
    var lastRow = shInbox.getLastRow();
    if (lastRow >= 2) {
      var idxUrl = getJobsInboxHeaderIndex_(shInbox, "url");
      if (idxUrl !== -1) {
        var urls = shInbox.getRange(2, idxUrl + 1, lastRow, idxUrl + 1).getValues();
        for (var i = 0; i < urls.length; i++) {
          var n = normalizeUrlForJobsInbox_(urls[i][0]);
          if (n) set[n] = true;
        }
      }
    }
  }
  var shBank = ss.getSheetByName("Role_Bank");
  if (shBank) {
    var lastRow = shBank.getLastRow();
    if (lastRow >= 2) {
      var idxUrl = getRoleBankHeaderIndex_(shBank, "url");
      if (idxUrl !== -1) {
        var urls = shBank.getRange(2, idxUrl + 1, lastRow, idxUrl + 1).getValues();
        for (var j = 0; j < urls.length; j++) {
          var n = normalizeUrlForJobsInbox_(urls[j][0]);
          if (n) set[n] = true;
        }
      }
    }
  }
  return set;
}

/**
 * Normalize URL for Jobs_Inbox/Role_Bank dedupe. Uses core normalizeUrl_ + strips mc_* params.
 */
function normalizeUrlForJobsInbox_(url) {
  var u = String(url || "").trim();
  if (!u) return "";
  if (u.indexOf("http") !== 0) return "";
  u = normalizeUrl_(url);
  if (u.indexOf("?") !== -1) {
    var parts = u.split("?");
    var base = parts[0];
    var qs = parts.slice(1).join("?");
    var kept = [];
    qs.split("&").forEach(function(pair) {
      var p = String(pair || "").trim();
      if (!p) return;
      var k = p.split("=")[0].toLowerCase().trim();
      if (k.indexOf("mc_") === 0) return;
      kept.push(p);
    });
    u = kept.length ? (base + "?" + kept.join("&")) : base;
  }
  return u;
}

function getJobsInboxHeaderIndex_(sh, headerName) {
  var row1 = sh.getRange(1, 1, 1, JOBS_INBOX_HEADERS.length).getValues()[0];
  for (var i = 0; i < row1.length; i++) {
    if (String(row1[i] || "").trim().toLowerCase() === String(headerName || "").trim().toLowerCase()) return i;
  }
  return -1;
}

function getRoleBankHeaderIndex_(sh, headerName) {
  var row1 = sh.getRange(1, 1, 1, ROLE_BANK_HEADERS.length).getValues()[0];
  for (var i = 0; i < row1.length; i++) {
    if (String(row1[i] || "").trim().toLowerCase() === String(headerName || "").trim().toLowerCase()) return i;
  }
  return -1;
}

/**
 * Read Jobs_Inbox rows, optionally filtered by enrichment_status.
 * filterStatuses: array e.g. ["NEW", "NEEDS_ENRICHMENT"] or null for all.
 */
function readJobsInbox_(filterStatuses) {
  ensureJobsInboxSheet_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jobs_Inbox");
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var data = sh.getRange(1, 1, lastRow, JOBS_INBOX_HEADERS.length).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var idxStatus = headers.indexOf("enrichment_status");

  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    obj._rowIndex = r + 1;
    if (filterStatuses && Array.isArray(filterStatuses) && filterStatuses.length > 0) {
      var status = String(row[idxStatus] || "").trim();
      if (filterStatuses.indexOf(status) === -1) continue;
    }
    out.push(obj);
  }
  return out;
}

/**
 * Compute missing_fields for a job object.
 */
function computeMissingFields_(obj) {
  var missing = [];
  for (var i = 0; i < REQUIRED_FIELDS_FOR_PROMOTION.length; i++) {
    var k = REQUIRED_FIELDS_FOR_PROMOTION[i];
    var v = obj && obj[k];
    if (!v || String(v).trim() === "") missing.push(k);
  }
  return missing.join(", ") || "";
}

/**
 * Batch append rows to Jobs_Inbox.
 * rows: array of objects keyed by header name, or arrays in header order.
 */
function writeJobsInboxRows_(rows) {
  if (!rows || rows.length === 0) return 0;
  ensureJobsInboxSheet_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jobs_Inbox");
  var lastRow = sh.getLastRow();
  var headers = JOBS_INBOX_HEADERS;
  var numCols = headers.length;
  var arr = rows.map(function(r) {
    if (Array.isArray(r)) return r.slice(0, numCols);
    return headers.map(function(h) { return r[h] !== undefined ? r[h] : ""; });
  });
  var startRow = lastRow + 1;
  sh.getRange(startRow, 1, arr.length, numCols).setValues(arr);
  return arr.length;
}

/**
 * Update a single Jobs_Inbox row by job_id (or row index).
 */
function updateJobsInboxRow_(jobIdOrRowIndex, patch) {
  ensureJobsInboxSheet_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jobs_Inbox");
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return false;

  var data = sh.getRange(1, 1, lastRow, JOBS_INBOX_HEADERS.length).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var rowIndex = -1;

  if (typeof jobIdOrRowIndex === "number") {
    rowIndex = jobIdOrRowIndex;
  } else {
    var idxId = headers.indexOf("job_id");
    if (idxId === -1) return false;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idxId] || "") === String(jobIdOrRowIndex || "")) {
        rowIndex = r + 1;
        break;
      }
    }
  }

  if (rowIndex < 2) return false;

  for (var key in patch) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    var idx = headers.indexOf(key);
    if (idx === -1) continue;
    sh.getRange(rowIndex, idx + 1).setValue(patch[key]);
  }

  if (patch.missing_fields === undefined && (patch.company || patch.location || patch.work_mode || patch.job_family || patch.description_snippet)) {
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) rowObj[headers[c]] = data[rowIndex - 1][c];
    for (var k in patch) if (patch.hasOwnProperty(k)) rowObj[k] = patch[k];
    var mf = computeMissingFields_(rowObj);
    var idxMf = headers.indexOf("missing_fields");
    if (idxMf !== -1) sh.getRange(rowIndex, idxMf + 1).setValue(mf);
    var idxStatus = headers.indexOf("enrichment_status");
    if (idxStatus !== -1 && !mf) sh.getRange(rowIndex, idxStatus + 1).setValue("ENRICHED");
  }

  return true;
}

/**
 * Permanently delete a Jobs_Inbox row by job_id. Returns true if deleted, false if not found.
 */
function deleteJobsInboxRow_(jobId) {
  ensureJobsInboxSheet_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jobs_Inbox");
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return false;

  var data = sh.getRange(1, 1, lastRow, JOBS_INBOX_HEADERS.length).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var idxId = headers.indexOf("job_id");
  if (idxId === -1) return false;

  var rowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idxId] || "") === String(jobId || "")) {
      rowIndex = r + 1;
      break;
    }
  }
  if (rowIndex < 2) return false;

  sh.deleteRow(rowIndex);
  return true;
}

/**
 * Read Role_Bank rows for a profile.
 */
function getCuratedJobsForProfile_(profileId) {
  ensureRoleBankSheet_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Role_Bank");
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var data = sh.getRange(1, 1, lastRow, ROLE_BANK_HEADERS.length).getValues();
  var headers = data[0].map(function(h) { return String(h || "").trim(); });
  var idxProfile = headers.indexOf("profile_id");
  if (idxProfile === -1) return [];

  var pid = String(profileId || "").trim();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idxProfile] || "").trim() !== pid) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = data[r][c];
    out.push(obj);
  }
  return out;
}

/**
 * Upsert a job into Role_Bank by url + profile_id. Returns true if inserted/updated.
 */
function upsertRoleBank_(job, profileId) {
  ensureRoleBankSheet_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Role_Bank");
  var norm = normalizeUrlForJobsInbox_(job.url);
  if (!norm) return false;

  var lastRow = sh.getLastRow();
  var headers = ROLE_BANK_HEADERS;
  var idxUrl = headers.indexOf("url");
  var idxProfile = headers.indexOf("profile_id");
  var pid = String(profileId || "").trim();

  for (var r = 2; r <= (lastRow || 1); r++) {
    var rowUrl = sh.getRange(r, idxUrl + 1).getValue();
    var rowProfile = sh.getRange(r, idxProfile + 1).getValue();
    if (normalizeUrlForJobsInbox_(rowUrl) === norm && String(rowProfile || "").trim() === pid) {
      var row = [];
      for (var c = 0; c < headers.length; c++) {
        var val = job[headers[c]];
        if (val === undefined) val = sh.getRange(r, c + 1).getValue();
        row.push(val);
      }
      var idxCa = headers.indexOf("created_at");
      if (!row[idxCa]) row[idxCa] = new Date();
      sh.getRange(r, 1, r, headers.length).setValues([row]);
      return true;
    }
  }

  var now = new Date();
  var newRow = headers.map(function(h) {
    if (h === "url") return job.url || "";
    if (h === "profile_id") return profileId || "";
    if (h === "created_at") return now;
    return job[h] !== undefined ? job[h] : "";
  });
  sh.appendRow(newRow);
  return true;
}
