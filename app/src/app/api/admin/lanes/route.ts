import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** GET /api/admin/lanes — get all lane-role bank entries */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();
  const { data, error: dbError } = await service
    .from("lane_role_bank")
    .select("*")
    .order("lane_key");

  if (dbError) return error(dbError.message, 500);
  return json(data);
}

/** POST /api/admin/lanes — add a role to the lane bank */
export async function POST(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();

  if (!body.role_name || !body.lane_key) {
    return error("role_name and lane_key are required");
  }

  const service = getServiceClient();
  const { data, error: dbError } = await service
    .from("lane_role_bank")
    .insert({
      role_name: body.role_name,
      keywords: body.keywords || [],
      lane_key: body.lane_key,
    })
    .select()
    .single();

  if (dbError) {
    await logError(dbError.message, {
      sourceSystem: "api.admin.lanes.create",
      userId: admin?.id,
    });
    return error(dbError.message, 500);
  }

  await logEvent("admin.lane_add", {
    userId: admin?.id,
    metadata: { lane_key: body.lane_key, role_name: body.role_name },
  });

  return json(data, 201);
}
