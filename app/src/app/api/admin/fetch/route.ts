import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { runFetchPipeline } from "@/lib/sources/orchestrator";

/** POST /api/admin/fetch — trigger a job fetch for a specific profile (admin only) */
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  if (!body.profile_id) return error("profile_id is required");

  const service = getServiceClient();

  // Load the target profile
  const { data: profile, error: dbError } = await service
    .from("profiles")
    .select("*")
    .eq("id", body.profile_id)
    .single();

  if (dbError || !profile) return error("Profile not found", 404);

  if (profile.status !== "active") {
    return error("Profile is locked — unlock before fetching", 403);
  }

  // Log the admin-triggered fetch
  await service.from("user_events").insert({
    user_id: profile.id,
    event_type: "fetch",
    metadata: { triggered_by: "admin" },
  });

  try {
    const result = await runFetchPipeline(profile, service);

    return json({
      request_id: result.requestId,
      profile_id: profile.id,
      profile_name: profile.display_name,
      search_terms: result.searchTerms,
      sources: result.sourceResults,
      total_raw: result.totalRaw,
      after_dedupe: result.afterDedupe,
      after_filter: result.afterFilter,
      jobs_delivered: result.jobsDelivered,
      duration_ms: result.duration_ms,
    });
  } catch (err) {
    await service.from("error_logs").insert({
      severity: "error",
      source_system: "fetch_pipeline",
      message: err instanceof Error ? err.message : "Unknown fetch error",
      stack_trace: err instanceof Error ? err.stack ?? null : null,
      user_id: profile.id,
    });
    return error("Fetch failed — check logs", 500);
  }
}
