import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent } from "@/lib/logger";

/**
 * POST /api/admin/messages/suggestions/generate - Scan for trigger conditions and create suggestions
 */
export async function POST() {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const service = getServiceClient();

  // Load templates by trigger_event for matching
  const { data: templates } = await service
    .from("message_templates")
    .select("id, trigger_event")
    .not("trigger_event", "is", null);

  const templateByTrigger: Record<string, string> = {};
  for (const t of templates ?? []) {
    if (t.trigger_event) templateByTrigger[t.trigger_event] = t.id;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

  interface NewSuggestion {
    client_id: string;
    trigger_event: string;
    template_id: string | null;
    tracker_entry_id: string | null;
    context_snapshot: Record<string, unknown>;
  }

  const suggestions: NewSuggestion[] = [];

  // 1. Interview reached - tracker entries at Interview 1/2/Final, changed within 30 days
  const { data: interviews } = await service
    .from("tracker_entries")
    .select("id, profile_id, company, title, status, stage_changed_at")
    .in("status", ["Interview 1", "Interview 2", "Final"])
    .gte("stage_changed_at", thirtyDaysAgo);

  for (const entry of interviews ?? []) {
    suggestions.push({
      client_id: entry.profile_id,
      trigger_event: "interview_reached",
      template_id: templateByTrigger["interview_reached"] || null,
      tracker_entry_id: entry.id,
      context_snapshot: { company: entry.company, title: entry.title, status: entry.status },
    });
  }

  // 2. Offer reached - tracker entries at Offer, changed within 30 days
  const { data: offers } = await service
    .from("tracker_entries")
    .select("id, profile_id, company, title, stage_changed_at")
    .eq("status", "Offer")
    .gte("stage_changed_at", thirtyDaysAgo);

  for (const entry of offers ?? []) {
    suggestions.push({
      client_id: entry.profile_id,
      trigger_event: "offer_reached",
      template_id: templateByTrigger["offer_reached"] || null,
      tracker_entry_id: entry.id,
      context_snapshot: { company: entry.company, title: entry.title },
    });
  }

  // 3. Inactive check-in - active clients with no activity for 7+ days
  const { data: inactive } = await service
    .from("profiles")
    .select("id, display_name, last_fetch_at")
    .eq("role", "client")
    .eq("status", "active")
    .or(`last_fetch_at.lt.${sevenDaysAgo},last_fetch_at.is.null`);

  for (const client of inactive ?? []) {
    const daysSince = client.last_fetch_at
      ? Math.floor((Date.now() - new Date(client.last_fetch_at).getTime()) / 86400000)
      : -1;
    suggestions.push({
      client_id: client.id,
      trigger_event: "inactive_checkin",
      template_id: templateByTrigger["inactive_checkin"] || null,
      tracker_entry_id: null,
      context_snapshot: { days_inactive: daysSince >= 0 ? daysSince : "never" },
    });
  }

  // 4. Welcome - profiles created within last 48 hours
  const { data: newClients } = await service
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("role", "client")
    .gte("created_at", twoDaysAgo);

  for (const client of newClients ?? []) {
    suggestions.push({
      client_id: client.id,
      trigger_event: "welcome",
      template_id: templateByTrigger["welcome"] || null,
      tracker_entry_id: null,
      context_snapshot: { onboarded_at: client.created_at },
    });
  }

  // Insert suggestions, relying on partial unique index for dedup
  let generated = 0;
  const byTrigger: Record<string, number> = {};

  for (const s of suggestions) {
    const { error: insertErr } = await service
      .from("outreach_suggestions")
      .insert({
        client_id: s.client_id,
        trigger_event: s.trigger_event,
        template_id: s.template_id,
        tracker_entry_id: s.tracker_entry_id,
        context_snapshot: s.context_snapshot as import("@/types/database").Json,
      });

    // If the unique index rejects it (duplicate pending), that's expected - skip silently
    if (!insertErr) {
      generated++;
      byTrigger[s.trigger_event] = (byTrigger[s.trigger_event] || 0) + 1;
    }
  }

  await logEvent("outreach.suggestions_generated", {
    userId: profile.id,
    metadata: { generated, by_trigger: byTrigger, scanned: suggestions.length },
  });

  return json({ generated, by_trigger: byTrigger });
}
