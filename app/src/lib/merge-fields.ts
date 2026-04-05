import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Build the merge field map for a given client.
 * Fetches profile + tracker counts from the database.
 */
export async function buildMergeFields(
  clientId: string,
  service: SupabaseClient,
): Promise<Record<string, string>> {
  const { data: client } = await service
    .from("profiles")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!client) {
    return { "{clientName}": "there", "{clientEmail}": "", "{coachName}": "Josh" };
  }

  const { count: pipelineCount } = await service
    .from("tracker_entries")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", clientId);

  const { count: appliedCount } = await service
    .from("tracker_entries")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", clientId)
    .in("status", ["applied", "interview_1", "interview_2", "final_round", "offer"]);

  const { count: interviewCount } = await service
    .from("tracker_entries")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", clientId)
    .in("status", ["interview_1", "interview_2", "final_round"]);

  const daysSinceLastFetch = client.last_fetch_at
    ? Math.floor((Date.now() - new Date(client.last_fetch_at).getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  const tracks = Array.isArray(client.role_tracks)
    ? (client.role_tracks as Array<{ label?: string }>).map((t) => t.label).filter(Boolean)
    : [];

  return {
    "{clientName}": client.display_name || "there",
    "{clientEmail}": client.email || "",
    "{coachName}": "Josh",
    "{pipelineCount}": String(pipelineCount ?? 0),
    "{appliedCount}": String(appliedCount ?? 0),
    "{interviewCount}": String(interviewCount ?? 0),
    "{daysSinceLastFetch}": daysSinceLastFetch >= 0 ? String(daysSinceLastFetch) : "a while",
    "{topSkills}": (client.top_skills ?? []).join(", ") || "your strengths",
    "{assignedLanes}": tracks.join(", ") || "your target roles",
  };
}

/**
 * Replace all merge field tokens in a string.
 */
export function resolveMergeFields(text: string, fields: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(fields)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

/**
 * Refine a user-written email to match the Sygnalist/GoodFit voice.
 * Optionally includes thread context so the AI understands the conversation.
 */
export async function refineWithAi(
  mergeFields: Record<string, string>,
  userContent: string,
  threadContext?: string,
): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || !userContent) return null;

  const threadSection = threadContext
    ? `\n\nConversation so far (for context - do NOT repeat this, just use it to inform your tone and content):\n${threadContext}`
    : "";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an editor refining an email reply written by a job-hunt coach named Josh. Your job is to take the draft below and improve it to match this voice:

Voice rules:
- Warm, direct, encouraging. Never corporate or generic.
- Short sentences. Conversational. Like texting a friend who you also coach.
- Use the client's first name naturally.
- No "I hope this email finds you well" or similar filler.
- Sign off as "Josh" - no "Best regards" or "Take care".
- Keep it concise. Under 150 words.
- If replying to something the client said, acknowledge it naturally.

Client context:
- Name: ${mergeFields["{clientName}"]}
- Target roles: ${mergeFields["{assignedLanes}"]}
- Pipeline: ${mergeFields["{pipelineCount}"]} tracked, ${mergeFields["{appliedCount}"]} applied, ${mergeFields["{interviewCount}"]} interviewing${threadSection}

Return ONLY the refined email body. No subject line. No preamble. Just the email text.`,
          },
          {
            role: "user",
            content: `Here is the draft to refine:\n\n${userContent}`,
          },
        ],
        temperature: 0.4,
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
