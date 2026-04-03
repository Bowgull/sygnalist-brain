import { requireAuth, json, error, getServiceClient } from "@/lib/api-helpers";

/** POST /api/inbox/:id/dismiss — dismiss an inbox job (won't reappear) */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    await supabase.from("dismissed_jobs").upsert(
      {
        profile_id: profile.id,
        url: job.url,
        title: job.title,
        company: job.company,
      },
      { onConflict: "profile_id,url" }
    );
  }

  // Remove from inbox
  await supabase.from("inbox_jobs").delete().eq("id", id);

  // Log event
  const service = getServiceClient();
  await service.from("user_events").insert({
    user_id: profile.id,
    event_type: "dismiss",
    metadata: { url: job.url },
  });

  return json({ ok: true });
}
