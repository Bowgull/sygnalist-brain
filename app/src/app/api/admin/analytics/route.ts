import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/** GET /api/admin/analytics — get analytics data */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const profilesResult = await service.from("profiles").select("*");
  const trackerResult = await service.from("tracker_entries").select("*");

  const [fetchesWeek, fetchesMonth, errorsUnresolved, recentHealth] =
    await Promise.all([
      service
        .from("job_fetch_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      service
        .from("job_fetch_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthAgo),
      service
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false),
      service
        .from("system_health_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  // Pipeline distribution across all profiles
  const pipelineDistribution: Record<string, number> = {};
  if (trackerResult.data) {
    for (const entry of trackerResult.data) {
      pipelineDistribution[entry.status] =
        (pipelineDistribution[entry.status] || 0) + 1;
    }
  }

  const profiles = profilesResult.data ?? [];

  return json({
    profiles: {
      total: profiles.length,
      active_clients: profiles.filter((p) => p.status === "active" && p.role === "client").length,
      locked: profiles.filter((p) => p.status === "inactive_soft_locked").length,
      admins: profiles.filter((p) => p.role === "admin").length,
    },
    pipeline: pipelineDistribution,
    fetches: {
      week: fetchesWeek.count ?? 0,
      month: fetchesMonth.count ?? 0,
    },
    errors: {
      unresolved: errorsUnresolved.count ?? 0,
    },
    latest_health: recentHealth.data?.[0] ?? null,
  });
}
