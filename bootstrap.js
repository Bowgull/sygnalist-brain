/**
 * Build a single client-safe context line for the Why Fit footer (e.g. first 2-3 role
 * lane labels or first 5 top skills). Client never receives full arrays.
 */
function buildProfileContextLine_(profile) {
  if (!profile) return "your role and skills";
  const tracks = Array.isArray(profile.roleTracks) ? profile.roleTracks : [];
  const labels = tracks.slice(0, 3).map(function (t) { return t && t.label ? String(t.label).trim() : ""; }).filter(Boolean);
  if (labels.length) return labels.join(", ");
  const skills = Array.isArray(profile.topSkills) ? profile.topSkills.slice(0, 5) : [];
  if (skills.length) return skills.map(function (s) { return String(s).trim(); }).filter(Boolean).join(", ");
  return "your role and skills";
}

function getProfileBootstrap_(profileId) {
  const profile = getProfileByIdOrThrow_(profileId);

  var assignedLaneLabels = [];
  if (typeof getEffectiveRoleTracks_ === "function") {
    var tracks = getEffectiveRoleTracks_(profile);
    var seen = {};
    for (var i = 0; i < tracks.length; i++) {
      var lb = (tracks[i] && (tracks[i].laneLabel || tracks[i].label)) ? String(tracks[i].laneLabel || tracks[i].label).trim() : "";
      if (lb && !seen[lb]) {
        seen[lb] = true;
        assignedLaneLabels.push(lb);
      }
    }
  }

  // DTO only (no internals beyond what UI needs). Locked profiles can load; fetch is gated in portal_api_.
  return {
    ok: true,
    version: Sygnalist_VERSION,
    profile: {
      profileId: profile.profileId,
      displayName: profile.displayName,
      status: profile.status,
      statusReason: profile.statusReason || "",
      isAdmin: !!profile.isAdmin,
      profileContext: buildProfileContextLine_(profile),
      last_fetch_at: profile.last_fetch_at || null,
      assignedLaneLabels: assignedLaneLabels
    }
  };
}
