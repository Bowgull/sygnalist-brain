function fetchJobsRawForProfile_(profileId) {
  const profile = getProfileByIdOrThrow_(profileId);
  assertProfileActiveOrThrow_(profile);

  ensureEngineTables_();

  const batchId = newBatchId_();

  return withProfileLock_(profile.profileId, "fetch", () => {
    // Throttle fetch so people can’t smash it
    assertNotThrottled_(profile.profileId, "fetch", 30 * 1000);

    const plan = buildFetchRequestForProfile_(profile);

    logEvent_({
      timestamp: Date.now(),
      profileId: profile.profileId,
      action: "fetch",
      source: "planner",
      details: {
        level: "INFO",
        message: "Fetch plan built",
        meta: { batchId, terms: plan.searchTerms, sources: plan.sources },
        batchId,
        version: Sygnalist_VERSION
      }
    });

    let jobs = [];
    for (const source of plan.sources) {
      for (const term of plan.searchTerms) {
        try {
          const got = fetchFromSource_(source, term);
          jobs = jobs.concat(got);

          logEvent_({
            timestamp: Date.now(),
            profileId: profile.profileId,
            action: "fetch",
            source: source,
            details: {
              level: "INFO",
              message: "Fetched jobs",
              meta: { batchId, source, term, count: got.length },
              batchId,
              version: Sygnalist_VERSION
            }
          });
        } catch (e) {
          logEvent_({
            timestamp: Date.now(),
            profileId: profile.profileId,
            action: "error",
            source: source,
            details: {
              level: "WARN",
              message: "Fetch failed for term",
              meta: { batchId, source, term, error: e.message },
              batchId,
              version: Sygnalist_VERSION
            }
          });
        }
      }
    }

    jobs = dedupeJobs_(jobs);

    const classified = classifyJobsForProfile_(jobs, profile);
    var scored = scoreJobsForProfile_(classified, profile)
      .filter(j => !j.excluded && j.score >= CONFIG.MIN_SCORE_FOR_INBOX)
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.MAX_JOBS_PER_FETCH);
    scored = filterTierGate_(scored);

    // Raw fetch phase: summary/whyFit are blank for now (by spec)
    const written = writeEngineInbox_(scored, profile.profileId);

    logEvent_({
      timestamp: Date.now(),
      profileId: profile.profileId,
      action: "fetch",
      source: "pipeline",
      details: {
        level: "INFO",
        message: "Fetch pipeline complete",
        meta: { batchId, fetched: jobs.length, written },
        batchId,
        version: Sygnalist_VERSION
      }
    });

    return { ok: true, version: Sygnalist_VERSION, batchId, count: written };
  });
}

function termsSuggestRemoteOrTech_(searchTerms) {
  var list = Array.isArray(CONFIG.REMOTE_TECH_TERMS) ? CONFIG.REMOTE_TECH_TERMS : [];
  for (var i = 0; i < (searchTerms || []).length; i++) {
    var term = String(searchTerms[i] || "").toLowerCase();
    for (var j = 0; j < list.length; j++) {
      var keyword = String(list[j] || "").toLowerCase();
      if (keyword && (term === keyword || term.indexOf(keyword) !== -1)) return true;
    }
  }
  return false;
}

function buildFetchRequestForProfile_(profile) {
  var sources = Array.isArray(CONFIG.CORE_SOURCES) ? CONFIG.CORE_SOURCES.slice() : (Array.isArray(CONFIG.DEFAULT_SOURCES) ? CONFIG.DEFAULT_SOURCES.slice() : ["remotive", "remoteok"]);

  // Terms: from effective role tracks (lane controls or roleTracks fallback)
  const terms = [];
  const tracks = getEffectiveRoleTracks_(profile);

  tracks.forEach(t => {
    if (t && t.label) terms.push(String(t.label));
    if (t && Array.isArray(t.roleKeywords)) {
      t.roleKeywords.slice(0, 3).forEach(k => terms.push(String(k)));
    }
  });

  // Fallback if someone has empty tracks
  if (terms.length === 0) terms.push("customer success");

  // Normalize + dedupe terms (punctuation to space, collapse spaces, trim, lowercase)
  const clean = [];
  const seen = new Set();
  for (const t of terms) {
    var s = String(t || "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    clean.push(s);
  }

  // Cap terms to avoid runtime blowups
  var maxTerms = (typeof CONFIG.MAX_SEARCH_TERMS === "number" && CONFIG.MAX_SEARCH_TERMS > 0) ? CONFIG.MAX_SEARCH_TERMS : 4;
  var searchTerms = clean.slice(0, maxTerms);
  if (Array.isArray(CONFIG.CONDITIONAL_SOURCES) && CONFIG.CONDITIONAL_SOURCES.length > 0 && termsSuggestRemoteOrTech_(searchTerms)) {
    sources = sources.concat(CONFIG.CONDITIONAL_SOURCES);
  }
  return {
    sources: sources,
    searchTerms: searchTerms
  };
}
