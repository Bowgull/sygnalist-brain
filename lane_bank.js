/**
 * lane_bank.js
 * Lane Role Bank: global taxonomy of lanes and roles.
 * Sheet: Lane_Role_Bank. Columns: id, lane_key, role_name, aliases, is_active, created_at, updated_at
 */

var LANE_ROLE_BANK_HEADERS = ["id", "lane_key", "role_name", "aliases", "is_active", "created_at", "updated_at"];

function ensureLaneRoleBankSheet_() {
  var sh = ensureSheet_("Lane_Role_Bank");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, LANE_ROLE_BANK_HEADERS.length).setValues([LANE_ROLE_BANK_HEADERS]);
    sh.getRange(1, 1, 1, LANE_ROLE_BANK_HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  if (typeof formatLaneRoleBankSheet_ === "function") formatLaneRoleBankSheet_(sh);
  return sh;
}

/**
 * Returns active bank rows as array of { id, lane_key, role_name, aliases (string[]), is_active }.
 * Used by resolver and UI. Ensures sheet exists on first read.
 */
function getLaneRoleBank_() {
  var sh = ensureLaneRoleBankSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var data = sh.getRange(1, 1, lastRow, LANE_ROLE_BANK_HEADERS.length).getValues();
  var headers = data[0].map(function (h) { return String(h || "").trim(); });
  var idxId = headers.indexOf("id");
  var idxLane = headers.indexOf("lane_key");
  var idxRole = headers.indexOf("role_name");
  var idxAliases = headers.indexOf("aliases");
  var idxActive = headers.indexOf("is_active");

  if (idxLane === -1 || idxRole === -1) return [];

  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var isActive = row[idxActive];
    if (isActive === false || String(isActive || "").toLowerCase().trim() === "false") continue;

    var aliasesStr = String(row[idxAliases] != null ? row[idxAliases] : "").trim();
    var aliases = aliasesStr ? aliasesStr.split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean) : [];

    out.push({
      id: String(row[idxId] != null ? row[idxId] : "").trim() || ("bank_" + r),
      lane_key: String(row[idxLane] != null ? row[idxLane] : "").trim(),
      role_name: String(row[idxRole] != null ? row[idxRole] : "").trim(),
      aliases: aliases,
      is_active: true
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
