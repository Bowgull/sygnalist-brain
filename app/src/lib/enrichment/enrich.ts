import type { ScoredJob } from "@/lib/scoring/score";
import type { Database, Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const CACHE_TTL_DAYS = 7;
const MAX_DESC_CHARS = 2000;

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
    return jobs;
  }

  const enriched: EnrichedJob[] = [];
  let failedCount = 0;

  for (const job of jobs) {
    try {
      const result = await enrichOne(job, profile, service);
      enriched.push(result);
    } catch {
      failedCount++;
      enriched.push(job);
    }
  }

  if (failedCount > 0) {
    await logError(`Enrichment failed for ${failedCount}/${jobs.length} jobs`, {
      severity: "warning",
      sourceSystem: "openai.enrich",
      userId: profile.id,
      metadata: { failed_count: failedCount, total_count: jobs.length },
    });
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

  const prompt = buildEnrichmentPrompt(job, profile);

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
      max_tokens: 800,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) return job;

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  const parsed = safeParseEnrichmentJson(content);
  if (!parsed) return job;

  const sanitized = sanitizeEnrichmentVoice(parsed.jobSummary, parsed.whyFit);

  // Cache the result
  if (job.url) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    await service.from("enrichment_cache").upsert(
      {
        url: job.url,
        job_summary: sanitized.jobSummary,
        raw_response: { why_fit: sanitized.whyFit } as unknown as Json,
        model: "gpt-4o-mini",
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "url" },
    );
  }

  return {
    ...job,
    job_summary: sanitized.jobSummary,
    why_fit: sanitized.whyFit,
  };
}

/** Build the enrichment prompt - restored from original Blueprint voice */
function buildEnrichmentPrompt(job: ScoredJob, profile: Profile): string {
  const desc = (job.description_snippet ?? "").slice(0, MAX_DESC_CHARS);
  const skillProfileText = profile.skill_profile_text ?? "";
  const topSkills = profile.top_skills ?? [];
  const signatureStories = profile.signature_stories ?? [];
  const tracks = Array.isArray(profile.role_tracks)
    ? (profile.role_tracks as Array<{ label?: string }>).map((t) => t.label).filter(Boolean)
    : [];

  return `You are writing an Inbox card summary and "why you're a fit" for a job-search tool.
Return ONLY valid JSON. No markdown. No commentary. jobSummary must be at most 5 lines.

OUTPUT JSON schema:
{
  "jobSummary": "3-5 lines max. What the role is + what it likely entails. Plain language.",
  "whyFit": ["exactly 3 strings. Each string is one paragraph block (2-3 short sentences). No bullets, no numbering, no section labels, no headers, no em dashes, no emojis, no colon-led prefixes like Gap: or Plan:."]
}

whyFit structure (exactly 3 paragraph blocks; internal logic, invisible but required):
- Block 1 (Concrete match): Reference one specific fact from the candidate profile and one specific requirement from the job. Connect them plainly. No vague wording. No resume tone. Read like someone calmly observing a real match. Not praising. Not hyping.
- Block 2 (Clear gap or unknown): Identify a real gap, missing signal, or ambiguity. Do not fabricate missing skills. If no clear gap exists, state what is unclear in the job posting and why that uncertainty matters operationally. Calm tone. No drama.
- Block 3 (Realistic framing): Show how the candidate would speak to this in conversation. Mention what evidence they would point to. Mention how they would handle it early on. Not advice. Not coaching. Not encouragement. Just practical positioning.

TONE (non-negotiable):
- Sound like a sharp ops/account person thinking out loud next to the candidate. Not a resume writer, motivational coach, LinkedIn post, chatbot, polished essay, or corporate HR rep. Conversational but controlled.
- Short sentences. Most under 18 words. Use plain verbs: handled, ran, owned, fixed, tracked, escalated, coordinated. Avoid abstract nouns and complex dependent clauses. No academic or resume-summary tone.
- No motivational tone. No corporate tone. No resume summary language. Do not invent missing profile skills. If profile signal is missing, say it directly. If you cannot find a concrete profile fact, state "Profile signal missing on X" rather than fabricating alignment.

BANNED words and phrases (do not use, case-insensitive): aligns, alignment, demonstrates, suggests, indicates, highlights, showcases, leverages, utilizes, transferable, dynamic, fast paced, passionate, self starter, rockstar, great fit, perfect fit, ideal candidate, consider, you should, try to, make sure, ability to, open question, interview answer, your experience, we're excited, we are excited, don't worry, you're amazing, personal brand, 10x, dream role. No em dashes. No bullet symbols. No numbered lists. No filler like "This is a great opportunity", "This position offers", "You would be well suited".

Candidate Skill Profile:
${skillProfileText || "(No skill profile text provided yet.)"}

Top Skills:
${topSkills.length ? "- " + topSkills.join("\n- ") : "(None listed.)"}

Target Roles:
${tracks.length ? "- " + tracks.join("\n- ") : "(None listed.)"}

Signature Stories / Proof Points:
${signatureStories.length ? "- " + signatureStories.join("\n- ") : "(None listed.)"}

Job:
- Company: ${job.company}
- Title: ${job.title}
- Location: ${job.location ?? "N/A"}
- Salary: ${job.salary ?? "N/A"}
- Work Mode: ${job.work_mode ?? "N/A"}

Job Description (truncated):
"""${desc}"""`;
}

