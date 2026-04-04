import { requireAuth, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent } from "@/lib/logger";

/**
 * POST /api/fetch — trigger a job fetch for the user's profile.
 *
 * Stub for Phase 4. Validates auth, logs the request, returns placeholder.
 */
export async function POST() {
  const { profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  if (profile.status === "inactive_soft_locked") {
    return error("Profile is locked — contact your coach", 403);
  }

  const requestId = crypto.randomUUID();
  const service = getServiceClient();

  await service.from("job_fetch_logs").insert({
    profile_id: profile.id,
    source_name: "stub",
    jobs_returned: 0,
    request_id: requestId,
    duration_ms: 0,
  });

  await logEvent("fetch.started", {
    userId: profile.id,
    requestId,
    metadata: { phase: "stub" },
  });

  // TODO: Phase 4 will implement the actual fetch pipeline
  return json({
    request_id: requestId,
    message: "Fetch pipeline will be available after Phase 4",
    jobs_delivered: 0,
  });
}
