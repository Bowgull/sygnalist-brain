import { requireAdmin, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { logEvent } from "@/lib/logger";
import type { Json } from "@/types/database";

/** GET /api/tickets/:id - single ticket with linked items (admin only) */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();

  const { data: ticket, error: fetchErr } = await service
    .from("tickets")
    .select("*, reporter:profiles!tickets_reporter_id_fkey(display_name, email)")
    .eq("id", id)
    .single();

  if (fetchErr || !ticket) return error("Ticket not found", 404);

  // Fetch linked events and errors in parallel
  const [eventsRes, errorsRes] = await Promise.all([
    service
      .from("user_events")
      .select("*, actor:profiles!user_events_user_id_fkey(display_name)")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    service
      .from("error_logs")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return json({
    ticket,
    linked_events: eventsRes.data ?? [],
    linked_errors: errorsRes.data ?? [],
  });
}

/** PATCH /api/tickets/:id - update ticket (admin only) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const { response, profile } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { status, priority, title, note } = body;

  const service = getServiceClient();

  // Fetch current ticket to detect status changes
  const { data: current } = await service.from("tickets").select("status, notes").eq("id", id).single();
  if (!current) return error("Ticket not found", 404);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (title !== undefined) updates.title = title;
  if (priority !== undefined) updates.priority = priority;

  if (status !== undefined && status !== current.status) {
    updates.status = status;
    if (status === "resolved") {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = profile.id;
    } else if (current.status === "resolved") {
      updates.resolved_at = null;
      updates.resolved_by = null;
    }
  }

  // Append note if provided
  if (note && typeof note === "string") {
    const existingNotes = Array.isArray(current.notes) ? current.notes : [];
    const newNote = {
      id: crypto.randomUUID(),
      text: note,
      timestamp: new Date().toISOString(),
    };
    updates.notes = [...existingNotes, newNote] as Json;
  }

  const { data: updated, error: updateErr } = await service
    .from("tickets")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) return error(updateErr.message, 500);

  logEvent("ticket.updated", {
    userId: profile.id,
    requestId,
    metadata: {
      ticket_id: id,
      changes: Object.keys(updates).filter((k) => k !== "updated_at"),
    },
  });

  return json(updated);
}

/** DELETE /api/tickets/:id - delete ticket (admin only) */
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

  // Unlink all events and errors
  await Promise.all([
    service.from("user_events").update({ ticket_id: null }).eq("ticket_id", id),
    service.from("error_logs").update({ ticket_id: null }).eq("ticket_id", id),
  ]);

  const { error: delErr } = await service.from("tickets").delete().eq("id", id);
  if (delErr) return error(delErr.message, 500);

  logEvent("ticket.deleted", { userId: profile.id, requestId, metadata: { ticket_id: id } });

  return json({ ok: true });
}
