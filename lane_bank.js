/**
 * lane_bank.js
 * Lane Role Bank: global taxonomy of lanes and roles.
 * Sheet: Lane_Role_Bank. Columns: id, lane_key, role_name, aliases, is_active, created_at, updated_at [, status, role_slug, source, merged_into_id ]
 */

var LANE_ROLE_BANK_HEADERS = ["id", "lane_key", "role_name", "aliases", "is_active", "created_at", "updated_at", "status", "role_slug", "source", "merged_into_id"];
var LANE_ROLE_BANK_LEGACY_COLS = 7;

/**
 * Normalize role title for comparison/slug: trim, toLowerCase, collapse spaces, strip non-alphanumeric.
 * Used everywhere for consistent dedupe.
 */
function normalizeRoleTitle_(title) {
  var s = String(title || "").trim().toLowerCase();
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[^a-z0-9\s]/g, "").trim();
  return s;
}

/**
 * Slug form for role_slug column: normalized title with spaces → underscores.
 */
function roleSlug_(title) {
  var n = normalizeRoleTitle_(title);
  return n.replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "general";
}

function ensureLaneRoleBankSheet_() {
  var sh = ensureSheet_("Lane_Role_Bank");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, LANE_ROLE_BANK_HEADERS.length).setValues([LANE_ROLE_BANK_HEADERS]);
    sh.getRange(1, 1, 1, LANE_ROLE_BANK_HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else {
    ensureLaneRoleBankColumns_(sh);
  }
  if (typeof formatLaneRoleBankSheet_ === "function") formatLaneRoleBankSheet_(sh);
  return sh;
}

/**
 * Ensure Option A columns exist; backfill existing rows with status=active, role_slug, source=manual.
 */
function ensureLaneRoleBankColumns_(sh) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 1) return;
  var headers = sh.getRange(1, 1, 1, Math.max(lastCol, 1)).getValues()[0].map(function (h) { return String(h || "").trim(); });
  if (headers.length >= LANE_ROLE_BANK_HEADERS.length) return;
  var idxStatus = headers.indexOf("status");
  if (idxStatus >= 0) return;
  for (var c = headers.length; c < LANE_ROLE_BANK_HEADERS.length; c++) {
    sh.getRange(1, c + 1).setValue(LANE_ROLE_BANK_HEADERS[c]);
  }
  var newHeaders = LANE_ROLE_BANK_HEADERS;
  var idxRole = headers.indexOf("role_name");
  var idxId = headers.indexOf("id");
  for (var r = 2; r <= lastRow; r++) {
    var statusVal = "active";
    var roleNameVal = sh.getRange(r, idxRole + 1).getValue();
    var roleSlugVal = roleSlug_(roleNameVal);
    sh.getRange(r, 8).setValue(statusVal);
    sh.getRange(r, 9).setValue(roleSlugVal);
    sh.getRange(r, 10).setValue("manual");
    sh.getRange(r, 11).setValue("");
  }
}

/**
 * Read Lane Role Bank. opts: { activeOnly: true } — only rows with status === 'active' (and is_active).
 * When activeOnly is false or omitted (admin), returns all rows. Returns same shape for resolver: id, lane_key, role_name, aliases[], is_active.
 */
function getLaneRoleBank_(opts) {
  var sh = ensureLaneRoleBankSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var numCols = Math.max(sh.getLastColumn(), LANE_ROLE_BANK_HEADERS.length);
  var data = sh.getRange(1, 1, lastRow, numCols).getValues();
  var headers = data[0].map(function (h) { return String(h || "").trim(); });
  var idxId = headers.indexOf("id");
  var idxLane = headers.indexOf("lane_key");
  var idxRole = headers.indexOf("role_name");
  var idxAliases = headers.indexOf("aliases");
  var idxActive = headers.indexOf("is_active");
  var idxStatus = headers.indexOf("status");
  var idxSource = headers.indexOf("source");

  if (idxLane === -1 || idxRole === -1) return [];

  var activeOnly = opts && opts.activeOnly === true;
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var isActive = row[idxActive];
    if (isActive === false || String(isActive || "").toLowerCase().trim() === "false") continue;
    var status = (idxStatus >= 0 && row[idxStatus] != null && String(row[idxStatus]).trim() !== "")
      ? String(row[idxStatus]).trim().toLowerCase() : "active";
    if (activeOnly && status !== "active") continue;

    var aliasesStr = String(row[idxAliases] != null ? row[idxAliases] : "").trim();
    var aliases = aliasesStr ? aliasesStr.split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
    var source = (idxSource >= 0 && row[idxSource] != null) ? String(row[idxSource] || "").trim() : "";

    out.push({
      id: String(row[idxId] != null ? row[idxId] : "").trim() || ("bank_" + r),
      lane_key: String(row[idxLane] != null ? row[idxLane] : "").trim(),
      role_name: String(row[idxRole] != null ? row[idxRole] : "").trim(),
      aliases: aliases,
      is_active: true,
      status: status,
      source: source
    });
  }
  return out;
}

/**
 * Append a new role to the Lane_Role_Bank. Used when a suggested role from resume parse is not in the bank.
 * role_name: display name; keywordsOrAliases: comma-separated keywords/aliases for search.
 * lane_key: optional; if missing, derived from role_name (slug).
 */
function addRoleToLaneBank_(lane_key, role_name, keywordsOrAliases) {
  var sh = ensureLaneRoleBankSheet_();
  var lastRow = sh.getLastRow();
  var role = String(role_name || "").trim();
  if (!role) throw new Error("role_name is required.");
  var lane = String(lane_key || "").trim();
  if (!lane) {
    lane = role.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "general";
  }
  var aliasesStr = String(keywordsOrAliases || "").trim();
  var id = role.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 24) + "_" + (lastRow + 1);
  var now = new Date().toISOString();
  var row = [id, lane, role, aliasesStr, true, now, now];
  sh.appendRow(row);
  return { id: id, lane_key: lane, role_name: role };
}

