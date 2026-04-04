import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";
import { enrichBankJob } from "@/lib/enrichment/enrich-bank";

/**
 * GET /api/admin/review — Fetch the review queue.
 * Returns jobs grouped by review_status (pending + ready) and available lanes.
 */
export async function GET() {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const service = getServiceClient();

  // Get all active review jobs (pending + ready)
  const { data: jobs, error: jobsErr } = await service
    .from("jobs_inbox")
    .select("*")
    .in("review_status", ["pending", "ready"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (jobsErr) {
    return error("Failed to load review queue", 500);
  }

  // Get available lane keys
  const { data: lanes } = await service
    .from("lane_role_bank")
    .select("lane_key")
    .eq("is_active", true);

  const uniqueLanes = [...new Set((lanes ?? []).map((l: { lane_key: string }) => l.lane_key))].sort();

  // Get counts
  const pending = (jobs ?? []).filter((j) => j.review_status === "pending").length;
  const ready = (jobs ?? []).filter((j) => j.review_status === "ready").length;

  return json({
    jobs: jobs ?? [],
    lanes: uniqueLanes,
    counts: { pending, ready },
  });
}

/**
 * PATCH /api/admin/review — Inline edit a single review job.
 * Body: { id: string, patch: { title?, company?, location?, work_mode?, lane_key?, url?, notes? } }
 */
export async function PATCH(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { id, patch } = body as { id: string; patch: Record<string, unknown> };

  if (!id || !patch) {
    return error("Missing id or patch", 400);
  }

  // Whitelist editable fields
  const allowed = ["title", "company", "location", "work_mode", "lane_key", "url", "notes", "source", "job_family"];
  const safePatch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in patch) safePatch[key] = patch[key];
  }

  if (Object.keys(safePatch).length === 0) {
    return error("No valid fields to update", 400);
  }

  const service = getServiceClient();

  // Auto-create lane if it's new
  if (safePatch.lane_key && typeof safePatch.lane_key === "string") {
    const laneKey = safePatch.lane_key as string;
    const { data: existing } = await service
      .from("lane_role_bank")
      .select("id")
      .eq("lane_key", laneKey)
      .limit(1);

    if (!existing || existing.length === 0) {
      await service.from("lane_role_bank").insert({
        lane_key: laneKey,
        role_name: laneKey.replace(/_/g, " "),
        aliases: [],
        source: "review_auto",
      });
    }
  }

  const { data, error: updateErr } = await service
    .from("jobs_inbox")
    .update(safePatch)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    return error("Failed to update job", 500);
  }

  return json(data);
}

/**
 * POST /api/admin/review — Stage transitions and batch actions.
 * Body: { action: "move_to_ready" | "reject" | "approve" | "back_to_review", job_ids: string[] }
 */
export async function POST(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { action, job_ids } = body as {
    action: "move_to_ready" | "reject" | "approve" | "back_to_review";
    job_ids: string[];
  };

  if (!action || !Array.isArray(job_ids) || job_ids.length === 0) {
    return error("Missing action or job_ids", 400);
  }

  const service = getServiceClient();
  const now = new Date().toISOString();

  // --- MOVE TO READY ---
  if (action === "move_to_ready") {
    const { error: updateErr } = await service
      .from("jobs_inbox")
      .update({ review_status: "ready" })
      .in("id", job_ids)
      .eq("review_status", "pending");

    if (updateErr) return error("Failed to move jobs to ready", 500);
    return json({ action, count: job_ids.length });
  }

  // --- BACK TO REVIEW ---
  if (action === "back_to_review") {
    const { error: updateErr } = await service
      .from("jobs_inbox")
      .update({ review_status: "pending" })
      .in("id", job_ids)
      .eq("review_status", "ready");

    if (updateErr) return error("Failed to move jobs back to review", 500);
    return json({ action, count: job_ids.length });
  }

  // --- REJECT ---
  if (action === "reject") {
    const { error: updateErr } = await service
      .from("jobs_inbox")
      .update({
        review_status: "rejected",
        reviewed_at: now,
        reviewed_by: profile.id,
      })
      .in("id", job_ids);

    if (updateErr) return error("Failed to reject jobs", 500);

    await logEvent("admin.review_reject", {
      userId: profile.id,
      success: true,
      metadata: { count: job_ids.length },
    });

    return json({ action, count: job_ids.length });
  }

  // --- APPROVE ---
  if (action === "approve") {
    // Fetch jobs being approved (must be in ready state with lane assigned)
    const { data: jobsToApprove, error: fetchErr } = await service
      .from("jobs_inbox")
      .select("*")
      .in("id", job_ids)
      .eq("review_status", "ready");

    if (fetchErr || !jobsToApprove) {
      return error("Failed to fetch jobs for approval", 500);
    }

    // Check all have lanes assigned
    const missingLane = jobsToApprove.filter((j) => !j.lane_key);
    if (missingLane.length > 0) {
      return error(`${missingLane.length} job(s) missing lane assignment. Assign lanes before approving.`, 400);
    }

    // Mark as approved
    const { error: updateErr } = await service
      .from("jobs_inbox")
      .update({
        review_status: "approved",
        reviewed_at: now,
        reviewed_by: profile.id,
        enrichment_status: "APPROVED",
      })
      .in("id", job_ids)
      .eq("review_status", "ready");

    if (updateErr) return error("Failed to approve jobs", 500);

    // Upsert into global_job_bank with per-job lane
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
            job_family: job.lane_key,
            description_snippet: job.notes || job.description_snippet,
          },
          { onConflict: "url" },
        );

      if (!upsertErr) bankInserted++;
    }

    // Trigger enrichment
    let enriched = 0;
    for (const job of jobsToApprove) {
      if (!job.url) continue;
      try {
        const summary = await enrichBankJob(
          { url: job.url, title: job.title, company: job.company, location: job.location, work_mode: job.work_mode, description_snippet: job.notes || job.description_snippet },
          service,
        );
        if (summary) {
          await service.from("global_job_bank").update({ job_summary: summary }).eq("url", job.url);
          enriched++;
        }
      } catch (err) {
        await logError(`Bank enrichment failed for ${job.url}: ${err instanceof Error ? err.message : "unknown"}`, {
          severity: "warning",
          sourceSystem: "enrich.bank",
          userId: profile.id,
        });
      }
    }

    await logEvent("admin.review_approve", {
      userId: profile.id,
      success: true,
      metadata: { count: jobsToApprove.length, bank_inserted: bankInserted, enriched },
    });

    return json({ action, count: jobsToApprove.length, bank_inserted: bankInserted, enriched });
  }

  return error("Unknown action", 400);
}
