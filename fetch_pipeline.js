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
    const scored = scoreJobsForProfile_(classified, profile)
      .filter(j => !j.excluded && j.score >= CONFIG.MIN_SCORE_FOR_INBOX)
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.MAX_JOBS_PER_FETCH);

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

function buildFetchRequestForProfile_(profile) {
  const sources = Array.isArray(CONFIG.DEFAULT_SOURCES) ? CONFIG.DEFAULT_SOURCES.slice() : ["remotive", "remoteok"];

  // Terms: pull from roleTracks keywords + labels, keep it tight
  const terms = [];
  const tracks = Array.isArray(profile.roleTracks) ? profile.roleTracks : [];

  tracks.forEach(t => {
    if (t && t.label) terms.push(String(t.label));
    if (t && Array.isArray(t.roleKeywords)) {
      t.roleKeywords.slice(0, 3).forEach(k => terms.push(String(k)));
    }
  });

  // Fallback if someone has empty tracks
  if (terms.length === 0) terms.push("customer success");

  // Normalize + dedupe terms
  const clean = [];
  const seen = new Set();
  for (const t of terms) {
    const s = String(t || "").trim().toLowerCase();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    clean.push(s);
  }

  // Cap terms to avoid runtime blowups
  return {
    sources,
    searchTerms: clean.slice(0, 6)
  };
}
