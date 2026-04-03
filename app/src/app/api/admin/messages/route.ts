import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { sendEmail } from "@/lib/email";

/**
 * GET /api/admin/messages — List sent messages with optional client filter
 * POST /api/admin/messages — Send an email to a client
 */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");

  let query = service
    .from("sent_messages")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(50);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error: err } = await query;
  if (err) return error(err.message, 500);

  return json(data);
}

export async function POST(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { client_id, template_id, subject, body: emailBody, tracker_entry_id } = body;

  if (!client_id || !subject || !emailBody) {
    return error("client_id, subject, and body are required");
  }

  const service = getServiceClient();

  // Get client info
  const { data: client } = await service
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", client_id)
    .single();

  if (!client || !client.email) {
    return error("Client not found or has no email");
  }

  // Send via Gmail SMTP
  const result = await sendEmail(client.email, subject, emailBody);

  // Always save the message (even if email delivery failed)
  const { data: msg, error: insertErr } = await service
    .from("sent_messages")
    .insert({
      coach_id: profile.id,
      client_id,
      template_id: template_id || null,
      subject,
      body: emailBody,
      trigger_event: tracker_entry_id ? "manual_with_tracker" : "manual",
      tracker_entry_id: tracker_entry_id || null,
    })
    .select()
    .single();

  if (insertErr) return error(insertErr.message, 500);

  // Log to email_logs
  await service.from("email_logs").insert({
    recipient_email: client.email,
    recipient_id: client_id,
    email_type: template_id ? "template" : "manual",
    subject,
    success: result.success,
    error_message: result.error || null,
    template_id: template_id || null,
  });

  return json({
    sent: result.success,
    saved: true,
    error: result.error || null,
    message_id: result.messageId || null,
    message: msg,
  });
}
