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
    "Enter profileId (e.g. josh, client1)",
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

      // #region agent log - DEBUG: plan summary
      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId,
        action: "fetch_enriched",
        source: "debug",
        details: {
          level: "INFO",
          message: "Plan summary",
          meta: {
            batchId: batchId,
            sourcesCount: (plan.sources || []).length,
            termsCount: (plan.searchTerms || []).length,
            terms: (plan.searchTerms || []).slice(0, 6)
          },
          version: Sygnalist_VERSION
        }
      });
      // #endregion

      // 1) Parallel raw fetch (all sources at once)
      const fetchItems = buildParallelFetchRequests_(plan, profile);
      let jobs = [];

      // #region agent log - DEBUG: fetch items count
      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId,
        action: "fetch_enriched",
        source: "debug",
        details: {
          level: "INFO",
          message: fetchItems.length === 0 ? "ZERO fetch requests built - check API keys and CONFIG.DEFAULT_SOURCES" : "Fetch requests built",
          meta: { batchId: batchId, fetchItemsCount: fetchItems.length, sourcesUsed: fetchItems.map(function(x) { return x.source; }).filter(function(s, i, a) { return a.indexOf(s) === i; }) },
          version: Sygnalist_VERSION
        }
      });
      // #endregion

      if (fetchItems.length > 0) {
        try {
          const requests = fetchItems.map(function(item) { return item.request; });
          const responses = UrlFetchApp.fetchAll(requests);
          var httpCodes = [];
          for (var i = 0; i < responses.length; i++) {
            var code = responses[i].getResponseCode();
            httpCodes.push({ source: fetchItems[i].source, term: fetchItems[i].term, code: code });
            var parsed = parseParallelFetchResponse_(responses[i], fetchItems[i]);
            jobs = jobs.concat(parsed);
            logEvent_({
              timestamp: Date.now(),
              profileId: profile.profileId,
              action: "fetch_enriched",
              source: fetchItems[i].source,
              details: {
                level: "INFO",
                message: "Fetched jobs",
                meta: { batchId, source: fetchItems[i].source, term: fetchItems[i].term, count: parsed.length, httpCode: code },
                batchId,
                version: Sygnalist_VERSION
              }
            });
          }
          // #region agent log - DEBUG: after parallel fetch
          logEvent_({
            timestamp: Date.now(),
            profileId: profile.profileId,
            action: "fetch_enriched",
            source: "debug",
            details: {
              level: "INFO",
              message: "After parallel fetch",
              meta: { batchId: batchId, totalJobs: jobs.length, httpCodes: httpCodes },
              version: Sygnalist_VERSION
            }
          });
          // #endregion
        } catch (e) {
          logEvent_({
            timestamp: Date.now(),
            profileId: profile.profileId,
            action: "fetch_enriched",
            source: "pipeline",
            details: {
              level: "WARN",
              message: "Parallel fetch failed; falling back",
              meta: { batchId, error: e.message },
              batchId,
              version: Sygnalist_VERSION
            }
          });
          for (var s = 0; s < plan.sources.length; s++) {
            for (var t = 0; t < plan.searchTerms.length; t++) {
              try {
                var got = fetchFromSource_(plan.sources[s], plan.searchTerms[t]);
                jobs = jobs.concat(got);
              } catch (err) { /* skip */ }
            }
          }
        }
      }

      // Zero-results fallback: broaden search so clients never see empty inbox
      var minJobs = (CONFIG.MIN_JOBS_BEFORE_FALLBACK !== undefined) ? CONFIG.MIN_JOBS_BEFORE_FALLBACK : 3;
      if (jobs.length < minJobs && CONFIG.FALLBACK_TERMS && CONFIG.FALLBACK_TERMS.length > 0) {
        var fallbackPlan = { sources: plan.sources, searchTerms: CONFIG.FALLBACK_TERMS.slice(0, 3) };
        var fallbackItems = buildParallelFetchRequests_(fallbackPlan, profile);
        if (fallbackItems.length > 0) {
          try {
            var fallbackRequests = fallbackItems.map(function(item) { return item.request; });
            var fallbackResponses = UrlFetchApp.fetchAll(fallbackRequests);
            for (var j = 0; j < fallbackResponses.length; j++) {
              jobs = jobs.concat(parseParallelFetchResponse_(fallbackResponses[j], fallbackItems[j]));
            }
            logEvent_({
              timestamp: Date.now(),
              profileId: profile.profileId,
              action: "fetch_enriched",
              source: "pipeline",
              details: {
                level: "INFO",
                message: "Fallback search ran (broader terms)",
                meta: { batchId, fallbackTerms: CONFIG.FALLBACK_TERMS.slice(0, 3) },
                batchId,
                version: Sygnalist_VERSION
              }
            });
          } catch (e) { /* ignore */ }
        }
      }

      // Last-ditch: if still 0 jobs, use only remotive/remoteok with terms that return results (no API keys needed)
      if (jobs.length === 0 && CONFIG.LAST_DITCH_SOURCES && CONFIG.LAST_DITCH_TERMS) {
        var lastPlan = {
          sources: CONFIG.LAST_DITCH_SOURCES,
          searchTerms: CONFIG.LAST_DITCH_TERMS.slice(0, 3)
        };
        var lastItems = buildParallelFetchRequests_(lastPlan, profile);
        if (lastItems.length > 0) {
          try {
            var lastRequests = lastItems.map(function(item) { return item.request; });
            var lastResponses = UrlFetchApp.fetchAll(lastRequests);
            for (var k = 0; k < lastResponses.length; k++) {
              jobs = jobs.concat(parseParallelFetchResponse_(lastResponses[k], lastItems[k]));
            }
            logEvent_({
              timestamp: Date.now(),
              profileId: profile.profileId,
              action: "fetch_enriched",
              source: "pipeline",
              details: {
                level: "INFO",
                message: "Last-ditch fetch ran (remotive/remoteok only)",
                meta: { batchId: batchId, jobsFound: jobs.length },
                batchId,
                version: Sygnalist_VERSION
              }
            });
          } catch (e) { /* ignore */ }
        }
      }

      const rawFetched = jobs.length;

      // 2) Dedupe + classify + score
      jobs = dedupeJobs_(jobs);
      var afterDedupe = jobs.length;

      const classified = classifyJobsForProfile_(jobs, profile);
      const scoredAll = scoreJobsForProfile_(classified, profile);

      // 3) Filter/cap candidates for enrichment (never show 0: if none pass, take top by score; if all excluded, take top anyway)
      var candidates = scoredAll
        .filter(j => !j.excluded && Number(j.score || 0) >= CONFIG.MIN_SCORE_FOR_INBOX)
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, CONFIG.MAX_JOBS_PER_FETCH);
      if (candidates.length === 0 && scoredAll.length > 0) {
        candidates = scoredAll
          .filter(j => !j.excluded)
          .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
          .slice(0, CONFIG.MAX_JOBS_PER_FETCH);
      }
      if (candidates.length === 0 && scoredAll.length > 0) {
        candidates = scoredAll
          .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
          .slice(0, CONFIG.MAX_JOBS_PER_FETCH);
      }

      // #region agent log - DEBUG: after dedupe and score
      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId,
        action: "fetch_enriched",
        source: "debug",
        details: {
          level: "INFO",
          message: "After dedupe and score",
          meta: { batchId: batchId, afterDedupe: afterDedupe, candidates: candidates.length, minScore: CONFIG.MIN_SCORE_FOR_INBOX },
          version: Sygnalist_VERSION
        }
      });
      // #endregion

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

      // 5) Exclude jobs already in Tracker so they do not reappear in Inbox until released
      const trackerKeys = getTrackerKeyStringsForProfile_(profile.profileId);
      const forInbox = enriched.filter(j => {
        const u = normalizeUrl_(j.url);
        if (u && trackerKeys.has(u)) return false;
        const k = buildFallbackKey_(j.company, j.title);
        if (k && trackerKeys.has(k)) return false;
        return true;
      });

      // 6) Write enriched inbox (replace profile inbox)
      clearEngineInboxForProfile_(profile.profileId);
      const written = writeEngineInboxEnriched_(forInbox, profile.profileId);

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
 * Format job.salary { min, max, currency } for display (e.g. "$80k–$120k" or "—").
 */
function formatSalaryDisplay_(salary) {
  const s = salary && typeof salary === "object" ? salary : {};
  const min = s.min != null ? Number(s.min) : null;
  const max = s.max != null ? Number(s.max) : null;
  const currency = (s.currency && String(s.currency).trim()) || "USD";
  if (min == null && max == null) return "—";
  const fmt = (n) => {
    if (n >= 1000) return (n / 1000) + "k";
    return String(n);
  };
  const sym = currency.toUpperCase() === "USD" ? "$" : "";
  if (min != null && max != null && min !== max) return sym + fmt(min) + "–" + fmt(max);
  if (max != null) return sym + fmt(max);
  if (min != null) return sym + fmt(min);
  return "—";
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
        case "whyFit": return ""; // Inbox: no GoodFit (Tracker-only, lazy-generated)
        case "salary": return formatSalaryDisplay_(j.salary);
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
