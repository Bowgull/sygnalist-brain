import { requireAuth, json, error } from "@/lib/api-helpers";
import { logError } from "@/lib/logger";

/** GET /api/tracker — get the user's tracker entries */
export async function GET(request: Request) {
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("tracker_entries")
    .select("*", { count: "exact" })
    .eq("profile_id", profile.id)
    .order("added_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error: dbError, count } = await query;

  if (dbError) {
    logError(dbError.message, { severity: "warning", sourceSystem: "api.tracker", stackTrace: dbError.stack });
    return error(dbError.message, 500);
  }
  return json({ entries: data, total: count });
}