/** Parse enrichment JSON with validation */
function safeParseEnrichmentJson(
  txt: string,
): { jobSummary: string; whyFit: string[] } | null {
  try {
    const obj = JSON.parse(txt);

    let jobSummary = String(obj.jobSummary || "").trim();
    // Cap to 5 lines or ~520 chars
    const lines = jobSummary.split("\n");
    if (lines.length > 5) jobSummary = lines.slice(0, 5).join("\n").trim();
    if (jobSummary.length > 520) jobSummary = jobSummary.slice(0, 517) + "...";

    let whyFit: string[] = [];
    if (Array.isArray(obj.whyFit)) {
      whyFit = obj.whyFit
        .map((x: unknown) => String(x || "").trim())
        .filter(Boolean);
      if (whyFit.length > 3) whyFit = whyFit.slice(0, 3);
    } else if (typeof obj.whyFit === "string") {
      whyFit = obj.whyFit
        .split(/\n\s*\n/)
        .map((s: string) => s.replace(/^[-•]\s*/, "").trim())
        .filter(Boolean);
      if (whyFit.length > 3) whyFit = whyFit.slice(0, 3);
    }

    if (!jobSummary || whyFit.length !== 3) return null;
    return { jobSummary, whyFit };
  } catch {
    return null;
  }
}

/** Post-process to strip HR sludge / coachy / buzz phrases */
function sanitizeEnrichmentVoice(
  jobSummary: string,
  whyFitArray: string[],
): { jobSummary: string; whyFit: string } {
  const banned = [
    "we're excited", "we are excited", "dynamic fast-paced", "rockstar", "ninja", "self-starter",
    "you've got this", "don't worry", "you're amazing", "personal brand",
    "10x", "great fit", "perfect fit", "ideal candidate", "dream role",
    "aligns", "alignment", "demonstrates", "suggests", "indicates", "highlights", "showcases",
    "leverages", "utilizes", "transferable", "dynamic", "fast paced", "passionate", "self starter",
    "consider", "you should", "try to", "make sure", "ability to", "open question", "interview answer",
    "your experience", "This is a great opportunity", "This position offers", "You would be well suited",
  ];

  function stripBanned(text: string): string {
    if (!text) return text;
    let out = text.replace(/[\u2014\u2013\u2012]/g, " - "); // Strip em/en dashes
    for (const phrase of banned) {
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      out = out.replace(re, "");
    }
    return out.replace(/\s{2,}/g, " ").trim();
  }

  const summary = stripBanned(jobSummary);
  const blocks = whyFitArray.slice(0, 3).map(stripBanned);

  return {
    jobSummary: summary,
    whyFit: blocks.join("\n\n"),
  };
}
