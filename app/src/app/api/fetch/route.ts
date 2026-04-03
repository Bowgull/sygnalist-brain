import { requireAuth, json, error, getServiceClient } from "@/lib/api-helpers";

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

  const service = getServiceClient();
  const requestId = crypto.randomUUID();

  await service.from("job_fetch_logs").insert({
    profile_id: profile.id,
    source_name: "stub",
    jobs_returned: 0,
    request_id: requestId,
    duration_ms: 0,
  });

  await service.from("user_events").insert({
    user_id: profile.id,
    event_type: "fetch",
    metadata: { request_id: requestId },
  });

  // TODO: Phase 4 will implement the actual fetch pipeline
  return json({
    request_id: requestId,
    message: "Fetch pipeline will be available after Phase 4",
    jobs_delivered: 0,
  });
}
