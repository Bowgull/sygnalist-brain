/**
 * lane_resolver.js
 * Single source of truth: getEffectiveEnabledLanes, getEffectiveAllowedRoles, getEffectiveRoleTracks_.
 * When profile has laneControls: use bank + laneControls. Else: fallback to profile.roleTracks.
 */

/**
 * Returns array of lane_key strings that are enabled for this profile.
 * If profile has no laneControls, returns lane keys derived from roleTracks (laneLabel or label).
 */
function getEffectiveEnabledLanes(profileId) {
  var profile = getProfileById_(profileId);
  if (!profile) return [];

  if (profile.laneControls && typeof profile.laneControls === "object") {
    var lanes = [];
    for (var key in profile.laneControls) {
      if (!Object.prototype.hasOwnProperty.call(profile.laneControls, key)) continue;
      var c = profile.laneControls[key];
      if (c && c.is_enabled === true) lanes.push(String(key).trim());
    }
    return lanes;
  }

  var tracks = Array.isArray(profile.roleTracks) ? profile.roleTracks : [];
  var seen = {};
  tracks.forEach(function (t) {
    if (!t) return;
    var laneKey = (t.laneLabel && String(t.laneLabel).trim()) || (t.label && String(t.label).trim()) || "";
    if (laneKey && !seen[laneKey]) {
      seen[laneKey] = true;
    }
  });
  return Object.keys(seen);
}

/**
 * Returns array of allowed bank role ids for this profile (union across enabled lanes).
 * If profile has no laneControls, returns [] (caller uses roleTracks for fallback).
 */
function getEffectiveAllowedRoles(profileId) {
  var profile = getProfileById_(profileId);
  if (!profile) return [];

  if (!profile.laneControls || typeof profile.laneControls !== "object") return [];

  var ids = [];
  var seen = {};
  for (var laneKey in profile.laneControls) {
    if (!Object.prototype.hasOwnProperty.call(profile.laneControls, laneKey)) continue;
    var c = profile.laneControls[laneKey];
    if (!c || c.is_enabled !== true) continue;
    var arr = Array.isArray(c.allowed_bank_role_ids) ? c.allowed_bank_role_ids : [];
    arr.forEach(function (id) {
      var s = String(id || "").trim();
      if (s && !seen[s]) {
        seen[s] = true;
        ids.push(s);
      }
    });
  }
  return ids;
}

/**
 * Returns the effective roleTracks array for fetch/classify/score.
 * If profile has laneControls: build RoleTrack-like objects from bank for enabled lanes + allowed_bank_role_ids.
 * Else: return profile.roleTracks (current behavior).
 */
function getEffectiveRoleTracks_(profile) {
  if (!profile) return [];

  if (!profile.laneControls || typeof profile.laneControls !== "object") {
    return Array.isArray(profile.roleTracks) ? profile.roleTracks : [];
  }

  var bank = getLaneRoleBank_({ activeOnly: true });
  var allowedSet = {};
  for (var laneKey in profile.laneControls) {
    if (!Object.prototype.hasOwnProperty.call(profile.laneControls, laneKey)) continue;
    var c = profile.laneControls[laneKey];
    if (!c || c.is_enabled !== true) continue;
    var arr = Array.isArray(c.allowed_bank_role_ids) ? c.allowed_bank_role_ids : [];
    arr.forEach(function (id) {
      allowedSet[String(id).trim()] = true;
    });
  }

  var tracks = [];
  bank.forEach(function (row) {
    if (!allowedSet[row.id]) return;
    var keywords = [row.role_name].concat(row.aliases || []).map(function (s) { return String(s).trim().toLowerCase(); }).filter(Boolean);
    tracks.push({
      id: row.id,
      label: row.role_name,
      roleKeywords: keywords,
      laneLabel: (row.lane_key ? row.lane_key + " Lane" : row.role_name + " Lane"),
      priorityWeight: 1.0
    });
  });

  return tracks;
}
