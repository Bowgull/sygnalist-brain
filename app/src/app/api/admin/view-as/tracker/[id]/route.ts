import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** PATCH /api/admin/view-as/tracker/:id?client_id=xxx - update a client's tracker entry */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return error("client_id is required", 400);

  const body = await request.json();
  const service = getServiceClient();

  const allowedFields = [
    "status", "title", "company", "url", "location", "salary",
    "role_type", "lane_label", "notes", "date_applied", "good_fit",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return error("No valid fields to update");
  }

  const { data: current } = await service
    .from("tracker_entries")
    .select("status")
    .eq("id", id)
    .eq("profile_id", clientId)
    .single();

  if (!current) return error("Entry not found", 404);

  if (patch.status && patch.status !== current.status) {
    patch.stage_changed_at = new Date().toISOString();
  }

  const { data, error: dbError } = await service
    .from("tracker_entries")
    .update(patch)
    .eq("id", id)
    .eq("profile_id", clientId)
    .select()
    .single();

  if (dbError) {
    logError(dbError.message, { sourceSystem: "api.view-as.tracker.patch", userId: clientId, metadata: { tracker_entry_id: id } });
    return error(dbError.message, 500);
  }

  if (patch.status && patch.status !== current.status) {
    logEvent("tracker.status_change", { userId: clientId, metadata: { tracker_entry_id: id, from: current.status, to: String(patch.status), via: "view_as" } });
  }

  return json(data);
}

/** DELETE /api/admin/view-as/tracker/:id?client_id=xxx - remove a client's tracker entry */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return error("client_id is required", 400);

  const service = getServiceClient();

  const { error: dbError } = await service
    .from("tracker_entries")
    .delete()
    .eq("id", id)
    .eq("profile_id", clientId);

  if (dbError) {
    logError(dbError.message, { sourceSystem: "api.view-as.tracker.delete", userId: clientId, metadata: { tracker_entry_id: id } });
    return error(dbError.message, 500);
  }

  logEvent("tracker.remove", { userId: clientId, metadata: { tracker_entry_id: id, via: "view_as" } });

  return json({ ok: true });
}
