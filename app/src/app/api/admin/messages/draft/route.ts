import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { buildMergeFields, resolveMergeFields, generateAiDraft } from "@/lib/merge-fields";

/**
 * POST /api/admin/messages/draft — Generate AI-assisted email draft
 *
 * Body: { client_id, template_id?, context?: string }
 * Returns: { subject, body, merge_fields }
 */
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  const { client_id, template_id, context } = body;

  if (!client_id) return error("client_id is required");

  const service = getServiceClient();

  const mergeFields = await buildMergeFields(client_id, service);

  let subject = "";
  let emailBody = "";
  let aiPromptHint = context || "";

  if (template_id) {
    const { data: template } = await service
      .from("message_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    if (template) {
      subject = resolveMergeFields(template.subject, mergeFields);
      emailBody = resolveMergeFields(template.body, mergeFields);
      aiPromptHint = template.ai_prompt_hint || aiPromptHint;
    }
  }

  if (aiPromptHint) {
    const aiContent = await generateAiDraft(mergeFields, aiPromptHint);
    if (aiContent) {
      emailBody = emailBody ? `${emailBody}\n\n${aiContent}` : aiContent;
    }
  }

  return json({ subject, body: emailBody, merge_fields: mergeFields });
}
