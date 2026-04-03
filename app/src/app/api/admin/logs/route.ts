import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/** GET /api/admin/logs — get event logs, error logs, or fetch logs */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "events"; // events | errors | fetches
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const profileId = searchParams.get("profile_id");

  const service = getServiceClient();

  if (type === "errors") {
    let query = service
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (profileId) query = query.eq("user_id", profileId);

    const resolved = searchParams.get("resolved");
    if (resolved !== null) query = query.eq("resolved", resolved === "true");

    const { data, error: dbError } = await query;
    if (dbError) return error(dbError.message, 500);
    return json(data);
  }

  if (type === "fetches") {
    let query = service
      .from("job_fetch_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (profileId) query = query.eq("profile_id", profileId);

    const { data, error: dbError } = await query;
    if (dbError) return error(dbError.message, 500);
    return json(data);
  }

  // Default: user events
  let query = service
    .from("user_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (profileId) query = query.eq("user_id", profileId);

  const eventType = searchParams.get("event_type");
  if (eventType) query = query.eq("event_type", eventType);

  const { data, error: dbError } = await query;
  if (dbError) return error(dbError.message, 500);
  return json(data);
}

/** PATCH /api/admin/logs — resolve an error log */
export async function PATCH(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  if (!body.error_id) return error("error_id is required");

  const service = getServiceClient();
  const { data, error: dbError } = await service
    .from("error_logs")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: profile!.id,
    })
    .eq("id", body.error_id)
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);
  return json(data);
}
