import { requireAuth, json, error, getServiceClient } from "@/lib/api-helpers";

/** GET /api/dashboard — get dashboard stats for the user */
export async function GET() {
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const [inboxCount, trackerEntries, recentAdds] = await Promise.all([
    supabase
      .from("inbox_jobs")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id),

    supabase
      .from("tracker_entries")
      .select("*")
      .eq("profile_id", profile.id),

    supabase
      .from("tracker_entries")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .gte("added_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // Count by status
  const statusCounts: Record<string, number> = {};
  if (trackerEntries.data) {
    for (const row of trackerEntries.data) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    }
  }

  const stats = {
    inbox_count: inboxCount.count ?? 0,
    tracker_total: trackerEntries.data?.length ?? 0,
    prospect: statusCounts["Prospect"] ?? 0,
    applied: statusCounts["Applied"] ?? 0,
    interview_1: statusCounts["Interview 1"] ?? 0,
    interview_2: statusCounts["Interview 2"] ?? 0,
    final: statusCounts["Final"] ?? 0,
    offer: statusCounts["Offer"] ?? 0,
    rejected: statusCounts["Rejected"] ?? 0,
    ghosted: statusCounts["Ghosted"] ?? 0,
    withdrawn: statusCounts["Withdrawn"] ?? 0,
    added_7d: recentAdds.count ?? 0,
  };

  // If admin, also get global stats
  if (profile.role === "admin") {
    const service = getServiceClient();
    const [profilesResult, errorsResult] = await Promise.all([
      service.from("profiles").select("*"),
      service
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false),
    ]);

    const profiles = profilesResult.data ?? [];

    return json({
      ...stats,
      admin: {
        total_profiles: profiles.length,
        active_profiles: profiles.filter((p) => p.status === "active").length,
        locked_profiles: profiles.filter((p) => p.status === "inactive_soft_locked").length,
        unresolved_errors: errorsResult.count ?? 0,
      },
    });
  }

  return json(stats);
}
