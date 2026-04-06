import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/** GET /api/admin/job-bank - get global job bank entries with search, filter, sort */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const search = searchParams.get("search")?.trim() ?? "";
  const jobFamily = searchParams.get("job_family") ?? "";
  const source = searchParams.get("source") ?? "";
  const workMode = searchParams.get("work_mode") ?? "";
  const staleStatus = searchParams.get("stale_status") ?? "";
  const sortBy = searchParams.get("sort_by") ?? "created_at";
  const order = searchParams.get("order") ?? "desc";

  const service = getServiceClient();
  let query = service
    .from("global_job_bank")
    .select("*", { count: "exact" });

  // Server-side search across title, company, job_family
  if (search) {
    query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%,job_family.ilike.%${search}%`);
  }
  if (jobFamily) {
    query = query.eq("job_family", jobFamily);
  }
  if (source) {
    query = query.eq("source", source);
  }
  if (workMode) {
    query = query.eq("work_mode", workMode);
  }
  if (staleStatus) {
    query = query.eq("stale_status", staleStatus);
  }

  // Sorting
  const validSortFields = ["created_at", "title", "company", "job_family", "source"];
  const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";
  query = query.order(sortField, { ascending: order === "asc" });

  query = query.range(offset, offset + limit - 1);

  const { data, error: dbError, count } = await query;

  if (dbError) {
    logError(dbError.message, { severity: "warning", sourceSystem: "api.admin.job-bank", stackTrace: dbError.message });
    return error(dbError.message, 500);
  }
  return json({ jobs: data, total: count });
}

/** POST /api/admin/job-bank - add a single job or array of jobs */
export async function POST(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();

  // Accept both single job object and { jobs: [...] } array
  let jobList: Record<string, unknown>[];
  if (Array.isArray(body.jobs)) {
    jobList = body.jobs;
  } else if (body.title || body.url || body.company) {
    jobList = [body];
  } else {
    return error("Provide a job object (title, url, company) or { jobs: [...] }");
  }

  if (jobList.length === 0) {
    return error("No jobs provided");
  }

  const service = getServiceClient();
  const rows = jobList.map((j) => ({
    url: (j.url as string) || null,
    title: (j.title as string) || null,
    company: (j.company as string) || null,
    location: (j.location as string) || null,
    salary: (j.salary as string) || null,
    work_mode: (j.work_mode as string) || null,
    source: (j.source as string) || "admin",
    job_family: (j.job_family as string) || null,
    description_snippet: (j.description_snippet as string) || null,
    job_summary: (j.job_summary as string) || null,
    why_fit: (j.why_fit as string) || null,
    stale_status: "active",
    stale_at: null,
  }));

  // Use insert if no URL (can't upsert without conflict key), upsert if URL present
  const withUrl = rows.filter((r): r is typeof r & { url: string } => !!r.url);
  const withoutUrl = rows.filter((r) => !r.url);

  let totalInserted = 0;

  if (withUrl.length > 0) {
    const { data, error: dbError } = await service
      .from("global_job_bank")
      .upsert(withUrl, { onConflict: "url" })
      .select();
    if (dbError) {
      logError(dbError.message, { severity: "error", sourceSystem: "api.admin.job-bank", stackTrace: dbError.message });
      return error(dbError.message, 500);
    }
    totalInserted += data?.length ?? 0;
  }

  if (withoutUrl.length > 0) {
    const { data, error: dbError } = await service
      .from("global_job_bank")
      .insert(withoutUrl)
      .select();
    if (dbError) {
      logError(dbError.message, { severity: "error", sourceSystem: "api.admin.job-bank", stackTrace: dbError.message });
      return error(dbError.message, 500);
    }
    totalInserted += data?.length ?? 0;
  }

  logEvent("admin.job_bank_upsert", { userId: admin?.id, metadata: { count: totalInserted } });
  return json({ upserted: totalInserted });
}

/** PATCH /api/admin/job-bank - update a job bank entry by ID */
export async function PATCH(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  if (!body.id) return error("id is required");

  const allowedFields = [
    "title", "company", "url", "location", "salary", "work_mode",
    "source", "job_family", "description_snippet", "job_summary", "why_fit",
    "stale_status", "stale_at",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return error("No valid fields to update");
  }

  const service = getServiceClient();
  const { data, error: dbError } = await service
    .from("global_job_bank")
    .update(patch)
    .eq("id", body.id)
    .select()
    .single();

  if (dbError) {
    logError(dbError.message, { severity: "error", sourceSystem: "api.admin.job-bank", stackTrace: dbError.message });
    return error(dbError.message, 500);
  }
  logEvent("admin.job_bank_update", { userId: admin?.id, metadata: { job_id: body.id, fields: Object.keys(patch) } });
  return json(data);
}

/** DELETE /api/admin/job-bank - remove a job by ID or URL */
export async function DELETE(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    // Delete by ID (from query param)
    const service = getServiceClient();
    const { error: dbError } = await service
      .from("global_job_bank")
      .delete()
      .eq("id", id);
    if (dbError) {
      logError(dbError.message, { severity: "error", sourceSystem: "api.admin.job-bank", stackTrace: dbError.message });
      return error(dbError.message, 500);
    }
    logEvent("admin.job_bank_delete", { userId: admin?.id, metadata: { job_id: id } });
    return json({ ok: true });
  }

  // Fallback: delete by URL from body
  try {
    const body = await request.json();
    if (!body.url) return error("id query param or { url } body required");

    const service = getServiceClient();
    const { error: dbError } = await service
      .from("global_job_bank")
      .delete()
      .eq("url", body.url);
    if (dbError) {
      logError(dbError.message, { severity: "error", sourceSystem: "api.admin.job-bank", stackTrace: dbError.message });
      return error(dbError.message, 500);
    }
    logEvent("admin.job_bank_delete", { userId: admin?.id, metadata: { url: body.url } });
    return json({ ok: true });
  } catch {
    return error("id query param or { url } body required");
  }
}
