import type { ParsedResume } from "@/types/resume";

const OPENAI_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are a resume parser for a job-hunt coaching platform. Extract structured profile data from the resume text.

Return a JSON object with these fields:
{
  "display_name": "Full name from resume",
  "current_city": "City, State/Country from resume",
  "top_skills": ["Top 5-8 skills mentioned multiple times or in skills section"],
  "skill_keywords_plus": ["10-15 specific technical skills, tools, frameworks mentioned"],
  "role_tracks": [
    {
      "label": "Exact job title as it would appear on a job board, including seniority (e.g. 'Senior Product Manager')",
      "roleKeywords": ["3-6 title variations and abbreviations that job boards use for this role"],
      "priorityWeight": 1.0
    }
  ],
  "preferred_locations": ["Cities/regions mentioned or implied"],
  "accept_remote": true/false based on resume indicators,
  "accept_hybrid": true/false,
  "accept_onsite": true/false,
  "salary_estimate": "Estimated salary range based on experience level and role",
  "summary": "2-3 sentence professional summary",
  "signature_stories": ["3-6 measurable achievements from their work history. Each should be 1-2 sentences with specific numbers, outcomes, or impact. e.g. 'Built customer success team from 0 to 4 people, achieving 95% retention' or 'Shipped integration that reduced onboarding from 30 days to 3 days'"],
  "experience_years": number,
  "education": "Highest degree and school"
}

Rules:
- CRITICAL: Only extract information that is explicitly stated in the resume text. If a field is not mentioned or cannot be determined, use "" for strings, [] for arrays, 0 for numbers, and true for booleans.
- NEVER fabricate or invent names, skills, companies, achievements, or any other data. Every value you return must come directly from the resume text.
- If the resume text appears to be binary data, corrupted, garbled, or not a real resume, return all empty fields: {"display_name":"","current_city":"","top_skills":[],"skill_keywords_plus":[],"role_tracks":[],"preferred_locations":[],"accept_remote":true,"accept_hybrid":true,"accept_onsite":false,"salary_estimate":"","summary":"","signature_stories":[],"experience_years":0,"education":""}
- For role_tracks, generate 2-4 tracks (not more). These directly drive job search, so quality matters more than quantity:
  * The FIRST track (priorityWeight: 1.0) must be their strongest fit - the role title closest to their most recent 1-2 positions
  * Additional tracks (priorityWeight: 0.6-0.8) should be adjacent roles they could realistically land given their experience
  * Every label MUST include seniority level (Junior, Associate, Mid-level, Senior, Staff, Lead, Director, VP) calibrated to experience years: 0-2y = Junior/Associate, 3-5y = Mid-level, 6-9y = Senior, 10-14y = Staff/Lead, 15+ = Director/VP
  * Labels must be real job titles that appear on LinkedIn/Indeed - not invented compound titles
  * roleKeywords must include: the exact label lowercased, common abbreviations (e.g. SWE, PM, CSM), and 2-3 title variations employers actually use
  * Do NOT suggest wildly different career pivots without supporting experience
  * Do NOT include "Manager" in the title unless the person has actually managed people or projects
- If location preferences aren't clear, set all accept_* to true
- For salary_estimate, give a market-rate range based on role + experience
- Keep arrays concise - quality over quantity
- For signature_stories, pull the strongest measurable achievements. These are proof points - real results with numbers, not vague descriptions. Minimum 3, maximum 6.`;

export async function parseWithAI(resumeText: string): Promise<ParsedResume> {
  if (!OPENAI_KEY) throw new Error("OpenAI API key not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Parse this resume:\n\n${resumeText}` },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(content);

  return {
    display_name: parsed.display_name || "",
    current_city: parsed.current_city || "",
    top_skills: parsed.top_skills || [],
    skill_keywords_plus: parsed.skill_keywords_plus || [],
    role_tracks: (parsed.role_tracks || []).map((t: { label?: string; roleKeywords?: string[]; priorityWeight?: number }) => ({
      label: t.label || "",
      roleKeywords: t.roleKeywords || [],
      priorityWeight: t.priorityWeight ?? 1.0,
    })),
    preferred_locations: parsed.preferred_locations || [],
    accept_remote: parsed.accept_remote ?? true,
    accept_hybrid: parsed.accept_hybrid ?? true,
    accept_onsite: parsed.accept_onsite ?? false,
    salary_estimate: parsed.salary_estimate || "",
    summary: parsed.summary || "",
    signature_stories: parsed.signature_stories || [],
    experience_years: parsed.experience_years || 0,
    education: parsed.education || "",
  };
}

/**
 * Verify that the parsed display_name has at least one word matching the source text.
 * If not, the parse is likely hallucinated — clear the name and flag for manual review.
 */
export function validateParsedResult(parsed: ParsedResume, sourceText: string): ParsedResume {
  if (!parsed.display_name) return parsed;
  const nameParts = parsed.display_name.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  const sourceWords = new Set(sourceText.toLowerCase().split(/\s+/));
  const nameFoundInSource = nameParts.some((part) => sourceWords.has(part));
  if (!nameFoundInSource) {
    return {
      ...parsed,
      display_name: "",
      summary: "Resume could not be reliably parsed. Please review manually.",
    };
  }
  return parsed;
}
