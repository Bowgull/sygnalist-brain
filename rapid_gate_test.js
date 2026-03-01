/**
 * Tests for RapidAPI gate decision (usable-candidates gate).
 * Run from Script Editor: runRapidGateTests_()
 * Requires: fetch_enriched.js (shouldRunRapidApi_) and config (CONFIG.RAPID_MIN_CANDIDATES, RAPID_MIN_ELIGIBLE).
 */

/**
 * Simulation: same logic as shouldRunRapidApi_. opts: { eligibleAfterHardFilters, candidateCount, topScore, rapidEnabled }.
 * Returns { decision: "RUN"|"SKIP", reason: string }.
 */
function simulateRapidGateDecision_(opts) {
  if (typeof shouldRunRapidApi_ !== "function") {
    return { decision: "SKIP", reason: "shouldRunRapidApi_ not available" };
  }
  var e = opts && typeof opts.eligibleAfterHardFilters === "number" ? opts.eligibleAfterHardFilters : 0;
  var c = opts && typeof opts.candidateCount === "number" ? opts.candidateCount : 0;
  var t = opts && typeof opts.topScore === "number" ? opts.topScore : 0;
  var enabled = !!(opts && opts.rapidEnabled);
  var result = shouldRunRapidApi_(e, c, t, enabled);
  return { decision: result.run ? "RUN" : "SKIP", reason: result.reason };
}

/**
 * Run three scenarios; log/alert results.
 */
function runRapidGateTests_() {
  var results = [];
  try {
    testRawFetchedManyButAllFilteredRapidRuns_(results);
    testEnoughCandidatesRapidSkips_(results);
    testRapidDisabledRapidSkips_(results);
  } catch (e) {
    results.push("FAIL: " + (e.message || String(e)));
  }
  var msg = results.length ? results.join("\n") : "No assertions run.";
  if (typeof Logger !== "undefined") Logger.log(msg);
  if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getUi()) {
    SpreadsheetApp.getUi().alert("RapidAPI Gate Tests\n\n" + msg);
  }
  return results;
}

function testRawFetchedManyButAllFilteredRapidRuns_(results) {
  var out = simulateRapidGateDecision_({
    eligibleAfterHardFilters: 7,
    candidateCount: 0,
    topScore: 0,
    rapidEnabled: true
  });
  if (out.decision !== "RUN") {
    results.push("FAIL: Scenario 1 expected RUN, got " + out.decision);
    return;
  }
  if (out.reason.indexOf("candidateCount") === -1 && out.reason !== "candidateCount<5") {
    results.push("FAIL: Scenario 1 expected reason like candidateCount<5, got " + out.reason);
    return;
  }
  results.push("PASS: rawFetched>=5 but all filtered -> RapidAPI RUN");
}

function testEnoughCandidatesRapidSkips_(results) {
  var out = simulateRapidGateDecision_({
    eligibleAfterHardFilters: 12,
    candidateCount: 5,
    topScore: 70,
    rapidEnabled: true
  });
  if (out.decision !== "SKIP") {
    results.push("FAIL: Scenario 2 expected SKIP, got " + out.decision);
    return;
  }
  if (out.reason !== "candidateCount>=5" && out.reason !== "eligible>=10") {
    results.push("FAIL: Scenario 2 expected reason candidateCount>=5 or eligible>=10, got " + out.reason);
    return;
  }
  results.push("PASS: candidateCount>=5 -> RapidAPI SKIP");
}

function testRapidDisabledRapidSkips_(results) {
  var out = simulateRapidGateDecision_({
    eligibleAfterHardFilters: 0,
    candidateCount: 0,
    topScore: 0,
    rapidEnabled: false
  });
  if (out.decision !== "SKIP") {
    results.push("FAIL: Scenario 3 expected SKIP, got " + out.decision);
    return;
  }
  if (out.reason !== "rapidDisabled") {
    results.push("FAIL: Scenario 3 expected reason rapidDisabled, got " + out.reason);
    return;
  }
  results.push("PASS: rapidEnabled=false -> RapidAPI SKIP (rapidDisabled)");
}
