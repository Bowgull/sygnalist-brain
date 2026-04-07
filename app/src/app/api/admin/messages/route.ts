import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { sendEmail } from "@/lib/email";
import { logEvent, logError } from "@/lib/logger";
import { buildMergeFields, resolveMergeFields } from "@/lib/merge-fields";

/**
 * GET /api/admin/messages - List sent messages with optional client filter
 * POST /api/admin/messages - Send an email to a client
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
  if (err) {
    logError(err.message, { severity: "warning", sourceSystem: "api.admin.messages", stackTrace: err.message });
    return error(err.message, 500);
  }

  return json(data);
}

export async function POST(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { client_id, template_id, subject, body: emailBody, tracker_entry_id, in_reply_to } = body;

  if (!client_id || !subject || !emailBody) {
    return error(`Missing fields: ${!client_id ? "client_id " : ""}${!subject ? "subject " : ""}${!emailBody ? "body" : ""}`);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(client_id)) {
    return error(`Invalid client_id format: "${client_id}" - expected UUID`);
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

  // Resolve merge fields before sending
  const origin = new URL(request.url).origin;
  const mergeFields = await buildMergeFields(client_id, service, { origin });
  const resolvedSubject = resolveMergeFields(subject, mergeFields);
  const resolvedBody = resolveMergeFields(emailBody, mergeFields);

  // Build threading headers for replies
  let emailOptions: Parameters<typeof sendEmail>[3] | undefined;
  if (in_reply_to) {
    // Collect all message IDs for this client to build References chain
    const [sentMsgs, receivedMsgs] = await Promise.all([
      service
        .from("sent_messages")
        .select("smtp_message_id")
        .eq("client_id", client_id)
        .not("smtp_message_id", "is", null)
        .order("sent_at", { ascending: true }),
      service
        .from("received_messages")
        .select("gmail_message_id")
        .eq("client_id", client_id)
        .not("gmail_message_id", "is", null)
        .order("received_at", { ascending: true }),
    ]);

    const refs: string[] = [];
    for (const m of sentMsgs.data ?? []) {
      if (m.smtp_message_id) refs.push(m.smtp_message_id);
    }
    for (const m of receivedMsgs.data ?? []) {
      if (m.gmail_message_id) refs.push(m.gmail_message_id);
    }

    emailOptions = {
      inReplyTo: in_reply_to,
      references: refs.length > 0 ? refs : undefined,
    };
  }

  // Send via Gmail SMTP
  const result = await sendEmail(client.email, resolvedSubject, resolvedBody, emailOptions);

  if (!result.success) {
    await logError(result.error ?? "Email send failed", {
      severity: "error",
      sourceSystem: "smtp.send",
      userId: profile.id,
      metadata: { client_id, subject },
    });
  }

  // Always save the message (even if email delivery failed)
  const validTemplateId = template_id && uuidRegex.test(template_id) ? template_id : null;
  const validTrackerId = tracker_entry_id && uuidRegex.test(tracker_entry_id) ? tracker_entry_id : null;

  const { data: msg, error: insertErr } = await service
    .from("sent_messages")
    .insert({
      coach_id: profile.id,
      client_id,
      template_id: validTemplateId,
      subject: resolvedSubject,
      body: resolvedBody,
      trigger_event: validTrackerId ? "manual_with_tracker" : "manual",
      tracker_entry_id: validTrackerId,
      smtp_message_id: result.messageId || null,
      recipient_email: client.email,
    })
    .select()
    .single();

  if (insertErr) {
    logError(`Save failed: ${insertErr.message}`, { severity: "error", sourceSystem: "api.admin.messages", stackTrace: insertErr.message });
    return error(`Save failed: ${insertErr.message}`, 500);
  }

  // Log to email_logs
  try {
    await service.from("email_logs").insert({
      recipient_email: client.email,
      recipient_id: client_id,
      email_type: validTemplateId ? "template" : "manual",
      subject,
      success: result.success,
      error_message: result.error || null,
      template_id: validTemplateId,
    });
  } catch {
    // email_logs insert must not break the response
  }

  if (result.success) {
    await logEvent("message.sent", {
      userId: profile.id,
      metadata: { client_id, template_id: validTemplateId, message_id: msg.id },
    });
  }

  return json({
    sent: result.success,
    saved: true,
    error: result.error || null,
    message_id: result.messageId || null,
    message: msg,
  });
}
