import { requireAdmin, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { logEvent } from "@/lib/logger";
import type { Json } from "@/types/database";

/** POST /api/tickets/merge - merge source ticket into target ticket */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { response, profile } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { sourceId, targetId } = body;

  if (!sourceId || !targetId) return error("sourceId and targetId are required", 400);
  if (sourceId === targetId) return error("Cannot merge a ticket into itself", 400);

  const service = getServiceClient();

  // Fetch both tickets
  const [sourceRes, targetRes] = await Promise.all([
    service.from("tickets").select("*").eq("id", sourceId).single(),
    service.from("tickets").select("*").eq("id", targetId).single(),
  ]);

  if (!sourceRes.data) return error("Source ticket not found", 404);
  if (!targetRes.data) return error("Target ticket not found", 404);

  const sourceTicket = sourceRes.data;
  const targetTicket = targetRes.data;

  // Move all linked events and errors from source to target
  await Promise.all([
    service.from("user_events").update({ ticket_id: targetId }).eq("ticket_id", sourceId),
    service.from("error_logs").update({ ticket_id: targetId }).eq("ticket_id", sourceId),
  ]);

  // Concatenate notes
  const sourceNotes = Array.isArray(sourceTicket.notes) ? sourceTicket.notes : [];
  const targetNotes = Array.isArray(targetTicket.notes) ? targetTicket.notes : [];
  const mergeNote = {
    id: crypto.randomUUID(),
    text: `Merged from ticket: ${sourceTicket.title}`,
    timestamp: new Date().toISOString(),
  };
  const combinedNotes = [...targetNotes, mergeNote, ...sourceNotes] as Json;

  // Update target with combined notes and source message if target has none
  const updates: Record<string, unknown> = {
    notes: combinedNotes,
    updated_at: new Date().toISOString(),
  };
  if (!targetTicket.message && sourceTicket.message) {
    updates.message = sourceTicket.message;
  }

  await service.from("tickets").update(updates).eq("id", targetId);

  // Delete source ticket
  await service.from("tickets").delete().eq("id", sourceId);

  logEvent("ticket.merged", {
    userId: profile.id,
    requestId,
    metadata: { source_ticket_id: sourceId, target_ticket_id: targetId },
  });

  return json({ ok: true, merged_into: targetId });
}
