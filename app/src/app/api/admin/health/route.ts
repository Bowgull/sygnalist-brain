import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/** GET /api/admin/health — system health check */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();
  const start = Date.now();

  // Test database connectivity
  const { error: dbError } = await service
    .from("profiles")
    .select("id", { head: true, count: "exact" });

  const dbLatency = Date.now() - start;

  if (dbError) {
    return json({
      status: "unhealthy",
      database: { connected: false, error: dbError.message },
      timestamp: new Date().toISOString(),
    });
  }

  return json({
    status: "healthy",
    database: { connected: true, latency_ms: dbLatency },
    timestamp: new Date().toISOString(),
  });
}
