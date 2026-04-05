import { requireAuth, json, error } from "@/lib/api-helpers";
import { logError } from "@/lib/logger";

/** GET /api/inbox - get the user's inbox jobs */
export async function GET(request: Request) {
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const { searchParams } = new URL(request.url);
  const lane = searchParams.get("lane");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let query = supabase
    .from("inbox_jobs")
    .select("*", { count: "exact" })
    .eq("profile_id", profile.id)
    .order("added_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (lane && lane !== "All") {
    query = query.eq("lane_label", lane);
  }

  const { data, error: dbError, count } = await query;

  if (dbError) {
    logError(dbError.message, { severity: "warning", sourceSystem: "api.inbox", stackTrace: dbError.stack });
    return error(dbError.message, 500);
  }

  return json({ jobs: data, total: count });
}