/**
 * Single write gateway: dedupe by role_slug then alias match; else create. Uses script lock 15s.
 * opts: { role_name, lane_key, aliases (string or array), source, statusDefault }. statusDefault defaults to 'pending'.
 * Returns { id, lane_key, role_name, status, created: boolean }.
 */
function upsertLaneRoleBankEntry_(opts) {
  var role_name = String(opts.role_name || "").trim();
  if (!role_name) throw new Error("role_name is required.");
  var lane_key = String(opts.lane_key || "").trim();
  if (!lane_key) lane_key = roleSlug_(role_name);
  var aliasesInput = opts.aliases;
  var aliasesStr = Array.isArray(aliasesInput)
    ? (aliasesInput.map(function (a) { return String(a || "").trim(); }).filter(Boolean).join(", "))
    : String(aliasesInput || "").trim();
  var source = String(opts.source || "").trim() || "manual";
  var statusDefault = String(opts.statusDefault || "pending").toLowerCase();
  if (statusDefault !== "active" && statusDefault !== "pending") statusDefault = "pending";

  var slug = roleSlug_(role_name);
  var aliasSlugs = [];
  if (aliasesStr) {
    var parts = aliasesStr.split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      var as = roleSlug_(parts[i]);
      if (as && aliasSlugs.indexOf(as) === -1) aliasSlugs.push(as);
    }
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error("System busy; try again.");

  try {
    var sh = ensureLaneRoleBankSheet_();
    ensureLaneRoleBankColumns_(sh);
    var lastRow = sh.getLastRow();
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || "").trim(); });
    var idxId = headers.indexOf("id");
    var idxLane = headers.indexOf("lane_key");
    var idxRole = headers.indexOf("role_name");
    var idxAliases = headers.indexOf("aliases");
    var idxStatus = headers.indexOf("status");
    var idxSlug = headers.indexOf("role_slug");
    var idxSource = headers.indexOf("source");
    var idxMerged = headers.indexOf("merged_into_id");
    var idxActive = headers.indexOf("is_active");
    var idxCreated = headers.indexOf("created_at");
    var idxUpdated = headers.indexOf("updated_at");

    if (lastRow < 2) {
      var now = new Date().toISOString();
      var id = slug.slice(0, 24) + "_1";
      var newRow = [id, lane_key, role_name, aliasesStr, true, now, now, statusDefault, slug, source, ""];
      sh.appendRow(newRow);
      return { id: id, lane_key: lane_key, role_name: role_name, status: statusDefault, created: true };
    }

    var data = sh.getRange(2, 1, lastRow, headers.length).getValues();
    for (var r = 0; r < data.length; r++) {
      var row = data[r];
      var rowStatus = (idxStatus >= 0 && row[idxStatus] != null) ? String(row[idxStatus]).trim().toLowerCase() : "active";
      if (rowStatus === "merged") continue;
      var rowSlug = (idxSlug >= 0 && row[idxSlug] != null && String(row[idxSlug]).trim() !== "")
        ? String(row[idxSlug]).trim() : roleSlug_(row[idxRole]);
      if (rowSlug === slug) {
        var id = String(row[idxId] != null ? row[idxId] : "").trim();
        return { id: id, lane_key: String(row[idxLane] || "").trim(), role_name: String(row[idxRole] || "").trim(), status: rowStatus, created: false };
      }
      var rowAliasesStr = (idxAliases >= 0 && row[idxAliases] != null) ? String(row[idxAliases]).trim() : "";
      if (rowAliasesStr) {
        var rowAliasParts = rowAliasesStr.split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
        for (var a = 0; a < rowAliasParts.length; a++) {
          var rowAliasSlug = roleSlug_(rowAliasParts[a]);
          if (rowAliasSlug === slug || aliasSlugs.indexOf(rowAliasSlug) !== -1) {
            var id = String(row[idxId] != null ? row[idxId] : "").trim();
            return { id: id, lane_key: String(row[idxLane] || "").trim(), role_name: String(row[idxRole] || "").trim(), status: rowStatus, created: false };
          }
        }
      }
    }

    var now = new Date().toISOString();
    var newId = slug.slice(0, 24) + "_" + (lastRow + 1);
    var newRow = [newId, lane_key, role_name, aliasesStr, true, now, now, statusDefault, slug, source, ""];
    sh.appendRow(newRow);
    return { id: newId, lane_key: lane_key, role_name: role_name, status: statusDefault, created: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Set status = 'active' and is_active = TRUE for the given bank row id.
 */
function promoteLaneRoleBankToActive_(id) {
  var sid = String(id || "").trim();
  if (!sid) throw new Error("id is required.");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error("System busy; try again.");
  try {
    var sh = ensureLaneRoleBankSheet_();
    ensureLaneRoleBankColumns_(sh);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || "").trim(); });
    var idxId = headers.indexOf("id");
    var idxStatus = headers.indexOf("status");
    var idxActive = headers.indexOf("is_active");
    if (idxId === -1 || idxStatus === -1) throw new Error("Lane_Role_Bank sheet missing id or status column.");
    var lastRow = sh.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      var rowId = String(sh.getRange(r, idxId + 1).getValue() || "").trim();
      if (rowId === sid) {
        sh.getRange(r, idxStatus + 1).setValue("active");
        if (idxActive >= 0) sh.getRange(r, idxActive + 1).setValue(true);
        return;
      }
    }
    throw new Error("Lane_Role_Bank row not found: " + sid);
  } finally {
    lock.releaseLock();
  }
}
