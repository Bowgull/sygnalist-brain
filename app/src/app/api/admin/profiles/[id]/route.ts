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
    await logError(dbError.message, {
      sourceSystem: "api.admin.profiles.update",
      userId: admin?.id,
      metadata: { target_profile_id: id, fields: Object.keys(patch) },
    });
    return error(dbError.message, 500);
  }

  await logEvent("admin.profile_update", {
    userId: admin?.id,
    metadata: {
      target_profile_id: id,
      changed_fields: Object.keys(patch),
    },
  });

  return json(data);
}
