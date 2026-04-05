import { requireAuth, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

const ALLOWED_STAGES = ["Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer"];

/** POST /api/tracker/manual-add - manually add a job to tracker */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();

  if (!body.title || !body.company) {
    return error("Title and company are required");
  }

  const status = body.status && ALLOWED_STAGES.includes(body.status) ? body.status : "Prospect";

  // Check for duplicate URL if provided
  if (body.url) {
    const { data: existing } = await supabase
      .from("tracker_entries")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("url", body.url)
      .limit(1);

    if (existing && existing.length > 0) {
      logEvent("tracker.manual_add", { userId: profile.id, requestId, success: false, metadata: { url: body.url, reason: "duplicate_url" } });
      return error("Job with this URL already in tracker", 409);
    }
  }

  const { data: entry, error: insertErr } = await supabase
    .from("tracker_entries")
    .insert({
      profile_id: profile.id,
      title: body.title,
      company: body.company,
      url: body.url || null,
      location: body.location || null,
      salary: body.salary || null,
      notes: body.notes || null,
      status,
      source: "manual",
      ...(status === "Applied" ? { date_applied: new Date().toISOString().slice(0, 10) } : {}),
    })
    .select()
    .single();

  if (insertErr) {
    logError(insertErr.message, { sourceSystem: "api.tracker.manual_add", userId: profile.id, requestId, metadata: { title: body.title, company: body.company } });
    return error(insertErr.message, 500);
  }

  // Also upsert to global job bank if URL provided
  if (body.url) {
    const service = getServiceClient();
    await service.from("global_job_bank").upsert(
      {
        url: body.url,
        title: body.title,
        company: body.company,
        location: body.location || null,
        source: "manual",
      },
      { onConflict: "url" }
    );
  }

  logEvent("tracker.manual_add", { userId: profile.id, requestId, metadata: { tracker_entry_id: entry.id } });

  return json(entry, 201);
}
