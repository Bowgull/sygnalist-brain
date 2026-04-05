import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/** GET /api/admin/view-as/tracker?client_id=xxx — get a client's tracker entries */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return error("client_id is required", 400);

  const status = searchParams.get("status");

  const service = getServiceClient();

  let query = service
    .from("tracker_entries")
    .select("*", { count: "exact" })
    .eq("profile_id", clientId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error: dbError, count } = await query;
  if (dbError) return error(dbError.message, 500);

  return json({ entries: data, total: count });
}
