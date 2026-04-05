import { requireAuth, json, error } from "@/lib/api-helpers";
import { logError } from "@/lib/logger";

/** GET /api/inbox/:id — get a single inbox job with full detail */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const { data, error: dbError } = await supabase
    .from("inbox_jobs")
    .select("*")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .single();

  if (dbError) {
    logError(dbError.message, { severity: "warning", sourceSystem: "api.inbox.detail", stackTrace: dbError.stack });
    return error("Job not found", 404);
  }
  return json(data);
}
