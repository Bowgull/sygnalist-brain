import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logError } from "@/lib/logger";

/**
 * GET /api/admin/messages/templates - List all message templates
 * POST /api/admin/messages/templates - Create a custom template
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();
  const { data, error: err } = await service
    .from("message_templates")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name");

  if (err) {
    logError(err.message, { severity: "warning", sourceSystem: "api.admin.messages.templates", stackTrace: err.message });
    return error(err.message, 500);
  }
  return json(data);
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  const { name, subject, body: templateBody, ai_prompt_hint, trigger_event } = body;

  if (!name || !subject || !templateBody) {
    return error("name, subject, and body are required");
  }

  const service = getServiceClient();
  const { data, error: err } = await service
    .from("message_templates")
    .insert({
      name,
      subject,
      body: templateBody,
      ai_prompt_hint: ai_prompt_hint || null,
      trigger_event: trigger_event || null,
      is_system: false,
    })
    .select()
    .single();

  if (err) {
    logError(err.message, { severity: "error", sourceSystem: "api.admin.messages.templates", stackTrace: err.message });
    return error(err.message, 500);
  }
  return json(data);
}
