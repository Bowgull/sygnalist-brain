import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * POST /api/admin/messages/draft — Generate AI-assisted email draft
 *
 * Body: { client_id, template_id?, context?: string }
 * Returns: { subject, body } with merge fields resolved and AI content generated
 */
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  const { client_id, template_id, context } = body;

  if (!client_id) return error("client_id is required");

  const service = getServiceClient();

  // Get client profile
  const { data: client } = await service
    .from("profiles")
    .select("*")
    .eq("id", client_id)
    .single();

  if (!client) return error("Client not found");

  // Get tracker stats for merge fields
  const { count: pipelineCount } = await service
    .from("tracker_entries")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", client_id);

  const { count: appliedCount } = await service
    .from("tracker_entries")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", client_id)
    .in("status", ["applied", "interview_1", "interview_2", "final_round", "offer"]);

  const { count: interviewCount } = await service
    .from("tracker_entries")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", client_id)
    .in("status", ["interview_1", "interview_2", "final_round"]);

  // Calculate days since last fetch
  const daysSinceLastFetch = client.last_fetch_at
    ? Math.floor((Date.now() - new Date(client.last_fetch_at).getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  const tracks = Array.isArray(client.role_tracks)
    ? (client.role_tracks as Array<{ label?: string }>).map((t) => t.label).filter(Boolean)
    : [];

  // Build merge field map
  const mergeFields: Record<string, string> = {
    "{clientName}": client.display_name || "there",
    "{clientEmail}": client.email || "",
    "{coachName}": "Josh",
    "{pipelineCount}": String(pipelineCount ?? 0),
    "{appliedCount}": String(appliedCount ?? 0),
    "{interviewCount}": String(interviewCount ?? 0),
    "{daysSinceLastFetch}": daysSinceLastFetch >= 0 ? String(daysSinceLastFetch) : "N/A",
    "{topSkills}": (client.top_skills ?? []).join(", ") || "Not specified",
    "{assignedLanes}": tracks.join(", ") || "Not assigned",
  };

  let subject = "";
  let emailBody = "";
  let aiPromptHint = context || "";

  // If template selected, start with template
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

  // Generate AI content if we have a key and a prompt hint
  if (OPENAI_KEY && aiPromptHint) {
    const aiContent = await generateAiDraft(client, mergeFields, aiPromptHint);
    if (aiContent) {
      // Append AI content to the body
      emailBody = emailBody
        ? `${emailBody}\n\n${aiContent}`
        : aiContent;
    }
  }

  return json({
    subject,
    body: emailBody,
    merge_fields: mergeFields,
  });
}

function resolveMergeFields(text: string, fields: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(fields)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

async function generateAiDraft(
  client: Record<string, unknown>,
  mergeFields: Record<string, string>,
  promptHint: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a job-hunt coach named Josh writing an email to a client. Be warm, direct, and encouraging. No corporate-speak. Use their name. Keep it under 200 words.

Client info:
- Name: ${mergeFields["{clientName}"]}
- Target roles: ${mergeFields["{assignedLanes}"]}
- Top skills: ${mergeFields["{topSkills}"]}
- Pipeline: ${mergeFields["{pipelineCount}"]} jobs tracked, ${mergeFields["{appliedCount}"]} applied, ${mergeFields["{interviewCount}"]} interviewing
- Days since last scan: ${mergeFields["{daysSinceLastFetch}"]}`,
          },
          {
            role: "user",
            content: promptHint,
          },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
