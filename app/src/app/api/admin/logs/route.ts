import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent } from "@/lib/logger";

/** GET /api/admin/logs - get event logs, error logs, or fetch logs */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "events"; // events | errors | fetches
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const profileId = searchParams.get("profile_id");

  const search = searchParams.get("search")?.trim();

  const service = getServiceClient();

  // ── Request ID cross-query: search all 3 tables ──────────────────────
  const requestId = searchParams.get("request_id");
  if (requestId) {
    const [events, errors, fetches] = await Promise.all([
      service.from("user_events").select("*").eq("request_id", requestId).order("created_at", { ascending: true }),
      service.from("error_logs").select("*").eq("request_id", requestId).order("created_at", { ascending: true }),
      service.from("job_fetch_logs").select("*").eq("request_id", requestId).order("created_at", { ascending: true }),
    ]);
    const unified = [
      ...(events.data ?? []).map((e) => ({ ...e, _type: "event" as const })),
      ...(errors.data ?? []).map((e) => ({ ...e, _type: "error" as const })),
      ...(fetches.data ?? []).map((e) => ({ ...e, _type: "fetch" as const })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return json(unified);
  }

  // ── Errors ───────────────────────────────────────────────────────────
  if (type === "errors") {
    let query = service
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (profileId) query = query.eq("user_id", profileId);

    const resolved = searchParams.get("resolved");
    if (resolved !== null) query = query.eq("resolved", resolved === "true");

    const severity = searchParams.get("severity");
    if (severity) query = query.eq("severity", severity);

    if (search) query = query.or(`message.ilike.%${search}%,source_system.ilike.%${search}%`);

    const { data, error: dbError } = await query;
    if (dbError) return error(dbError.message, 500);

    // Get unresolved count
    const { count } = await service
      .from("error_logs")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false);

    return json({ logs: data, unresolved_count: count ?? 0 });
  }

  // ── Fetches ──────────────────────────────────────────────────────────
  if (type === "fetches") {
    let query = service
      .from("job_fetch_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (profileId) query = query.eq("profile_id", profileId);

    const success = searchParams.get("success");
    if (success !== null) query = query.eq("success", success === "true");

    if (search) query = query.or(`source_name.ilike.%${search}%,error_message.ilike.%${search}%`);

    const { data, error: dbError } = await query;
    if (dbError) return error(dbError.message, 500);
    return json(data);
  }

  // ── Events (default) ────────────────────────────────────────────────
  let query = service
    .from("user_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (profileId) query = query.eq("user_id", profileId);

  const eventType = searchParams.get("event_type");
  if (eventType) query = query.eq("event_type", eventType);

  const domain = searchParams.get("domain");
  if (domain) query = query.ilike("event_type", `${domain}.%`);

  const success = searchParams.get("success");
  if (success !== null) query = query.eq("success", success === "true");

  if (search) query = query.or(`event_type.ilike.%${search}%,metadata->>'reason'.ilike.%${search}%`);

  const { data, error: dbError } = await query;
  if (dbError) return error(dbError.message, 500);
  return json(data);
}

/** PATCH /api/admin/logs - resolve an error log */
export async function PATCH(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  if (!body.error_id) return error("error_id is required");

  const service = getServiceClient();

  // Build update payload
  const update: Record<string, unknown> = {
    resolved: true,
    resolved_at: new Date().toISOString(),
    resolved_by: profile!.id,
  };

  // Store resolve_note in metadata if provided
  if (body.resolve_note) {
    // Merge note into existing metadata
    const { data: existing } = await service
      .from("error_logs")
      .select("metadata")
      .eq("id", body.error_id)
      .single();

    const existingMeta = (existing?.metadata as Record<string, unknown>) ?? {};
    update.metadata = { ...existingMeta, resolve_note: body.resolve_note };
  }

  const { data, error: dbError } = await service
    .from("error_logs")
    .update(update)
    .eq("id", body.error_id)
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);

  logEvent("admin.error_resolve", {
    userId: profile!.id,
    metadata: { error_id: body.error_id, resolve_note: body.resolve_note ?? null },
  });
  return json(data);
}
