/**
 * Tests for work-type classification and region lock (dedupe_classify_score.js).
 * Run from Script Editor: runWorkRegionLockTests_()
 * No DOM or sheet required.
 */

function runWorkRegionLockTests_() {
  var results = [];
  try {
    testGetJobWorkType_(results);
    testJobWorkTypeAccepted_(results);
    testNormalizeJobLocation_(results);
    testApplyRegionLock_(results);
  } catch (e) {
    results.push("FAIL: " + (e.message || String(e)));
  }
  var msg = results.length ? results.join("\n") : "No assertions run.";
  if (typeof Logger !== "undefined") Logger.log(msg);
  if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getUi()) {
    SpreadsheetApp.getUi().alert("Work / Region Lock Tests\n\n" + msg);
  }
  return results;
}

function testGetJobWorkType_(results) {
  if (typeof getJobWorkType_ !== "function") {
    results.push("SKIP: getJobWorkType_ not in scope");
    return;
  }
  var t = getJobWorkType_({ remote: true, location: "Worldwide" });
  if (t !== "remote") results.push("FAIL: getJobWorkType_ remote true -> remote, got " + t);
  else results.push("PASS: getJobWorkType_ remote=true -> remote");

  t = getJobWorkType_({ remote: "hybrid", location: "New York, NY" });
  if (t !== "hybrid") results.push("FAIL: getJobWorkType_ hybrid -> hybrid, got " + t);
  else results.push("PASS: getJobWorkType_ hybrid -> hybrid");

  t = getJobWorkType_({ remote: null, location: "San Francisco, CA, USA" });
  if (t !== "onsite") results.push("FAIL: getJobWorkType_ onsite location -> onsite, got " + t);
  else results.push("PASS: getJobWorkType_ onsite location -> onsite");
}

function testJobWorkTypeAccepted_(results) {
  if (typeof jobWorkTypeAccepted_ !== "function") {
    results.push("SKIP: jobWorkTypeAccepted_ not in scope");
    return;
  }
  var profile = { acceptRemote: true, acceptHybrid: false, acceptOnsite: false };
  if (!jobWorkTypeAccepted_("remote", profile)) results.push("FAIL: jobWorkTypeAccepted_ remote accepted");
  else results.push("PASS: jobWorkTypeAccepted_ remote accepted");
  if (jobWorkTypeAccepted_("hybrid", profile)) results.push("FAIL: jobWorkTypeAccepted_ hybrid not accepted when only remote");
  else results.push("PASS: jobWorkTypeAccepted_ hybrid rejected when only acceptRemote");

  profile = { acceptRemote: true, acceptHybrid: true, acceptOnsite: true };
  if (!jobWorkTypeAccepted_("onsite", profile)) results.push("FAIL: jobWorkTypeAccepted_ onsite when all accepted");
  else results.push("PASS: jobWorkTypeAccepted_ onsite when all accepted");
}

function testNormalizeJobLocation_(results) {
  if (typeof normalizeJobLocation_ !== "function") {
    results.push("SKIP: normalizeJobLocation_ not in scope");
    return;
  }
  var job = { location: "New York, NY, USA" };
  var out = normalizeJobLocation_(job);
  if (!out.country || out.country.toLowerCase().indexOf("united") === -1) results.push("FAIL: normalizeJobLocation_ USA -> country");
  else results.push("PASS: normalizeJobLocation_ USA -> country");
  if (!out.city || out.city.toLowerCase().indexOf("new york") === -1) results.push("FAIL: normalizeJobLocation_ NYC -> city");
  else results.push("PASS: normalizeJobLocation_ NYC -> city");

  job = { location: "Remote" };
  out = normalizeJobLocation_(job);
  if (out.country !== null || out.city !== null) results.push("FAIL: normalizeJobLocation_ Remote -> null country/city");
  else results.push("PASS: normalizeJobLocation_ Remote -> null country/city");
}

function testApplyRegionLock_(results) {
  if (typeof applyRegionLock_ !== "function") {
    results.push("SKIP: applyRegionLock_ not in scope");
    return;
  }
  var profile = {
    preferredCountries: ["United States"],
    preferredCities: ["New York"],
    currentCity: "Boston",
    remoteRegionScope: "remote_global"
  };
  var job = { location: "Remote", remote: true, country: null, city: null };
  var reason = applyRegionLock_(job, profile, { country: null, city: null, raw: "Remote" });
  if (reason !== null) results.push("FAIL: applyRegionLock_ remote global pass, got " + reason);
  else results.push("PASS: applyRegionLock_ remote global -> pass");

  profile.remoteRegionScope = "remote_preferred_countries_only";
  reason = applyRegionLock_(job, profile, { country: null, city: null, raw: "" });
  if (reason === null) results.push("FAIL: applyRegionLock_ remote restricted no country -> exclude");
  else results.push("PASS: applyRegionLock_ remote restricted no country -> exclude");

  job = { location: "Boston, MA, USA", country: "United States", city: "Boston" };
  normalizeJobLocation_(job);
  profile.preferredCountries = ["United States"];
  reason = applyRegionLock_(job, profile, job._normalizedLocation);
  if (reason !== null) results.push("FAIL: applyRegionLock_ onsite Boston in USA pass, got " + reason);
  else results.push("PASS: applyRegionLock_ onsite Boston in USA -> pass");
}
