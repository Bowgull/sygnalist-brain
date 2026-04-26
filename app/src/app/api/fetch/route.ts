import { requireAuth, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";
import { runFetchPipeline } from "@/lib/sources/orchestrator";
import { pickDemoJobs, demoDelay } from "@/lib/demo-fixtures";

const DEMO_MODE = process.env.DEMO_MODE === "true";

/**
 * POST /api/fetch - trigger a job fetch for the user's profile.
 *
 * Runs all 6 source adapters in parallel, deduplicates, scores, enriches with AI,
 * and delivers the top results to the user's inbox.
 */
export async function POST() {
  const { profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  if (profile.status === "inactive_soft_locked") {
    return error("Profile is locked - contact your coach", 403);
  }

  const service = getServiceClient();

  // Log the fetch event
  logEvent("fetch.started", { userId: profile.id, metadata: { triggered_by: "user" } });

  if (DEMO_MODE) {
    const start = Date.now();
    await demoDelay(1200, 2400);
    const jobs = pickDemoJobs(8);
    const rows = jobs.map((j, idx) => ({
      profile_id: profile.id,
      title: j.title,
      company: j.company,
      url: j.url,
      source: j.source,
      location: j.location,
      role_type: null,
      lane_label: null,
      salary: j.salary ?? null,
      salary_below_min: false,
      score: 92 - idx * 3,
      tier: idx < 3 ? "A" : idx < 6 ? "B" : "C",
      match_hits: 4,
      job_summary: j.description_snippet,
      why_fit: null,
      category: null,
    }));
    const { error: insertErr } = await service.from("inbox_jobs").insert(rows);
    if (insertErr) {
      logError(`Demo inbox insert failed: ${insertErr.message}`, { sourceSystem: "fetch.demo", userId: profile.id });
    }
    return json({
      request_id: `demo_${Date.now()}`,
      search_terms: [],
      sources: [],
      total_raw: jobs.length,
      after_dedupe: jobs.length,
      after_filter: jobs.length,
      jobs_delivered: jobs.length,
      duration_ms: Date.now() - start,
      demo: true,
    });
  }

  try {
    const result = await runFetchPipeline(profile, service);

    return json({
      request_id: result.requestId,
      search_terms: result.searchTerms,
      sources: result.sourceResults,
      total_raw: result.totalRaw,
      after_dedupe: result.afterDedupe,
      after_filter: result.afterFilter,
      jobs_delivered: result.jobsDelivered,
      duration_ms: result.duration_ms,
    });
  } catch (err) {
    logError(
      err instanceof Error ? err.message : "Unknown fetch error",
      {
        sourceSystem: "fetch_pipeline",
        userId: profile.id,
        stackTrace: err instanceof Error ? err.stack ?? undefined : undefined,
      }
    );

    return error("Fetch failed - please try again", 500);
  }
}
