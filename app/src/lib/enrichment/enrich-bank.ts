import type { Database, Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const CACHE_TTL_DAYS = 7;

interface BankJob {
  url: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  work_mode: string | null;
  description_snippet?: string | null;
}

/**
 * Enrich a bank-level job with a summary (no profile-specific why_fit).
 * Uses the same enrichment_cache as the profile pipeline.
 * Returns the job_summary string or null on failure.
 */
export async function enrichBankJob(
  job: BankJob,
  service: SupabaseClient<Database>,
): Promise<string | null> {
  if (!OPENAI_KEY) return null;

  // Check cache first
  if (job.url) {
    const { data: cached } = await service
      .from("enrichment_cache")
      .select("job_summary")
      .eq("url", job.url)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached?.job_summary) {
      return cached.job_summary;
    }
  }

  const prompt = buildBankPrompt(job);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(content);
    if (!parsed) return null;

    const summary = sanitize(parsed);

    // Cache result
    if (job.url) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

      await service.from("enrichment_cache").upsert(
        {
          url: job.url,
          job_summary: summary,
          raw_response: { source: "bank_enrich" } as unknown as Json,
          model: "gpt-4o-mini",
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "url" },
      );
    }

    return summary;
  } catch {
    return null;
  }
}

function buildBankPrompt(job: BankJob): string {
  const desc = (job.description_snippet ?? "").slice(0, 1500);

  return `You are writing a brief job summary for a job bank entry.
Return ONLY valid JSON. No markdown. No commentary.

OUTPUT JSON schema:
{
  "jobSummary": "3-5 lines max. What the role is, what it involves, key requirements. Plain language. No hype."
}

TONE: Sharp, factual, no HR sludge. Short sentences. Plain verbs.

Job:
- Company: ${job.company ?? "Unknown"}
- Title: ${job.title ?? "Unknown"}
- Location: ${job.location ?? "N/A"}
- Work Mode: ${job.work_mode ?? "N/A"}

${desc ? `Description:\n"""${desc}"""` : "(No description available.)"}`;
}

function safeParseJson(txt: string): string | null {
  try {
    const obj = JSON.parse(txt);
    let summary = String(obj.jobSummary || "").trim();
    const lines = summary.split("\n");
    if (lines.length > 5) summary = lines.slice(0, 5).join("\n").trim();
    if (summary.length > 520) summary = summary.slice(0, 517) + "...";
    return summary || null;
  } catch {
    return null;
  }
}

function sanitize(text: string): string {
  const banned = [
    "we're excited", "we are excited", "rockstar", "ninja", "self-starter",
    "dynamic", "fast paced", "passionate", "self starter",
    "This is a great opportunity", "This position offers",
  ];
  let out = text.replace(/[\u2014\u2013\u2012]/g, " ");
  for (const phrase of banned) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}
