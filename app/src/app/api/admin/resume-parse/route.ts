import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * POST /api/admin/resume-parse — Upload and parse a resume with AI
 *
 * Accepts: multipart/form-data with a "file" field (PDF or text)
 * Returns: extracted profile data (skills, roles, locations, etc.)
 */
export async function POST(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return error("No file uploaded");
  if (file.size > 5 * 1024 * 1024) return error("File too large (max 5MB)");

  // Read file content
  const text = await extractText(file);
  if (!text || text.length < 50) {
    return error("Could not extract enough text from file");
  }

  if (!OPENAI_KEY) {
    return error("OpenAI API key not configured");
  }

  const service = getServiceClient();
  const startTime = Date.now();

  try {
    const parsed = await parseWithAI(text);

    // Log the parse
    await service.from("resume_parse_logs").insert({
      user_id: profile.id,
      file_name: file.name,
      file_size: file.size,
      success: true,
      openai_response_time_ms: Date.now() - startTime,
      model: "gpt-4o-mini",
    });

    return json(parsed);
  } catch (err) {
    await service.from("resume_parse_logs").insert({
      user_id: profile.id,
      file_name: file.name,
      file_size: file.size,
      success: false,
      error_message: err instanceof Error ? err.message : "Parse failed",
      openai_response_time_ms: Date.now() - startTime,
      model: "gpt-4o-mini",
    });

    return error("Resume parse failed", 500);
  }
}

async function extractText(file: File): Promise<string> {
  const type = file.type;

  // Plain text / markdown
  if (type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    return await file.text();
  }

  // PDF — extract raw text (basic approach: look for text streams)
  if (type === "application/pdf" || file.name.endsWith(".pdf")) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

    // Extract text between BT and ET operators (PDF text objects)
    const textParts: string[] = [];
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let match;
    while ((match = tjRegex.exec(raw)) !== null) {
      textParts.push(match[1]);
    }

    // Also try extracting readable ASCII text blocks
    const readableBlocks = raw.match(/[\x20-\x7E]{10,}/g) ?? [];
    const combined = [...textParts, ...readableBlocks].join(" ");

    // Deduplicate and clean
    const cleaned = combined
      .replace(/\s+/g, " ")
      .replace(/[^\x20-\x7E\n]/g, "")
      .trim();

    return cleaned.slice(0, 15000); // Cap at 15k chars for API
  }

  // Docx — extract from XML content
  if (file.name.endsWith(".docx") || type.includes("wordprocessingml")) {
    const buffer = await file.arrayBuffer();
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buffer));
    const textMatches = raw.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
    const text = textMatches.map((t) => t.replace(/<[^>]+>/g, "")).join(" ");
    return text.slice(0, 15000);
  }

  // Fallback: try raw text
  return (await file.text()).slice(0, 15000);
}

interface ParsedResume {
  display_name: string;
  current_city: string;
  top_skills: string[];
  skill_keywords_plus: string[];
  role_tracks: Array<{ label: string; roleKeywords: string[]; priorityWeight: number }>;
  preferred_locations: string[];
  accept_remote: boolean;
  accept_hybrid: boolean;
  accept_onsite: boolean;
  salary_estimate: string;
  summary: string;
  experience_years: number;
  education: string;
}

async function parseWithAI(resumeText: string): Promise<ParsedResume> {
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
- Keep arrays concise — quality over quantity`;
