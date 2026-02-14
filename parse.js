function csvToArray_(val) {
  const s = String(val || "").trim();
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

function toBool_(val) {
  if (val === true) return true;
  const s = String(val || "").toLowerCase().trim();
  return s === "true" || s === "yes" || s === "1";
}

function parseStories_(val) {
  const s = String(val || "").trim();
  if (!s) return [];
  // Allow either JSON array OR newline bullets
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return s.split("\n").map(x => x.trim()).filter(Boolean);
}

function parseRoleTracks_(val) {
  const s = String(val || "").trim();
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

/**
 * Parse laneControlsJSON: { "lane_key": { is_enabled, allowed_bank_role_ids } }.
 * Returns object or null if empty/invalid.
 */
function parseLaneControls_(val) {
  const s = String(val || "").trim();
  if (!s) return null;
  try {
    const o = JSON.parse(s);
    if (!o || typeof o !== "object") return null;
    return o;
  } catch (e) {
    return null;
  }
}
