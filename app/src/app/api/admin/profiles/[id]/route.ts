import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** GET /api/admin/profiles/:id — get a single profile (admin view) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();
  const { data, error: dbError } = await service
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (dbError) return error("Profile not found", 404);
  return json(data);
}

/** PATCH /api/admin/profiles/:id — update any profile field (admin) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();

  // Admin can update any profile field
  const allowedFields = [
    "display_name",
    "email",
    "current_city",
    "preferred_locations",
    "preferred_countries",
    "preferred_cities",
    "salary_min",
    "accept_onsite",
    "accept_hybrid",
    "accept_remote",
    "remote_region_scope",
    "distance_range_km",
    "status",
    "status_reason",
    "role",
    "search_terms_override",
    "role_tracks",
    "lane_controls",
    "skill_profile_text",
    "top_skills",
    "signature_stories",
    "banned_keywords",
    "disqualifying_seniority",
    "allow_sales_heavy",
    "allow_phone_heavy",
    "allow_weekend_work",
    "allow_shift_work",
    "location_blacklist",
    "skill_keywords_plus",
    "skill_keywords_minus",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return error("No valid fields to update");
  }

  const service = getServiceClient();
  const { data, error: dbError } = await service
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    logError(dbError.message, { sourceSystem: "api.admin.profile_update", userId: admin?.id, metadata: { target_profile_id: id } });
    return error(dbError.message, 500);
  }

  logEvent("admin.profile_update", { userId: admin?.id, metadata: { target_profile_id: id, changed_fields: Object.keys(patch) } });
  return json(data);
}

/** DELETE /api/admin/profiles/:id — permanently delete a profile (admin) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  // Prevent admin from deleting themselves
  if (admin?.id === id) {
    return error("Cannot delete your own profile", 400);
  }

  const service = getServiceClient();

  // Fetch profile first for logging
  const { data: target } = await service
    .from("profiles")
    .select("display_name, email")
    .eq("id", id)
    .single();

  if (!target) return error("Profile not found", 404);

  // Nullify client_id on message/outreach records so audit trail is preserved.
  // Tables with ON DELETE CASCADE (tracker_entries, inbox_items, etc.) clean up automatically.
  await service.from("sent_messages").update({ client_id: null }).eq("client_id", id);
  await service.from("received_messages").update({ client_id: null }).eq("client_id", id);
  await service.from("outreach_suggestions").update({ client_id: null }).eq("client_id", id);

  const { error: dbError } = await service
    .from("profiles")
    .delete()
    .eq("id", id);

  if (dbError) {
    logError(dbError.message, { sourceSystem: "api.admin.profile_delete", userId: admin?.id, metadata: { target_profile_id: id } });
    return error(dbError.message, 500);
  }

  logEvent("admin.profile_delete", { userId: admin?.id, metadata: { target_profile_id: id, deleted_name: target.display_name, deleted_email: target.email } });
  return json({ deleted: true });
}
