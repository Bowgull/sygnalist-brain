import { requireAuth, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** POST /api/inbox/:id/promote — move an inbox job to the tracker */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  // Fetch the inbox job
  const { data: job, error: fetchErr } = await supabase
    .from("inbox_jobs")
    .select("*")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .single();

  if (fetchErr || !job) return error("Job not found", 404);

  // Check for duplicate in tracker (same URL)
  if (job.url) {
    const { data: existing } = await supabase
      .from("tracker_entries")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("url", job.url)
      .limit(1);

    if (existing && existing.length > 0) {
      await logEvent("inbox.promote", {
        userId: profile.id,
        requestId,
        success: false,
        metadata: { inbox_job_id: id, reason: "duplicate_url" },
      });
      return error("Job already in tracker", 409);
    }
  }

  // Create tracker entry
  const { data: entry, error: insertErr } = await supabase
    .from("tracker_entries")
    .insert({
      profile_id: profile.id,
      title: job.title,
      company: job.company,
      url: job.url,
      location: job.location,
      salary: job.salary,
      role_type: job.role_type,
      lane_label: job.lane_label,
      category: job.category,
      job_summary: job.job_summary,
      why_fit: job.why_fit,
      source: job.source,
      status: "Prospect",
    })
    .select()
    .single();

  if (insertErr) {
    await logError(insertErr.message, {
      sourceSystem: "api.inbox.promote",
      userId: profile.id,
      requestId,
      metadata: { inbox_job_id: id },
    });
    return error(insertErr.message, 500);
  }

  // Also upsert to global job bank (if URL exists)
  if (job.url) {
    const service = getServiceClient();
    await service.from("global_job_bank").upsert(
      {
        url: job.url,
        title: job.title,
        company: job.company,
        location: job.location,
        source: job.source,
      },
      { onConflict: "url" }
    );
  }

  await logEvent("inbox.promote", {
    userId: profile.id,
    requestId,
    metadata: { inbox_job_id: id, tracker_entry_id: entry.id },
  });

  return json(entry, 201);
}
