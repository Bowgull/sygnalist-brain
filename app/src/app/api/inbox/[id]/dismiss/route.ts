import { requireAuth, json, error, getRequestId } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** POST /api/inbox/:id/dismiss — dismiss an inbox job (won't reappear) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  // Fetch the inbox job to get URL
  const { data: job, error: fetchErr } = await supabase
    .from("inbox_jobs")
    .select("id, url, title, company")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .single();

  if (fetchErr || !job) return error("Job not found", 404);

  // Record dismissal (prevents reappearing in future fetches)
  if (job.url) {
    const { error: upsertErr } = await supabase.from("dismissed_jobs").upsert(
      {
        profile_id: profile.id,
        url: job.url,
        title: job.title,
        company: job.company,
      },
      { onConflict: "profile_id,url" }
    );

    if (upsertErr) {
      await logError(upsertErr.message, {
        sourceSystem: "api.inbox.dismiss",
        userId: profile.id,
        requestId,
        metadata: { inbox_job_id: id },
      });
    }
  }

  // Remove from inbox
  const { error: deleteErr } = await supabase.from("inbox_jobs").delete().eq("id", id);

  if (deleteErr) {
    await logError(deleteErr.message, {
      sourceSystem: "api.inbox.dismiss",
      userId: profile.id,
      requestId,
      metadata: { inbox_job_id: id },
    });
    return error(deleteErr.message, 500);
  }

  await logEvent("inbox.dismiss", {
    userId: profile.id,
    requestId,
    metadata: { url: job.url },
  });

  return json({ ok: true });
}
