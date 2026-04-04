import { requireAuth, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** POST /api/tracker/manual-add — manually add a job to tracker */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();

  if (!body.title || !body.company) {
    return error("Title and company are required");
  }

  // Check for duplicate URL if provided
  if (body.url) {
    const { data: existing } = await supabase
      .from("tracker_entries")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("url", body.url)
      .limit(1);

    if (existing && existing.length > 0) {
      await logEvent("tracker.manual_add", {
        userId: profile.id,
        requestId,
        success: false,
        metadata: { reason: "duplicate_url", url: body.url },
      });
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
      status: "Prospect",
      source: "manual",
    })
    .select()
    .single();

  if (insertErr) {
    await logError(insertErr.message, {
      sourceSystem: "api.tracker.manual_add",
      userId: profile.id,
      requestId,
    });
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

  await logEvent("tracker.manual_add", {
    userId: profile.id,
    requestId,
    metadata: { tracker_entry_id: entry.id },
  });

  return json(entry, 201);
}
