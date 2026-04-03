import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/** GET /api/admin/job-bank — get global job bank entries */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const service = getServiceClient();
  const { data, error: dbError, count } = await service
    .from("global_job_bank")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbError) return error(dbError.message, 500);
  return json({ jobs: data, total: count });
}

/** POST /api/admin/job-bank — add jobs to global bank */
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();

  if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
    return error("jobs array is required");
  }

  const service = getServiceClient();
  const rows = body.jobs.map((j: Record<string, unknown>) => ({
    url: j.url,
    title: j.title || null,
    company: j.company || null,
    location: j.location || null,
    salary: j.salary || null,
    work_mode: j.work_mode || null,
    source: j.source || "admin",
  }));

  const { data, error: dbError } = await service
    .from("global_job_bank")
    .upsert(rows, { onConflict: "url" })
    .select();

  if (dbError) return error(dbError.message, 500);
  return json({ upserted: data?.length ?? 0 });
}

/** DELETE /api/admin/job-bank — remove a job by URL */
export async function DELETE(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  if (!body.url) return error("url is required");

  const service = getServiceClient();
  const { error: dbError } = await service
    .from("global_job_bank")
    .delete()
    .eq("url", body.url);

  if (dbError) return error(dbError.message, 500);
  return json({ ok: true });
}
