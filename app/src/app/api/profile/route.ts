import { requireAuth, json, error } from "@/lib/api-helpers";
import { logError } from "@/lib/logger";

/** GET /api/profile - get the authenticated user's profile */
export async function GET() {
  const { profile, response } = await requireAuth();
  if (response) return response;

  if (!profile) {
    return error("Profile not found", 404);
  }

  return json(profile);
}

/** PATCH /api/profile - update the authenticated user's profile */
export async function PATCH(request: Request) {
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();

  // Fields clients can update on their own profile
  const allowedFields = [
    "display_name",
    "current_city",
    "preferred_locations",
    "preferred_countries",
    "preferred_cities",
    "salary_min",
    "accept_onsite",
    "accept_hybrid",
    "accept_remote",
    "distance_range_km",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return error("No valid fields to update");
  }

  const { data, error: dbError } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", profile.id)
    .select()
    .single();

  if (dbError) {
    logError(dbError.message, { severity: "error", sourceSystem: "api.profile", stackTrace: dbError.stack });
    return error(dbError.message, 500);
  }
  return json(data);
}
