import { requireAuth, json, error } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** GET /api/tracker/:id - get a single tracker entry */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const { data, error: dbError } = await supabase
    .from("tracker_entries")
    .select("*")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .single();

  if (dbError) return error("Entry not found", 404);
  return json(data);
}

/** PATCH /api/tracker/:id - update a tracker entry */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();

  const allowedFields = [
    "status",
    "title",
    "company",
    "url",
    "location",
    "salary",
    "role_type",
    "lane_label",
    "notes",
    "date_applied",
    "good_fit",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return error("No valid fields to update");
  }

  // Get current entry to detect status changes
  const { data: current } = await supabase
    .from("tracker_entries")
    .select("status")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .single();

  if (!current) return error("Entry not found", 404);

  // If status changed, update stage_changed_at
  if (patch.status && patch.status !== current.status) {
    patch.stage_changed_at = new Date().toISOString();
  }

  const { data, error: dbError } = await supabase
    .from("tracker_entries")
    .update(patch)
    .eq("id", id)
    .eq("profile_id", profile.id)
    .select()
    .single();

  if (dbError) {
    logError(dbError.message, { sourceSystem: "api.tracker.patch", userId: profile.id, metadata: { tracker_entry_id: id } });
    return error(dbError.message, 500);
  }

  // Log status change event
  if (patch.status && patch.status !== current.status) {
    logEvent("tracker.status_change", { userId: profile.id, metadata: { tracker_entry_id: id, from: current.status, to: String(patch.status) } });
  }

  return json(data);
}

/** DELETE /api/tracker/:id - remove a tracker entry */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const { error: dbError } = await supabase
    .from("tracker_entries")
    .delete()
    .eq("id", id)
    .eq("profile_id", profile.id);

  if (dbError) {
    logError(dbError.message, { sourceSystem: "api.tracker.delete", userId: profile.id, metadata: { tracker_entry_id: id } });
    return error(dbError.message, 500);
  }

  logEvent("tracker.remove", { userId: profile.id, metadata: { tracker_entry_id: id } });

  return json({ ok: true });
}
