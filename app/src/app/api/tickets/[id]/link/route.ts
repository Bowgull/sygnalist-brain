import { requireAdmin, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { logEvent } from "@/lib/logger";

/** POST /api/tickets/:id/link - link events/errors to a ticket */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const { response, profile } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const service = getServiceClient();

  // Verify ticket exists
  const { data: ticket } = await service.from("tickets").select("id").eq("id", id).single();
  if (!ticket) return error("Ticket not found", 404);

  const body = await request.json();
  const { eventIds, errorIds } = body;

  let linkedEvents = 0;
  let linkedErrors = 0;

  if (eventIds?.length) {
    const { count } = await service
      .from("user_events")
      .update({ ticket_id: id })
      .in("id", eventIds)
      .select("id", { count: "exact", head: true });
    linkedEvents = count ?? 0;
  }

  if (errorIds?.length) {
    const { count } = await service
      .from("error_logs")
      .update({ ticket_id: id })
      .in("id", errorIds)
      .select("id", { count: "exact", head: true });
    linkedErrors = count ?? 0;
  }

  logEvent("ticket.items_linked", {
    userId: profile.id,
    requestId,
    metadata: { ticket_id: id, linked_events: linkedEvents, linked_errors: linkedErrors },
  });

  return json({ ok: true, linked_events: linkedEvents, linked_errors: linkedErrors });
}

/** DELETE /api/tickets/:id/link - unlink events/errors from a ticket */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const { response, profile } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const service = getServiceClient();
  const body = await request.json();
  const { eventIds, errorIds } = body;

  if (eventIds?.length) {
    await service.from("user_events").update({ ticket_id: null }).in("id", eventIds).eq("ticket_id", id);
  }
  if (errorIds?.length) {
    await service.from("error_logs").update({ ticket_id: null }).in("id", errorIds).eq("ticket_id", id);
  }

  logEvent("ticket.items_unlinked", {
    userId: profile.id,
    requestId,
    metadata: { ticket_id: id, unlinked_events: eventIds?.length ?? 0, unlinked_errors: errorIds?.length ?? 0 },
  });

  return json({ ok: true });
}
