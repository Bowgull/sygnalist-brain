import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/**
 * GET /api/admin/messages/conversations - List all conversations grouped by client
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();

  // Fetch sent + received messages
  const [sentRes, receivedRes] = await Promise.all([
    service
      .from("sent_messages")
      .select("id, client_id, recipient_email, subject, body, sent_at")
      .order("sent_at", { ascending: false }),
    service
      .from("received_messages")
      .select("id, client_id, from_email, from_name, subject, body_text, received_at, is_read")
      .order("received_at", { ascending: false }),
  ]);

  if (sentRes.error) return error(sentRes.error.message, 500);
  if (receivedRes.error) return error(receivedRes.error.message, 500);

  // Group by client_id, building a conversation summary per contact
  const convMap = new Map<
    string,
    {
      client_id: string | null;
      email: string;
      display_name: string | null;
      last_message_preview: string;
      last_message_at: string;
      last_direction: "sent" | "received";
      unread_count: number;
    }
  >();

  // Process sent messages
  for (const msg of sentRes.data ?? []) {
    const key = msg.client_id;
    if (!key) continue;
    const existing = convMap.get(key);
    if (!existing || new Date(msg.sent_at) > new Date(existing.last_message_at)) {
      convMap.set(key, {
        client_id: msg.client_id,
        email: msg.recipient_email || "",
        display_name: null,
        last_message_preview: (msg.body || "").slice(0, 100),
        last_message_at: msg.sent_at,
        last_direction: "sent",
        unread_count: existing?.unread_count ?? 0,
      });
    }
  }

  // Process received messages
  for (const msg of receivedRes.data ?? []) {
    const key = msg.client_id || msg.from_email;
    if (!key) continue;
    const existing = convMap.get(key);
    const unread = existing?.unread_count ?? 0;
    const newUnread = unread + (msg.is_read ? 0 : 1);

    if (!existing || new Date(msg.received_at) > new Date(existing.last_message_at)) {
      convMap.set(key, {
        client_id: msg.client_id,
        email: msg.from_email,
        display_name: msg.from_name,
        last_message_preview: (msg.body_text || msg.subject || "").slice(0, 100),
        last_message_at: msg.received_at,
        last_direction: "received",
        unread_count: newUnread,
      });
    } else if (existing) {
      existing.unread_count = newUnread;
    }
  }

  // Fetch client display names
  const clientIds = [...new Set([...convMap.values()].map((c) => c.client_id).filter(Boolean))] as string[];
  if (clientIds.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id, display_name, email")
      .in("id", clientIds);

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    for (const conv of convMap.values()) {
      if (conv.client_id && profileMap[conv.client_id]) {
        conv.display_name = profileMap[conv.client_id].display_name;
        if (!conv.email) conv.email = profileMap[conv.client_id].email || "";
      }
    }
  }

  // Sort by most recent
  const conversations = [...convMap.values()].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  );

  return json({ conversations });
}
