import { requireAdmin, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** POST /api/admin/view-as/inbox/:id/promote?client_id=xxx - promote a client's inbox job to tracker */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return error("client_id is required", 400);

  const service = getServiceClient();

  const { data: job, error: fetchErr } = await service
    .from("inbox_jobs")
    .select("*")
    .eq("id", id)
    .eq("profile_id", clientId)
    .single();

  if (fetchErr || !job) return error("Job not found", 404);

  if (job.url) {
    const { data: existing } = await service
      .from("tracker_entries")
      .select("id")
      .eq("profile_id", clientId)
      .eq("url", job.url)
      .limit(1);

    if (existing && existing.length > 0) {
      logEvent("inbox.promote", { userId: clientId, requestId, success: false, metadata: { inbox_job_id: id, reason: "duplicate_url", via: "view_as" } });
      return error("Job already in tracker", 409);
    }
  }

  const { data: entry, error: insertErr } = await service
    .from("tracker_entries")
    .insert({
      profile_id: clientId,
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
    logError(insertErr.message, { sourceSystem: "api.view-as.inbox.promote", userId: clientId, requestId, metadata: { inbox_job_id: id } });
    return error(insertErr.message, 500);
  }

  if (job.url) {
    await service.from("global_job_bank").upsert(
      {
        url: job.url,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        work_mode: job.role_type,
        source: job.source,
        job_summary: job.job_summary,
        why_fit: job.why_fit,
        stale_status: "active",
        stale_at: null,
      },
      { onConflict: "url" }
    );
  }

  logEvent("inbox.promote", { userId: clientId, requestId, metadata: { inbox_job_id: id, tracker_entry_id: entry.id, via: "view_as" } });

  return json(entry, 201);
}
