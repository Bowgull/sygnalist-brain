import { requireAuth, json, error } from "@/lib/api-helpers";
import { logError } from "@/lib/logger";
import { sanitizeGoodFitVoice, parseGoodFitResponse } from "@/lib/text/sanitize-goodfit";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MAX_RETRIES = 3;

/** POST /api/tracker/:id/goodfit - generate or retrieve GoodFit assessment */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const { data: entry, error: fetchErr } = await supabase
    .from("tracker_entries")
    .select("*")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .single();

  if (fetchErr || !entry) {
    if (fetchErr) logError(fetchErr.message, { severity: "warning", sourceSystem: "api.tracker.goodfit", stackTrace: fetchErr.stack });
    return error("Entry not found", 404);
  }

  // Return existing if already generated
  if (entry.good_fit) {
    return json({ good_fit: entry.good_fit, cached: true });
  }

  // Try to get the full job description from global_job_bank (has description_snippet)
  let jobDescription: string | null = null;
  if (entry.url) {
    const { data: bankJob } = await supabase
      .from("global_job_bank")
      .select("description_snippet")
      .eq("url", entry.url)
      .limit(1)
      .maybeSingle();
    jobDescription = bankJob?.description_snippet ?? null;
  }

  if (!OPENAI_KEY) {
    return json({ good_fit: null, cached: false, message: "AI not configured" });
  }

  // Generate GoodFit assessment
  const topSkills = profile.top_skills ?? [];
  const signatureStories = profile.signature_stories ?? [];
  const skillProfileText = profile.skill_profile_text ?? "";

  const prompt = `You are writing a "Good Fit" note for a job-search tool. Return only the GoodFit content. No JSON, no markdown, no labels (no "Why you fit:" or similar).

FORMAT:
- Output exactly 3 paragraph blocks. No bullets, no numbering, no section labels, no headers, no em dashes, no emojis, no colon-led prefixes.
- Each block: 2-3 short sentences. Separate each block with a single blank line.

Structure (exactly 3 blocks):
- Block 1 (Concrete match): One specific fact from the candidate profile and one specific requirement from the job. Connect them plainly. Calm observation, not praise.
- Block 2 (Clear gap or unknown): A real gap, missing signal, or ambiguity. If no clear gap, state what is unclear in the posting and why it matters operationally. Do not fabricate missing skills.
- Block 3 (Realistic framing): How the candidate would speak to this in conversation; what evidence they would point to; how they would handle it early. Practical positioning only. Not advice, coaching, or encouragement.

TONE (non-negotiable):
- Sharp ops/account person thinking out loud next to the candidate. Not resume writer, motivational coach, LinkedIn post, chatbot, polished essay, or corporate HR. Short sentences (most under 18 words). Plain verbs: handled, ran, owned, fixed, tracked, escalated, coordinated. No motivational tone. No corporate tone. No resume summary language. Do not invent missing profile skills. If you cannot find a concrete profile fact, state "Profile signal missing on X" rather than fabricating alignment.

BANNED words and phrases (do not use): aligns, alignment, demonstrates, suggests, indicates, highlights, showcases, leverages, utilizes, transferable, dynamic, fast paced, passionate, self starter, rockstar, great fit, perfect fit, ideal candidate, consider, you should, try to, make sure, ability to, open question, interview answer, your experience, we're excited, don't worry, you're amazing, personal brand, 10x, dream role. No em dashes. No filler like "This is a great opportunity", "This position offers", "You would be well suited".

Candidate Skill Profile:
${skillProfileText || "(No skill profile text provided yet.)"}

Top Skills:
${topSkills.length ? topSkills.join(", ") : "(None listed.)"}

Signature Stories / Proof Points:
${signatureStories.length ? signatureStories.join("; ") : "(None listed.)"}

Job:
- Company: ${entry.company}
- Title: ${entry.title}
- Location: ${entry.location ?? "N/A"}
- Salary: ${entry.salary ?? "N/A"}

Job Description:
${jobDescription ?? "(Not available)"}

Job Summary:
${entry.job_summary ?? "(Not available)"}

WhyFit Context:
${entry.why_fit ?? "(Not available)"}

Output only the 3 paragraph blocks, each separated by a single blank line. Nothing else.`;

  // Retry loop with exponential backoff (ported from legacy)
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
              content: "You are a sharp ops/account person. Write GoodFit assessments in plain language. No corporate tone, no coaching tone, no resume summary style. Short sentences. Plain verbs.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        logError(`GoodFit API returned ${res.status}`, { severity: "warning", sourceSystem: "api.tracker.goodfit" });
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
        return json({ good_fit: null, cached: false, message: "AI generation failed" });
      }

      const data = await res.json();
      const rawFit = data.choices?.[0]?.message?.content ?? null;

      if (!rawFit) {
        logError("GoodFit response empty from AI", { severity: "warning", sourceSystem: "api.tracker.goodfit" });
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
        return json({ good_fit: null, cached: false, message: "AI returned empty response" });
      }

      // Sanitize banned phrases (legacy parity)
      const sanitized = sanitizeGoodFitVoice(rawFit);

      // Validate 3-block structure
      let goodFit: string;
      try {
        goodFit = parseGoodFitResponse(sanitized);
      } catch (parseErr) {
        logError(parseErr instanceof Error ? parseErr.message : "GoodFit parse failed", { severity: "warning", sourceSystem: "api.tracker.goodfit" });
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
        // Fallback: use sanitized text even if not exactly 3 blocks
        goodFit = sanitized;
      }

      // Save to tracker entry
      await supabase
        .from("tracker_entries")
        .update({
          good_fit: goodFit,
          good_fit_updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return json({ good_fit: goodFit, cached: false });
    } catch (err) {
      logError(err instanceof Error ? err.message : "AI request failed", {
        severity: "warning",
        sourceSystem: "api.tracker.goodfit",
        stackTrace: err instanceof Error ? err.stack : undefined,
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        continue;
      }
      return json({ good_fit: null, cached: false, message: "AI request timed out" });
    }
  }

  return json({ good_fit: null, cached: false, message: "AI generation failed after retries" });
}
