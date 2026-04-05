import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

/**
 * GET /api/admin/messages/conversations/[clientId] - Full thread for a client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { clientId } = await params;
  if (!clientId) return error("clientId is required");

  const service = getServiceClient();

  // Fetch sent + received messages for this client
  const [sentRes, receivedRes] = await Promise.all([
    service
      .from("sent_messages")
      .select("id, subject, body, sent_at, smtp_message_id, gmail_thread_id, template_id")
      .eq("client_id", clientId)
      .order("sent_at", { ascending: true }),
    service
      .from("received_messages")
      .select("id, subject, body_text, body_html, received_at, gmail_thread_id, from_name, from_email, is_read")
      .eq("client_id", clientId)
      .order("received_at", { ascending: true }),
  ]);

  if (sentRes.error) return error(sentRes.error.message, 500);
  if (receivedRes.error) return error(receivedRes.error.message, 500);

  // Mark unread received messages as read
  const unreadIds = (receivedRes.data ?? []).filter((m) => !m.is_read).map((m) => m.id);
  if (unreadIds.length > 0) {
    await service
      .from("received_messages")
      .update({ is_read: true })
      .in("id", unreadIds);
  }

  // Merge into chronological thread
  type ThreadMessage = {
    id: string;
    direction: "sent" | "received";
    subject: string | null;
    body: string;
    timestamp: string;
    gmail_thread_id: string | null;
  };

  const messages: ThreadMessage[] = [];

  for (const msg of sentRes.data ?? []) {
    messages.push({
      id: msg.id,
      direction: "sent",
      subject: msg.subject,
      body: msg.body,
      timestamp: msg.sent_at,
      gmail_thread_id: msg.gmail_thread_id,
    });
  }

  for (const msg of receivedRes.data ?? []) {
    messages.push({
      id: msg.id,
      direction: "received",
      subject: msg.subject,
      body: msg.body_text || msg.body_html || "",
      timestamp: msg.received_at,
      gmail_thread_id: msg.gmail_thread_id,
    });
  }

  messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Get client info
  const { data: client } = await service
    .from("profiles")
    .select("id, display_name, email")
    .eq("id", clientId)
    .single();

  return json({
    client: client || { id: clientId, display_name: null, email: null },
    messages,
    marked_read: unreadIds.length,
  });
}
