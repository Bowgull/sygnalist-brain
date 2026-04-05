import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** GET /api/admin/lanes — get all lanes */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();
  const { data, error: dbError } = await service
    .from("lane_role_bank")
    .select("*")
    .order("lane_key");

  if (dbError) {
    logError(dbError.message, { severity: "warning", sourceSystem: "api.admin.lanes", stackTrace: dbError.message });
    return error(dbError.message, 500);
  }
  return json(data);
}

/** POST /api/admin/lanes — create a lane. Accepts { name: string } */
export async function POST(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();

  // Accept simplified { name } or legacy { role_name, lane_key }
  const name: string = body.name || body.role_name;
  if (!name) {
    return error("name is required", 400);
  }

  const laneKey = (body.lane_key || name).toLowerCase().replace(/\s+/g, "_");
  const roleName = name;

  const service = getServiceClient();

  // Check if lane already exists
  const { data: existing } = await service
    .from("lane_role_bank")
    .select("id")
    .eq("lane_key", laneKey)
    .limit(1);

  if (existing && existing.length > 0) {
    return error("Lane already exists", 409);
  }

  const { data, error: dbError } = await service
    .from("lane_role_bank")
    .insert({
      lane_key: laneKey,
      role_name: roleName,
      aliases: body.aliases || [],
      source: body.source || "admin",
    })
    .select()
    .single();

  if (dbError) {
    logError(dbError.message, { severity: "error", sourceSystem: "api.admin.lanes", stackTrace: dbError.message });
    return error(dbError.message, 500);
  }

  logEvent("admin.lane_add", { userId: admin?.id, metadata: { lane_key: laneKey, role_name: roleName } });
  return json(data, 201);
}

/** DELETE /api/admin/lanes — delete a lane by id */
export async function DELETE(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return error("id is required", 400);

  const service = getServiceClient();
  const { error: dbError } = await service
    .from("lane_role_bank")
    .delete()
    .eq("id", id);

  if (dbError) {
    logError(dbError.message, { severity: "error", sourceSystem: "api.admin.lanes", stackTrace: dbError.message });
    return error(dbError.message, 500);
  }

  logEvent("admin.lane_delete", { userId: admin?.id, metadata: { id } });
  return json({ deleted: true });
}
