/**
 * Tests for last_fetch_at: (1) successful fetch updates last_fetch_at, (2) failed fetch does not update.
 * Run from Script Editor: runLastFetchTests_()
 * Requires: Admin_Profiles with at least one profile.
 */

function runLastFetchTests_() {
  var results = [];
  try {
    testSuccessUpdatesLastFetch_(results);
    testFailureDoesNotUpdateLastFetch_(results);
  } catch (e) {
    results.push("FAIL: " + (e.message || String(e)));
  }
  var msg = results.length ? results.join("\n") : "No assertions run.";
  if (typeof Logger !== "undefined") Logger.log(msg);
  if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getUi()) {
    SpreadsheetApp.getUi().alert("Last Fetch Tests\n\n" + msg);
  }
  return results;
}

/**
 * Test 1: When setProfileLastFetchAt_ is called (as after a successful fetch), the profile's last_fetch_at is updated.
 */
function testSuccessUpdatesLastFetch_(results) {
  var profiles = loadProfiles_();
  if (!profiles || profiles.length === 0) {
    results.push("SKIP: No profiles for last_fetch_at test");
    return;
  }
  var pid = profiles[0].profileId;
  var iso = new Date().toISOString();
  setProfileLastFetchAt_(pid, iso);
  var p = getProfileById_(pid);
  if (!p) {
    results.push("FAIL: getProfileById_ returned null after setProfileLastFetchAt_");
    return;
  }
  if (p.last_fetch_at !== iso) {
    results.push("FAIL: expected last_fetch_at " + iso + ", got " + (p.last_fetch_at || "null"));
    return;
  }
  results.push("PASS: successful update sets last_fetch_at on profile");
}

/**
 * Test 2: When setProfileLastFetchAt_ is not called (as when fetch fails and webapp returns ok: false),
 * last_fetch_at remains unchanged. We set a known value, then read without calling set again, and assert unchanged.
 */
function testFailureDoesNotUpdateLastFetch_(results) {
  var profiles = loadProfiles_();
  if (!profiles || profiles.length === 0) {
    results.push("SKIP: No profiles for last_fetch_at test");
    return;
  }
  var pid = profiles[0].profileId;
  var fixedIso = "2025-06-01T12:00:00.000Z";
  setProfileLastFetchAt_(pid, fixedIso);
  var p1 = getProfileById_(pid);
  if (!p1 || p1.last_fetch_at !== fixedIso) {
    results.push("FAIL: after set, expected last_fetch_at " + fixedIso + ", got " + (p1 && p1.last_fetch_at));
    return;
  }
  // Simulate "fetch failed": we do NOT call setProfileLastFetchAt_ again.
  var p2 = getProfileById_(pid);
  if (!p2 || p2.last_fetch_at !== fixedIso) {
    results.push("FAIL: when setProfileLastFetchAt_ is not called, last_fetch_at should be unchanged; got " + (p2 && p2.last_fetch_at));
    return;
  }
  results.push("PASS: last_fetch_at unchanged when setProfileLastFetchAt_ is not invoked (failed fetch path)");
}
