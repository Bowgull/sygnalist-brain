import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { buildMergeFields, resolveMergeFields, refineWithAi } from "@/lib/merge-fields";

/**
 * POST /api/admin/messages/draft - Resolve template merge fields or refine custom content
 *
 * Body: { client_id, template_id?, refine_body?: string }
 *   - template_id: resolves merge fields in the template (no AI generation)
 *   - refine_body: user-written content to refine with AI to match Sygnalist voice
 *
 * Returns: { subject, body, merge_fields }
 */
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  const { client_id, template_id, refine_body, thread_context } = body;

  if (!client_id) return error("client_id is required");

  const service = getServiceClient();

  const mergeFields = await buildMergeFields(client_id, service);

  let subject = "";
  let emailBody = "";

  // If template selected, resolve merge fields only - no AI
  if (template_id) {
    const { data: template } = await service
      .from("message_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    if (template) {
      subject = resolveMergeFields(template.subject, mergeFields);
      emailBody = resolveMergeFields(template.body, mergeFields);
    }
  }

  // If user wants to refine custom content with AI (optionally with thread context)
  if (refine_body) {
    const refined = await refineWithAi(mergeFields, refine_body, thread_context);
    if (refined) {
      emailBody = refined;
    }
  }

  return json({ subject, body: emailBody, merge_fields: mergeFields });
}
