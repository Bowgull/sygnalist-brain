import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logError } from "@/lib/logger";

/**
 * GET  /api/admin/messages/suggestions — List pending outreach suggestions
 * PATCH /api/admin/messages/suggestions — Dismiss a suggestion
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();

  // Fetch pending suggestions with joined data
  const { data: suggestions, error: err } = await service
    .from("outreach_suggestions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (err) {
    logError(err.message, { severity: "warning", sourceSystem: "api.admin.messages.suggestions", stackTrace: err.message });
    return error(err.message, 500);
  }

  // Enrich with client + template + tracker data
  const clientIds = [...new Set((suggestions ?? []).map((s) => s.client_id))];
  const templateIds = [...new Set((suggestions ?? []).map((s) => s.template_id).filter((id): id is string => id != null))];
  const trackerIds = [...new Set((suggestions ?? []).map((s) => s.tracker_entry_id).filter((id): id is string => id != null))];

  const [clientsRes, templatesRes, trackersRes] = await Promise.all([
    clientIds.length > 0
      ? service.from("profiles").select("id, display_name, email").in("id", clientIds)
      : { data: [] },
    templateIds.length > 0
      ? service.from("message_templates").select("id, name, subject, trigger_event").in("id", templateIds)
      : { data: [] },
    trackerIds.length > 0
      ? service.from("tracker_entries").select("id, company, title, status").in("id", trackerIds)
      : { data: [] },
  ]);

  const clientMap = Object.fromEntries((clientsRes.data ?? []).map((c) => [c.id, c]));
  const templateMap = Object.fromEntries((templatesRes.data ?? []).map((t) => [t.id, t]));
  const trackerMap = Object.fromEntries((trackersRes.data ?? []).map((t) => [t.id, t]));

  const enriched = (suggestions ?? []).map((s) => ({
    ...s,
    client: clientMap[s.client_id] || null,
    template: s.template_id ? templateMap[s.template_id] || null : null,
    tracker_entry: s.tracker_entry_id ? trackerMap[s.tracker_entry_id] || null : null,
  }));

  return json(enriched);
}

export async function PATCH(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  const { id, status } = body;

  if (!id) return error("id is required");
  if (status !== "dismissed" && status !== "sent") {
    return error("status must be 'dismissed' or 'sent'");
  }

  const service = getServiceClient();

  const { error: err } = await service
    .from("outreach_suggestions")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id);

  if (err) {
    logError(err.message, { severity: "error", sourceSystem: "api.admin.messages.suggestions", stackTrace: err.message });
    return error(err.message, 500);
  }

  return json({ ok: true });
}
