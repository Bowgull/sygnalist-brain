import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/** GET /api/admin/view-as/inbox?client_id=xxx — get a client's inbox jobs */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return error("client_id is required", 400);

  const lane = searchParams.get("lane");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const service = getServiceClient();

  let query = service
    .from("inbox_jobs")
    .select("*", { count: "exact" })
    .eq("profile_id", clientId)
    .order("added_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (lane && lane !== "All") {
    query = query.eq("lane_label", lane);
  }

  const { data, error: dbError, count } = await query;
  if (dbError) return error(dbError.message, 500);

  return json({ jobs: data, total: count });
}
