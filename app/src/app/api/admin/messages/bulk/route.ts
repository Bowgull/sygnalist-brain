import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { sendEmail } from "@/lib/email";
import { buildMergeFields, resolveMergeFields } from "@/lib/merge-fields";
import { logEvent, logError } from "@/lib/logger";

/**
 * POST /api/admin/messages/bulk - Send template-based email to multiple recipients
 *
 * Body: {
 *   recipients: Array<{ client_id: string }>,
 *   template_id: string,
 *   trigger_event?: string,
 *   suggestion_ids?: string[]
 * }
 */
export async function POST(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { recipients, template_id, trigger_event, suggestion_ids } = body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return error("recipients array is required");
  }
  if (!template_id) return error("template_id is required for bulk send");

  const service = getServiceClient();

  // Fetch template
  const { data: template } = await service
    .from("message_templates")
    .select("*")
    .eq("id", template_id)
    .single();

  if (!template) return error("Template not found", 404);

  const origin = new URL(request.url).origin;
  const results: Array<{ client_id: string; success: boolean; error?: string }> = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    const { client_id } = recipient;

    try {
      // Get client
      const { data: client } = await service
        .from("profiles")
        .select("id, email, display_name")
        .eq("id", client_id)
        .single();

      if (!client || !client.email) {
        results.push({ client_id, success: false, error: "Client not found or has no email" });
        failedCount++;
        continue;
      }

      // Resolve merge fields for this client - no AI, template is the message
      const mergeFields = await buildMergeFields(client_id, service, { origin });
      const subject = resolveMergeFields(template.subject, mergeFields);
      const emailBody = resolveMergeFields(template.body, mergeFields);

      // Send
      const result = await sendEmail(client.email, subject, emailBody);

      if (!result.success) {
        await logError(result.error ?? "Bulk email send failed", {
          severity: "warning",
          sourceSystem: "smtp.bulk_send",
          userId: profile.id,
          metadata: { client_id, subject },
        });
      }

      // Always save
      await service.from("sent_messages").insert({
        coach_id: profile.id,
        client_id,
        template_id,
        subject,
        body: emailBody,
        trigger_event: trigger_event || "bulk",
        smtp_message_id: result.messageId || null,
        recipient_email: client.email,
      });

      // Log to email_logs
      try {
        await service.from("email_logs").insert({
          recipient_email: client.email,
          recipient_id: client_id,
          email_type: "bulk_template",
          subject,
          success: result.success,
          error_message: result.error || null,
          template_id,
        });
      } catch {
        // email_logs insert must not break the loop
      }

      if (result.success) sentCount++;
      else failedCount++;

      results.push({ client_id, success: result.success, error: result.error });
    } catch (err) {
      failedCount++;
      results.push({
        client_id,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Mark outreach suggestions as sent
  if (suggestion_ids && Array.isArray(suggestion_ids) && suggestion_ids.length > 0) {
    await service
      .from("outreach_suggestions")
      .update({ status: "sent", resolved_at: new Date().toISOString() })
      .in("id", suggestion_ids);
  }

  await logEvent("message.bulk_sent", {
    userId: profile.id,
    metadata: { template_id, sent: sentCount, failed: failedCount, total: recipients.length },
  });

  return json({ sent: sentCount, failed: failedCount, results });
}
