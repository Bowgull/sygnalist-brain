import { requireAuth, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";
import { runFetchPipeline } from "@/lib/sources/orchestrator";

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
