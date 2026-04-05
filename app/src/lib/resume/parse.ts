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
      "label": "Primary role title they're targeting (e.g. 'Product Manager')",
      "roleKeywords": ["related job title variations they'd match"],
      "priorityWeight": 1.0
    },
    {
      "label": "Secondary role if applicable",
      "roleKeywords": ["variations"],
      "priorityWeight": 0.7
    }
  ],
  "preferred_locations": ["Cities/regions mentioned or implied"],
  "accept_remote": true/false based on resume indicators,
  "accept_hybrid": true/false,
  "accept_onsite": true/false,
  "salary_estimate": "Estimated salary range based on experience level and role",
  "summary": "2-3 sentence professional summary",
  "experience_years": number,
  "education": "Highest degree and school"
}

Rules:
- Extract what's actually in the resume, don't fabricate
- For role_tracks, infer from job titles and experience what roles they'd target
- If location preferences aren't clear, set all accept_* to true
- For salary_estimate, give a market-rate range based on role + experience
- Keep arrays concise - quality over quantity`;

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
      max_tokens: 1500,
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
    experience_years: parsed.experience_years || 0,
    education: parsed.education || "",
  };
}
