import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";
import { runFetchPipeline } from "@/lib/sources/orchestrator";

/** POST /api/admin/view-as/fetch?client_id=xxx - trigger a job fetch for a client */
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return error("client_id is required", 400);

  const service = getServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!profile) return error("Client not found", 404);

  if (profile.status === "inactive_soft_locked") {
    return error("Profile is locked", 403);
  }

  logEvent("fetch.started", { userId: clientId, metadata: { triggered_by: "admin_view_as" } });

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Pipeline failed";
    logError(message, { sourceSystem: "api.view-as.fetch", userId: clientId });
    return error(message, 500);
  }
}
