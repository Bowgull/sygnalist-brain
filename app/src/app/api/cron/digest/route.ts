import { NextRequest } from "next/server";
import { json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/digest — Weekly digest generator for all active profiles.
 *
 * Triggered by Vercel Cron (weekly). Generates digest data and queues
 * emails via the Message Hub system (Phase 12).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return error("Unauthorized", 401);
  }

  const service = getServiceClient();

  // Get all active profiles
  const { data: profiles } = await service
    .from("profiles")
    .select("id, profile_id, display_name, email")
    .eq("status", "active");

  if (!profiles || profiles.length === 0) {
    return json({ message: "No active profiles", digests: 0 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const results: Array<{ profile_id: string; stats: Record<string, number> }> = [];

  let failedCount = 0;

  for (const profile of profiles) {
    try {
      const { count: inboxCount } = await service
        .from("inbox_jobs")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .gte("added_at", weekAgo.toISOString());

      const { count: promotedCount } = await service
        .from("tracker_entries")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .gte("added_at", weekAgo.toISOString());

      const { count: appliedCount } = await service
        .from("tracker_entries")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("status", "applied")
        .gte("stage_changed_at", weekAgo.toISOString());

      const { count: interviewCount } = await service
        .from("tracker_entries")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .in("status", ["interview_1", "interview_2", "final_round"])
        .gte("stage_changed_at", weekAgo.toISOString());

      const stats = {
        jobs_fetched: inboxCount ?? 0,
        jobs_promoted: promotedCount ?? 0,
        new_applications: appliedCount ?? 0,
        new_interviews: interviewCount ?? 0,
      };

      results.push({ profile_id: profile.profile_id, stats });

      await logEvent("cron.digest_profile", {
        userId: profile.id,
        metadata: stats,
      });
    } catch (err) {
      failedCount++;
      const msg = err instanceof Error ? err.message : "Unknown error";
      await logError(`Digest failed for ${profile.display_name}: ${msg}`, {
        sourceSystem: "cron.digest",
        userId: profile.id,
      });
    }
  }

  await logEvent("cron.digest_completed", {
    metadata: {
      profiles_processed: profiles.length,
      profiles_failed: failedCount,
    },
  });

  return json({
    message: `Generated digests for ${profiles.length} profiles`,
    results,
  });
}
