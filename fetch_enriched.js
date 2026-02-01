/****************************************************
 * fetch_enriched.gs
 * Phase 4 — Fetch + Score + Enrich + Write Engine_Inbox
 *
 * Requirements:
 *  - ensureEngineTables_()
 *  - withProfileLock_(), assertNotThrottled_(), newBatchId_()
 *  - buildFetchRequestForProfile_(), fetchFromSource_()
 *  - dedupeJobs_(), classifyJobsForProfile_(), scoreJobsForProfile_()
 *  - enrichJobsForProfile_()
 *  - clearEngineInboxForProfile_()
 *  - logEvent_()
 ****************************************************/

/**
 * Admin menu entrypoint (wire this to your 📡 Sygnalist menu):
 * .addItem("✨ Fetch Jobs (Enriched)", "adminFetchJobsEnriched_")
 */
function adminFetchJobsEnriched_() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt(
    "✨ Fetch Jobs (Enriched)",
    "Enter profileId (e.g. p_91917494)",
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const profileId = String(res.getResponseText() || "").trim();
  const out = fetchForProfileWithEnrichment_(profileId);

  if (!out || out.ok !== true) {
    ui.alert("❌ " + (out && out.message ? out.message : "Fetch failed."));
    return;
  }

  ui.alert(
    "✅ Enriched Fetch Complete\n" +
    "rawFetched: " + out.rawFetched + "\n" +
    "candidates: " + out.candidates + "\n" +
    "enrichedWritten: " + out.written + "\n" +
    "batchId: " + out.batchId + "\n\n" +
    "Check Engine_Inbox tab."
  );
}

/**
 * Main Phase 4 entrypoint per blueprint.
 * Does:
 *  - raw fetch + dedupe + classify + score
 *  - filter/cap
 *  - enrich (OpenAI)
 *  - write enriched rows to Engine_Inbox (jobSummary + whyFit required)
 */
function fetchForProfileWithEnrichment_(profileId) {
  try {
    const profile = getProfileByIdOrThrow_(profileId);
    assertProfileActiveOrThrow_(profile);

    ensureEngineTables_();

    const batchId = newBatchId_();

    return withProfileLock_(profile.profileId, "fetch_enriched", () => {
      assertNotThrottled_(profile.profileId, "fetch_enriched", 45 * 1000);

      const plan = buildFetchRequestForProfile_(profile);

      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId,
        action: "fetch_enriched",
        source: "planner",
        details: {
          level: "INFO",
          message: "Fetch plan built",
          meta: { batchId, terms: plan.searchTerms, sources: plan.sources },
          batchId,
          version: Sygnalist_VERSION
        }
      });

      // 1) Raw fetch
      let jobs = [];
      for (const source of plan.sources) {
        for (const term of plan.searchTerms) {
          try {
            const got = fetchFromSource_(source, term);
            jobs = jobs.concat(got);

            logEvent_({
              timestamp: Date.now(),
              profileId: profile.profileId,
              action: "fetch_enriched",
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
              action: "fetch_enriched",
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

      const rawFetched = jobs.length;

      // 2) Dedupe + classify + score
      jobs = dedupeJobs_(jobs);

      const classified = classifyJobsForProfile_(jobs, profile);
      const scoredAll = scoreJobsForProfile_(classified, profile);

      // 3) Filter/cap candidates for enrichment
      const candidates = scoredAll
        .filter(j => !j.excluded && Number(j.score || 0) >= CONFIG.MIN_SCORE_FOR_INBOX)
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, CONFIG.MAX_JOBS_PER_FETCH);

      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId,
        action: "fetch_enriched",
        source: "pipeline",
        details: {
          level: "INFO",
          message: "Scoring complete; candidates selected",
          meta: { batchId, rawFetched, unique: jobs.length, candidates: candidates.length },
          batchId,
          version: Sygnalist_VERSION
        }
      });

      // 4) Enrich (skip failures inside enrichJobsForProfile_)
      const enriched = enrichJobsForProfile_(candidates, profile)
        .filter(j => String(j.jobSummary || "").trim() && String(j.whyFit || "").trim());

      // 5) Write enriched inbox (replace profile inbox)
      clearEngineInboxForProfile_(profile.profileId);
      const written = writeEngineInboxEnriched_(enriched, profile.profileId);

      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId,
        action: "fetch_enriched",
        source: "pipeline",
        details: {
          level: "INFO",
          message: "Fetch+Enrich pipeline complete",
          meta: { batchId, rawFetched, candidates: candidates.length, enriched: enriched.length, written },
          batchId,
          version: Sygnalist_VERSION
        }
      });

      return {
        ok: true,
        version: Sygnalist_VERSION,
        batchId,
        rawFetched,
        candidates: candidates.length,
        written
      };
    });

  } catch (e) {
    return { ok: false, version: Sygnalist_VERSION, message: e.message };
  }
}

/**
 * Writes enriched jobs to Engine_Inbox using headers.
 * Requires jobSummary + whyFit already present on each job.
 */
function writeEngineInboxEnriched_(jobs, profileId) {
  ensureEngineTables_();
  const sh = assertSheetExists_("Engine_Inbox");

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);

  const now = new Date();

  const rows = (jobs || []).map(j => {
    return headers.map(h => {
      switch (h) {
        case "profileId": return profileId;
        case "score": return Number(j.score || 0);
        case "tier": return String(j.tier || "");
        case "company": return String(j.company || "");
        case "title": return String(j.title || "");
        case "url": return String(j.url || "");
        case "source": return String(j.source || "");
        case "location": return String(j.location || "");
        case "roleType": return String(j.roleType || "");
        case "laneLabel": return String(j.laneLabel || "");
        case "category": return String(j.category || "");
        case "jobSummary": return String(j.jobSummary || "");
        case "whyFit": return String(j.whyFit || "");
        case "added_at": return now;
        default: return "";
      }
    });
  });

  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }

  return rows.length;
}
