import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";
import { enrichBankJob } from "@/lib/enrichment/enrich-bank";

/**
 * GET /api/admin/review — Fetch the review queue (pending ingest jobs).
 * Returns pending jobs and available lane keys for assignment.
 */
export async function GET() {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const service = getServiceClient();

  // Get pending review jobs
  const { data: jobs, error: jobsErr } = await service
    .from("jobs_inbox")
    .select("*")
    .eq("review_status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (jobsErr) {
    return error("Failed to load review queue", 500);
  }

  // Get available lane keys
  const { data: lanes } = await service
    .from("lane_role_bank")
    .select("lane_key")
    .eq("is_active", true);

  const uniqueLanes = [...new Set((lanes ?? []).map((l: { lane_key: string }) => l.lane_key))].sort();

  // Get counts for context
  const { count: pendingCount } = await service
    .from("jobs_inbox")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "pending");

  const { count: approvedCount } = await service
    .from("jobs_inbox")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "approved");

  const { count: rejectedCount } = await service
    .from("jobs_inbox")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "rejected");

  return json({
    jobs: jobs ?? [],
    lanes: uniqueLanes,
    counts: {
      pending: pendingCount ?? 0,
      approved: approvedCount ?? 0,
      rejected: rejectedCount ?? 0,
    },
  });
}

/**
 * POST /api/admin/review — Batch approve or reject review queue jobs.
 *
 * Body: { action: "approve" | "reject", job_ids: string[], lane_key?: string }
 *
 * Approve: moves jobs to global_job_bank, assigns lane, triggers enrichment.
 * Reject: marks jobs as rejected (soft delete).
 */
export async function POST(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { action, job_ids, lane_key } = body as {
    action: "approve" | "reject";
    job_ids: string[];
    lane_key?: string;
  };

  if (!action || !Array.isArray(job_ids) || job_ids.length === 0) {
    return error("Missing action or job_ids", 400);
  }

  if (action === "approve" && !lane_key) {
    return error("Lane assignment required for approval", 400);
  }

  const service = getServiceClient();
  const now = new Date().toISOString();

  if (action === "reject") {
    const { error: updateErr } = await service
      .from("jobs_inbox")
      .update({
        review_status: "rejected",
        reviewed_at: now,
        reviewed_by: profile.id,
      })
      .in("id", job_ids)
      .eq("review_status", "pending");

    if (updateErr) {
      return error("Failed to reject jobs", 500);
    }

    await logEvent("admin.review_reject", {
      userId: profile.id,
      success: true,
      metadata: { count: job_ids.length },
    });

    return json({ action: "reject", count: job_ids.length });
  }

  // --- APPROVE FLOW ---

  // 1. Fetch the jobs being approved
  const { data: jobsToApprove, error: fetchErr } = await service
    .from("jobs_inbox")
    .select("*")
    .in("id", job_ids)
    .eq("review_status", "pending");

  if (fetchErr || !jobsToApprove) {
    return error("Failed to fetch jobs for approval", 500);
  }

  // 2. Mark as approved in review queue
  const { error: updateErr } = await service
    .from("jobs_inbox")
    .update({
      review_status: "approved",
      lane_key: lane_key,
      reviewed_at: now,
      reviewed_by: profile.id,
      enrichment_status: "APPROVED",
    })
    .in("id", job_ids)
    .eq("review_status", "pending");

  if (updateErr) {
    return error("Failed to approve jobs", 500);
  }

  // 3. Upsert into global_job_bank with lane assignment
  let bankInserted = 0;
  for (const job of jobsToApprove) {
    if (!job.url) continue;

    const { error: upsertErr } = await service
      .from("global_job_bank")
      .upsert(
        {
          url: job.url,
          title: job.title,
          company: job.company,
          source: job.source,
          location: job.location,
          work_mode: job.work_mode,
          job_family: lane_key,
          description_snippet: job.description_snippet,
        },
        { onConflict: "url" },
      );

    if (!upsertErr) bankInserted++;
  }

  // 4. Trigger enrichment for approved jobs (non-blocking)
  let enriched = 0;
  for (const job of jobsToApprove) {
    if (!job.url) continue;

    try {
      const summary = await enrichBankJob(
        {
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location,
          work_mode: job.work_mode,
          description_snippet: job.description_snippet,
        },
        service,
      );

      if (summary) {
        await service
          .from("global_job_bank")
          .update({ job_summary: summary })
          .eq("url", job.url);
        enriched++;
      }
    } catch (err) {
      await logError(
        `Bank enrichment failed for ${job.url}: ${err instanceof Error ? err.message : "unknown"}`,
        {
          severity: "warning",
          sourceSystem: "enrich.bank",
          userId: profile.id,
        },
      );
    }
  }

  await logEvent("admin.review_approve", {
    userId: profile.id,
    success: true,
    metadata: {
      count: jobsToApprove.length,
      lane_key,
      bank_inserted: bankInserted,
      enriched,
    },
  });

  return json({
    action: "approve",
    count: jobsToApprove.length,
    lane_key,
    bank_inserted: bankInserted,
    enriched,
  });
}
