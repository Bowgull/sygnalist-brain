/**
 * Tests for Lane Role Bank + Lane Controls + Resolver.
 * Run from Script Editor: runLaneBankResolverTests_() or run individual test functions.
 * Requires: Lane_Role_Bank sheet (can be empty); Admin_Profiles with at least one profile.
 */

function runLaneBankResolverTests_() {
  var results = [];
  try {
    testBankPersist_(results);
    testLaneControlsResolver_(results);
    testEffectiveRoleTracksFallback_(results);
    testEffectiveRoleTracksWithControls_(results);
  } catch (e) {
    results.push("FAIL: " + (e.message || String(e)));
  }
  var msg = results.length ? results.join("\n") : "No assertions run.";
  if (typeof Logger !== "undefined") Logger.log(msg);
  if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getUi()) {
    SpreadsheetApp.getUi().alert("Lane Bank + Resolver Tests\n\n" + msg);
  }
  return results;
}

/**
 * Bank persist: getLaneRoleBank_() returns array; active filter works.
 */
function testBankPersist_(results) {
  ensureLaneRoleBankSheet_();
  var bank = getLaneRoleBank_();
  if (!Array.isArray(bank)) {
    results.push("FAIL: getLaneRoleBank_() should return array");
    return;
  }
  results.push("PASS: getLaneRoleBank_() returns array (length=" + bank.length + ")");
  bank.forEach(function (row) {
    if (row.lane_key === undefined && row.role_name === undefined) {
      results.push("FAIL: bank row missing lane_key/role_name");
    }
  });
}

/**
 * Lane controls persist: setProfileLaneControls then getProfileLaneControls round-trip.
 * Uses first profile from Admin_Profiles; does not alter roleTracksJSON.
 */
function testLaneControlsResolver_(results) {
  var profiles = loadProfiles_();
  if (!profiles || profiles.length === 0) {
    results.push("SKIP: No profiles for lane controls test");
    return;
  }
  var profileId = profiles[0].profileId;
  var testControls = {
    customer_success: { is_enabled: true, allowed_bank_role_ids: ["cs_1"] },
    support: { is_enabled: false, allowed_bank_role_ids: [] }
  };
  var setRes = setProfileLaneControls(profileId, testControls);
  if (!setRes || !setRes.ok) {
    results.push("FAIL: setProfileLaneControls: " + (setRes && setRes.error ? setRes.error : "unknown"));
    return;
  }
  var profile = getProfileById_(profileId);
  if (!profile || !profile.laneControls) {
    results.push("FAIL: profile.laneControls missing after set");
    return;
  }
  if (profile.laneControls.customer_success && profile.laneControls.customer_success.is_enabled !== true) {
    results.push("FAIL: lane control customer_success.is_enabled should be true");
    return;
  }
  results.push("PASS: Lane controls persist (set + load profile)");
}

/**
 * Resolver: profile with no laneControls => getEffectiveRoleTracks_ returns profile.roleTracks.
 */
function testEffectiveRoleTracksFallback_(results) {
  var profiles = loadProfiles_();
  if (!profiles || profiles.length === 0) {
    results.push("SKIP: No profiles for fallback test");
    return;
  }
  var profile = profiles[0];
  var hadControls = profile.laneControls && Object.keys(profile.laneControls).length > 0;
  var tracks = getEffectiveRoleTracks_(profile);
  if (!Array.isArray(tracks)) {
    results.push("FAIL: getEffectiveRoleTracks_ must return array");
    return;
  }
  if (!hadControls && profile.roleTracks && profile.roleTracks.length > 0) {
    if (tracks.length !== profile.roleTracks.length) {
      results.push("FAIL: no laneControls should yield same length as roleTracks");
      return;
    }
  }
  results.push("PASS: getEffectiveRoleTracks_ fallback (no controls => roleTracks)");
}

/**
 * Resolver: profile with laneControls => getEffectiveRoleTracks_ returns only allowed bank roles.
 */
function testEffectiveRoleTracksWithControls_(results) {
  var profiles = loadProfiles_();
  if (!profiles || profiles.length === 0) {
    results.push("SKIP: No profiles for controls test");
    return;
  }
  var bank = getLaneRoleBank_();
  if (bank.length === 0) {
    results.push("SKIP: Empty bank, cannot test effective tracks from controls");
    return;
  }
  var profileId = profiles[0].profileId;
  var firstBankId = bank[0].id;
  var laneKey = bank[0].lane_key || "default";
  var testControls = {};
  testControls[laneKey] = { is_enabled: true, allowed_bank_role_ids: [firstBankId] };
  setProfileLaneControls(profileId, testControls);
  var profile = getProfileById_(profileId);
  var tracks = getEffectiveRoleTracks_(profile);
  if (!Array.isArray(tracks)) {
    results.push("FAIL: getEffectiveRoleTracks_ with controls must return array");
    return;
  }
  var found = tracks.some(function (t) { return t.id === firstBankId; });
  if (!found && bank.length > 0) {
    results.push("FAIL: effective tracks should include allowed bank role id " + firstBankId);
    return;
  }
  results.push("PASS: getEffectiveRoleTracks_ with lane controls returns allowed bank roles");
}
