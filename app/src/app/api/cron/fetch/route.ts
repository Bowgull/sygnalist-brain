import { NextRequest } from "next/server";
import { json, error, getServiceClient } from "@/lib/api-helpers";
import { runFetchPipeline } from "@/lib/sources/orchestrator";
import { logEvent, logError } from "@/lib/logger";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/fetch — Scheduled job fetch for all active profiles.
 *
 * Triggered by Vercel Cron. Requires CRON_SECRET authorization header.
 * Runs the fetch pipeline for each active profile sequentially.
 */
export async function GET(request: NextRequest) {
  // Verify cron authorization
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return error("Unauthorized", 401);
  }

  const service = getServiceClient();
  const results: Array<{ profile_id: string; name: string; jobs: number; error?: string }> = [];

  // Get all active profiles
  const { data: profiles } = await service
    .from("profiles")
    .select("*")
    .eq("status", "active");

  if (!profiles || profiles.length === 0) {
    return json({ message: "No active profiles", results: [] });
  }

  // Run fetch for each profile sequentially (to avoid rate-limiting APIs)
  for (const profile of profiles) {
    try {
      const result = await runFetchPipeline(profile, service);
      results.push({
        profile_id: profile.profile_id,
        name: profile.display_name,
        jobs: result.jobsDelivered,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push({
        profile_id: profile.profile_id,
        name: profile.display_name,
        jobs: 0,
        error: msg,
      });

      await logError(`Cron fetch failed for ${profile.display_name}: ${msg}`, {
        sourceSystem: "cron.fetch",
        userId: profile.id,
        metadata: { profile_id: profile.profile_id },
      });
    }
  }

  const totalJobs = results.reduce((sum, r) => sum + r.jobs, 0);
  const failedCount = results.filter((r) => r.error).length;

  await logEvent("cron.fetch_completed", {
    metadata: {
      profiles_processed: profiles.length,
      profiles_failed: failedCount,
      total_jobs: totalJobs,
    },
  });

  return json({
    message: `Fetched for ${profiles.length} profiles`,
    results,
  });
}
