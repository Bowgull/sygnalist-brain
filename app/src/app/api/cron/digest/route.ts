import { NextRequest } from "next/server";
import { json, error, getServiceClient } from "@/lib/api-helpers";

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

  for (const profile of profiles) {
    // Gather weekly stats
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

    // Log digest event (Phase 12 will use this to trigger email)
    await service.from("user_events").insert({
      user_id: profile.id,
      event_type: "weekly_digest",
      metadata: stats,
    });
  }

  return json({
    message: `Generated digests for ${profiles.length} profiles`,
    results,
  });
}
