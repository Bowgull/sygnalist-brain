import type { ScoredJob } from "@/lib/scoring/score";
import type { Database, Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const CACHE_TTL_DAYS = 7;

interface EnrichedJob extends ScoredJob {
  job_summary: string | null;
  why_fit: string | null;
}

/** Enrich scored jobs with AI-generated summaries and whyFit. Uses cache. */
export async function enrichJobs(
  jobs: ScoredJob[],
  profile: Profile,
  service: SupabaseClient<Database>,
): Promise<EnrichedJob[]> {
  if (!OPENAI_KEY || jobs.length === 0) {
    // Without an API key, return jobs without enrichment
    return jobs;
  }

  const enriched: EnrichedJob[] = [];

  for (const job of jobs) {
    try {
      const result = await enrichOne(job, profile, service);
      enriched.push(result);
    } catch {
      // If enrichment fails, keep the job without enrichment
      enriched.push(job);
    }
  }

  return enriched;
}

async function enrichOne(
  job: ScoredJob,
  profile: Profile,
  service: SupabaseClient<Database>,
): Promise<EnrichedJob> {
  if (!OPENAI_KEY) return job;

  // Check cache first
  if (job.url) {
    const { data: cached } = await service
      .from("enrichment_cache")
      .select("job_summary, raw_response")
      .eq("url", job.url)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached?.job_summary) {
      const raw = cached.raw_response as Record<string, string> | null;
      return {
        ...job,
        job_summary: cached.job_summary,
        why_fit: raw?.why_fit ?? null,
      };
    }
  }

  // Build prompt
  const prompt = buildEnrichmentPrompt(job, profile);

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
          content: SYSTEM_PROMPT,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    return job;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  // Parse response
  const parsed = parseEnrichmentResponse(content);

  // Cache the result
  if (job.url) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    await service.from("enrichment_cache").upsert(
      {
        url: job.url,
        job_summary: parsed.summary,
        raw_response: { why_fit: parsed.whyFit } as unknown as Json,
        model: "gpt-4o-mini",
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "url" },
    );
  }

  return {
    ...job,
    job_summary: parsed.summary,
    why_fit: parsed.whyFit,
  };
}

function buildEnrichmentPrompt(job: ScoredJob, profile: Profile): string {
  const topSkills = (profile.top_skills ?? []).join(", ");
  const tracks = Array.isArray(profile.role_tracks)
    ? (profile.role_tracks as Array<{ label?: string }>).map((t) => t.label).filter(Boolean).join(", ")
    : "";

  return `Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? "Not specified"}
Salary: ${job.salary ?? "Not specified"}
Work Mode: ${job.work_mode ?? "Not specified"}
Description Snippet: ${job.description_snippet ?? "No description available"}

Candidate Profile:
- Name: ${profile.display_name}
- Target Roles: ${tracks || "Not specified"}
- Top Skills: ${topSkills || "Not specified"}
- Location: ${profile.current_city || "Not specified"}

Write a JOB SUMMARY (2-3 sentences about the role, responsibilities, and what makes it notable) and a WHY FIT section (2-3 bullets on why this candidate should be interested, referencing their specific skills and target roles).

Format your response exactly as:
SUMMARY: <summary text>
WHY_FIT: <why fit text>`;
}

function parseEnrichmentResponse(content: string): { summary: string | null; whyFit: string | null } {
  const summaryMatch = content.match(/SUMMARY:\s*([\s\S]*?)(?=WHY_FIT:|$)/i);
  const whyFitMatch = content.match(/WHY_FIT:\s*([\s\S]*?)$/i);

  return {
    summary: summaryMatch?.[1]?.trim() || null,
    whyFit: whyFitMatch?.[1]?.trim() || null,
  };
}

const SYSTEM_PROMPT = `You are Sygnalist, an AI job-hunt coach. You write concise, direct job summaries and personalized fit assessments.

Voice rules:
- Be direct and conversational, not corporate
- Use "you" to address the candidate
- Focus on what matters: role scope, team, growth, and how it connects to their skills
- Never use: "exciting opportunity", "dynamic team", "fast-paced environment", "leverage your expertise", "passionate about"
- Never exaggerate or oversell — be honest about what you see in the listing
- Keep it tight — no filler, no fluff

Format:
SUMMARY: 2-3 sentences about the actual role
WHY_FIT: 2-3 bullet points connecting this job to the candidate's specific background`;
