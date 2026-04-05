import { requireAdmin, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { logEvent } from "@/lib/logger";

/** POST /api/admin/view-as/inbox/:id/dismiss?client_id=xxx — dismiss a client's inbox job */
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
    .select("id, url, title, company")
    .eq("id", id)
    .eq("profile_id", clientId)
    .single();

  if (fetchErr || !job) return error("Job not found", 404);

  if (job.url) {
    await service.from("dismissed_jobs").upsert(
      {
        profile_id: clientId,
        url: job.url,
        title: job.title,
        company: job.company,
      },
      { onConflict: "profile_id,url" }
    );
  }

  await service.from("inbox_jobs").delete().eq("id", id);

  logEvent("inbox.dismiss", { userId: clientId, requestId, metadata: { inbox_job_id: id, url: job.url, via: "view_as" } });

  return json({ ok: true });
}
