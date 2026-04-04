import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/**
 * GET /api/admin/ingest/receipts — Recent ingest and fetch run receipts.
 *
 * Pulls from user_events for gmail.ingest_completed and cron.fetch_completed events.
 * Returns structured receipts for persistent display on the ingest page.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();

  const { data: events, error: eventsErr } = await service
    .from("user_events")
    .select("event_type, metadata, created_at, success")
    .in("event_type", [
      "gmail.ingest_completed",
      "cron.fetch_completed",
      "admin.review_approve",
      "admin.review_reject",
    ])
    .order("created_at", { ascending: false })
    .limit(10);

  if (eventsErr) {
    return error("Failed to load receipts", 500);
  }

  // Also get review queue count for context
  const { count: pendingReview } = await service
    .from("jobs_inbox")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "pending");

  return json({
    receipts: (events ?? []).map((e: { event_type: string; metadata: unknown; success: boolean | null; created_at: string }) => ({
      type: e.event_type,
      metadata: e.metadata,
      success: e.success,
      created_at: e.created_at,
    })),
    pending_review: pendingReview ?? 0,
  });
}
