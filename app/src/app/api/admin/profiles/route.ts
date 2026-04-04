import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** GET /api/admin/profiles — list all profiles */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();
  const { data, error: dbError } = await service
    .from("profiles")
    .select("*")
    .order("display_name");

  if (dbError) return error(dbError.message, 500);
  return json(data);
}

/** POST /api/admin/profiles — create a new profile */
export async function POST(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();

  if (!body.display_name || !body.profile_id) {
    return error("display_name and profile_id are required");
  }

  const service = getServiceClient();
  const { data, error: dbError } = await service
    .from("profiles")
    .insert({
      profile_id: body.profile_id,
      display_name: body.display_name,
      email: body.email || null,
      current_city: body.current_city || null,
      preferred_locations: body.preferred_locations || [],
      preferred_countries: body.preferred_countries || [],
      salary_min: body.salary_min || 0,
      accept_onsite: body.accept_onsite ?? false,
      accept_hybrid: body.accept_hybrid ?? true,
      accept_remote: body.accept_remote ?? true,
      role: body.role ?? "client",
    })
    .select()
    .single();

  if (dbError) {
    await logError(dbError.message, {
      sourceSystem: "api.admin.profiles.create",
      userId: admin?.id,
    });
    return error(dbError.message, 500);
  }

  await logEvent("admin.profile_create", {
    userId: admin?.id,
    metadata: {
      target_profile_id: data.id,
      display_name: body.display_name,
    },
  });

  return json(data, 201);
}
