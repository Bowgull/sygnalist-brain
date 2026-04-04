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
    "{daysSinceLastFetch}": daysSinceLastFetch >= 0 ? String(daysSinceLastFetch) : "N/A",
    "{topSkills}": (client.top_skills ?? []).join(", ") || "Not specified",
    "{assignedLanes}": tracks.join(", ") || "Not assigned",
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
 * Generate AI draft content using OpenAI.
 */
export async function generateAiDraft(
  mergeFields: Record<string, string>,
  promptHint: string,
): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || !promptHint) return null;

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
