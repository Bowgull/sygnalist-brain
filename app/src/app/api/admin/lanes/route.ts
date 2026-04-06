import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** GET /api/admin/lanes - get all lanes with usage counts */
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

  // Fetch usage counts from global_job_bank per job_family
  const { data: usageRows } = await service
    .from("global_job_bank")
    .select("job_family");

  const usageMap: Record<string, number> = {};
  if (usageRows) {
    for (const row of usageRows) {
      const key = row.job_family;
      if (key) usageMap[key] = (usageMap[key] ?? 0) + 1;
    }
  }

  const lanes = (data ?? []).map((lane) => ({
    ...lane,
    job_count: usageMap[lane.lane_key] ?? 0,
  }));

  return json(lanes);
}

/** POST /api/admin/lanes - create a lane. Accepts { name: string } */
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

/** PATCH /api/admin/lanes - update a lane by id */
export async function PATCH(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  if (!body.id) return error("id is required", 400);

  const allowedFields = ["role_name", "aliases", "is_active", "status"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return error("No valid fields to update", 400);
  }

  const service = getServiceClient();

  // If renaming, also update lane_key and propagate to global_job_bank
  let oldLaneKey: string | null = null;
  let newLaneKey: string | null = null;
  if (patch.role_name) {
    const { data: existing } = await service
      .from("lane_role_bank")
      .select("lane_key")
      .eq("id", body.id)
      .single();
    if (existing) {
      oldLaneKey = existing.lane_key;
      newLaneKey = (patch.role_name as string).toLowerCase().replace(/\s+/g, "_");
      patch.lane_key = newLaneKey;
    }
  }

  const { data, error: dbError } = await service
    .from("lane_role_bank")
    .update(patch)
    .eq("id", body.id)
    .select()
    .single();

  if (dbError) {
    logError(dbError.message, { severity: "error", sourceSystem: "api.admin.lanes", stackTrace: dbError.message });
    return error(dbError.message, 500);
  }

  // Propagate lane_key rename to global_job_bank
  if (oldLaneKey && newLaneKey && oldLaneKey !== newLaneKey) {
    await service
      .from("global_job_bank")
      .update({ job_family: newLaneKey })
      .eq("job_family", oldLaneKey);
  }

  logEvent("admin.lane_update", { userId: admin?.id, metadata: { id: body.id, patch } });
  return json(data);
}

/** DELETE /api/admin/lanes - delete a lane by id */
export async function DELETE(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return error("id is required", 400);

  const service = getServiceClient();

  // Check referential integrity: are any jobs using this lane?
  const { data: lane } = await service
    .from("lane_role_bank")
    .select("lane_key, role_name")
    .eq("id", id)
    .single();

  if (lane) {
    const { count } = await service
      .from("global_job_bank")
      .select("id", { count: "exact", head: true })
      .eq("job_family", lane.lane_key);

    if (count && count > 0) {
      return error(
        `Cannot delete "${lane.role_name}" — ${count} job(s) in the bank reference this lane. Reassign them first.`,
        409,
      );
    }
  }

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
