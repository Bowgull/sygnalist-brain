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
      var tEnrichStart = Date.now();
      assertNotThrottled_(profile.profileId, "fetch_enriched", (typeof CONFIG !== "undefined" && CONFIG.FETCH_THROTTLE_MS) ? CONFIG.FETCH_THROTTLE_MS : 45000);

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

      // 0) Pre-fill from global job bank (search pool first; all clients can see these)
      var poolJobs = [];
      if (typeof readGlobalJobBank_ === "function") {
        try {
          var globalRows = readGlobalJobBank_();
          for (var gi = 0; gi < globalRows.length; gi++) {
            var row = globalRows[gi];
            poolJobs.push({
              url: row.url,
              company: row.company,
              title: row.title,
              source: row.source || "global_pool",
              location: row.location,
              description: String(row.description_snippet || row.job_summary || ""),
              job_summary: row.job_summary,
              why_fit: row.why_fit
            });
          }
        } catch (e) { /* ignore */ }
      }

      // 1) Parallel raw fetch (wave loop: per-source zero-yield short-circuit + optional raw pool cap)
      const fetchItems = buildParallelFetchRequests_(plan, profile);
      let jobs = poolJobs.slice();
      var requestsAttempted = 0;
      var resultsBySource = {};
      var sourcesShortCircuited = [];

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
          var itemsBySource = {};
          for (var xi = 0; xi < fetchItems.length; xi++) {
            var src = fetchItems[xi].source;
            if (!itemsBySource[src]) itemsBySource[src] = [];
            itemsBySource[src].push(fetchItems[xi]);
          }
          var sourceNames = Object.keys(itemsBySource);
          var skippedSources = {};
          var sourceYield = {};
          sourceNames.forEach(function(s) { sourceYield[s] = 0; });

          var tFetchStart = Date.now();
          for (var waveIndex = 0; waveIndex < 10; waveIndex++) {
            var waveItems = [];
            var startIdx = waveIndex * 2;
            var endIdx = startIdx + 2;
            for (var si = 0; si < sourceNames.length; si++) {
              var sn = sourceNames[si];
              if (skippedSources[sn]) continue;
              var arr = itemsBySource[sn] || [];
              for (var ti = startIdx; ti < endIdx && ti < arr.length; ti++) {
                waveItems.push(arr[ti]);
              }
            }
            if (waveItems.length === 0) break;

            var waveRequests = waveItems.map(function(item) { return item.request; });
            requestsAttempted += waveRequests.length;
            var waveResponses = UrlFetchApp.fetchAll(waveRequests);
            for (var wi = 0; wi < waveResponses.length; wi++) {
              var parsed = parseParallelFetchResponse_(waveResponses[wi], waveItems[wi]);
              var so = waveItems[wi].source;
              jobs = jobs.concat(parsed);
              sourceYield[so] = (sourceYield[so] || 0) + parsed.length;
            }

            if (waveIndex === 0) {
              for (var sk = 0; sk < sourceNames.length; sk++) {
                var snk = sourceNames[sk];
                if ((sourceYield[snk] || 0) === 0) {
                  skippedSources[snk] = true;
                  sourcesShortCircuited.push(snk);
                }
              }
            }
            for (var k in sourceYield) { if (sourceYield.hasOwnProperty(k)) resultsBySource[k] = sourceYield[k]; }

            jobs = dedupeJobs_(jobs);
            var rawCap = typeof CONFIG.RAW_POOL_CAP === "number" && CONFIG.RAW_POOL_CAP > 0 ? CONFIG.RAW_POOL_CAP : 0;
            if (rawCap > 0 && jobs.length >= rawCap) break;
          }

          logEvent_({
            timestamp: Date.now(),
            profileId: profile.profileId,
            action: "fetch_enriched",
            source: "debug",
            details: {
              level: "INFO",
              message: "After parallel fetch",
              meta: { batchId: batchId, totalJobs: jobs.length, requestsAttempted: requestsAttempted, resultsBySource: resultsBySource, sourcesShortCircuited: sourcesShortCircuited, fetchPhaseMs: Date.now() - tFetchStart },
              version: Sygnalist_VERSION
            }
          });
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
          requestsAttempted = 0;
          resultsBySource = {};
          sourcesShortCircuited = [];
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

      // RapidAPI fallback: only if enabled and still need more candidates (curated plan stays first)
      var rapidLinkedInCount = 0;
      var rapidATSCount = 0;
      var rapidSkipped = true;
      var rapidSkipReason = "disabled";
      if (typeof resultsBySource === "undefined") resultsBySource = {};
      resultsBySource.rapidLinkedIn = 0;
      resultsBySource.rapidATS = 0;

      var gateMin = (typeof CONFIG !== "undefined" && typeof CONFIG.RAPID_GATE_MIN_CANDIDATES === "number")
        ? CONFIG.RAPID_GATE_MIN_CANDIDATES
        : 5;
      var rapidEnabled = (typeof CONFIG !== "undefined" && CONFIG.RAPID_ENABLE_LINKEDIN) || (typeof CONFIG !== "undefined" && CONFIG.RAPID_ENABLE_ATS);
      if (rapidEnabled && jobs.length < gateMin) {
        var rapidCapRemaining = (typeof CONFIG !== "undefined" && typeof CONFIG.RAPID_TOTAL_MAX_PER_SCAN === "number")
          ? CONFIG.RAPID_TOTAL_MAX_PER_SCAN
          : 30;
        if (typeof fetchRapidLinkedInActive1h_ === "function" && CONFIG.RAPID_ENABLE_LINKEDIN) {
          var linkedInJobs = fetchRapidLinkedInActive1h_({ limit: CONFIG.RAPID_LINKEDIN_MAX });
          var takeLinkedIn = Math.min(linkedInJobs.length, rapidCapRemaining);
          if (takeLinkedIn > 0) {
            jobs = jobs.concat(linkedInJobs.slice(0, takeLinkedIn));
            rapidLinkedInCount = takeLinkedIn;
            rapidCapRemaining -= takeLinkedIn;
          }
        }
        if (typeof fetchRapidATSActiveExpired_ === "function" && CONFIG.RAPID_ENABLE_ATS && rapidCapRemaining > 0) {
          var atsJobs = fetchRapidATSActiveExpired_();
          var takeATS = Math.min(atsJobs.length, rapidCapRemaining);
          if (takeATS > 0) {
            jobs = jobs.concat(atsJobs.slice(0, takeATS));
            rapidATSCount = takeATS;
          }
        }
        resultsBySource.rapidLinkedIn = rapidLinkedInCount;
        resultsBySource.rapidATS = rapidATSCount;
        rapidSkipped = (rapidLinkedInCount + rapidATSCount) === 0;
        rapidSkipReason = rapidSkipped ? "no results" : "";
        logEvent_({
          timestamp: Date.now(),
          profileId: profile.profileId,
          action: "fetch_enriched",
          source: "pipeline",
          details: {
            level: "INFO",
            message: rapidSkipped ? "RapidAPI skipped (enough candidates)" : "RapidAPI fallback ran",
            meta: { batchId: batchId, rapidLinkedInCount: rapidLinkedInCount, rapidATSCount: rapidATSCount, rapidSkipped: rapidSkipped, rapidSkipReason: rapidSkipReason },
            batchId,
            version: Sygnalist_VERSION
          }
        });
      } else {
        if (rapidEnabled) rapidSkipReason = "enough candidates";
        logEvent_({
          timestamp: Date.now(),
          profileId: profile.profileId,
          action: "fetch_enriched",
          source: "pipeline",
          details: {
            level: "INFO",
            message: "RapidAPI skipped",
            meta: { batchId: batchId, rapidSkipped: true, rapidSkipReason: rapidSkipReason },
            batchId,
            version: Sygnalist_VERSION
          }
        });
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
          .filter(j => !j.excluded)
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

      var maxEnrich = (typeof CONFIG.MAX_ENRICH_PER_FETCH === "number" && CONFIG.MAX_ENRICH_PER_FETCH > 0) ? CONFIG.MAX_ENRICH_PER_FETCH : (CONFIG.MAX_JOBS_PER_FETCH || 25);
      var candidatesToEnrich = candidates.slice(0, maxEnrich);

      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId,
        action: "fetch_enriched",
        source: "debug",
        details: {
          level: "INFO",
          message: "Fetch batch summary",
          meta: {
            batchId: batchId,
            totalTermsUsed: (plan.searchTerms || []).length,
            sourcesUsed: (plan.sources || []).length,
            requestsAttempted: requestsAttempted,
            resultsBySource: resultsBySource,
            sourcesShortCircuited: sourcesShortCircuited,
            totalFetchedBeforeDedupe: rawFetched,
            afterDedupe: afterDedupe,
            candidatesSelectedForEnrich: candidatesToEnrich.length,
            rapidSkipped: rapidSkipped,
            rapidSkipReason: rapidSkipReason
          },
          batchId,
          version: Sygnalist_VERSION
        }
      });

      // 4) Enrich (skip failures inside enrichJobsForProfile_)
      const enriched = enrichJobsForProfile_(candidatesToEnrich, profile)
        .filter(j => String(j.jobSummary || "").trim() && String(j.whyFit || "").trim());

      // 5) Exclude jobs already in Tracker so they do not reappear in Inbox until released
      const trackerKeys = getTrackerKeyStringsForProfile_(profile.profileId);
      var forInbox = enriched.filter(j => {
        const u = normalizeUrl_(j.url);
        if (u && trackerKeys.has(u)) return false;
        const k = buildFallbackKey_(j.company, j.title);
        if (k && trackerKeys.has(k)) return false;
        return true;
      });
      forInbox = filterTierGate_(forInbox);
      forInbox = forInbox.filter(function (j) { return String(j.tier || "").toUpperCase() !== "X"; });

      // 6) Write enriched inbox (replace profile inbox)
      var written;
      try {
        clearEngineInboxForProfile_(profile.profileId);
        written = writeEngineInboxEnriched_(forInbox, profile.profileId);
      } catch (writeErr) {
        return { ok: false, version: Sygnalist_VERSION, message: "Write failed (Engine_Inbox): " + (writeErr.message || String(writeErr)) };
      }

      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId,
        action: "fetch_enriched",
        source: "pipeline",
        details: {
          level: "INFO",
          message: "Fetch+Enrich pipeline complete",
          meta: { batchId, rawFetched, candidates: candidates.length, enriched: enriched.length, written, enrichPhaseMs: (typeof tEnrichStart === "number" ? Date.now() - tEnrichStart : 0) },
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
    const num = Number(n);
    if (isNaN(num)) return String(n);
    if (num >= 1000) {
      const x = num / 1000;
      const rounded = Math.round(x * 10) / 10;
      const str = rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
      return str + "k";
    }
    const rounded = Math.round(num * 10) / 10;
    return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
  };
  const sym = currency.toUpperCase() === "USD" ? "$" : "";
  if (min != null && max != null && min !== max) return sym + fmt(min) + "–" + fmt(max);
  if (max != null) return sym + fmt(max);
  if (min != null) return sym + fmt(min);
  return "—";
}

/** Derive salary_source for DTO: "listed" if job has salary object with min/max, else "missing". "inferred" reserved for future. */
function deriveSalarySource_(salary) {
  if (salary && typeof salary === "object") {
    const s = salary;
    if (s.min != null && Number(s.min) > 0) return "listed";
    if (s.max != null && Number(s.max) > 0) return "listed";
  }
  return "missing";
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
        case "salary_source": return deriveSalarySource_(j.salary);
        case "added_at": return now;
        default: return "";
      }
    });
  });

  if (rows.length) {
    var numRows = rows.length;
    var numCols = headers.length;
    if (numRows !== rows.length) throw new Error("Engine_Inbox write enriched: range rows " + numRows + " != data rows " + rows.length);
    sh.getRange(sh.getLastRow() + 1, 1, numRows, numCols).setValues(rows);
  }

  return rows.length;
}
