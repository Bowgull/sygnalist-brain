import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * POST /api/admin/resume-parse — Parse a resume with AI
 *
 * Accepts either:
 * - multipart/form-data with a "file" field (Word .docx or .txt)
 * - multipart/form-data with a "text" field (pasted resume text)
 * - JSON body with { text: "..." } (pasted resume text)
 *
 * Returns: extracted profile data (skills, roles, locations, etc.)
 */
export async function POST(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  if (!OPENAI_KEY) {
    return error("OpenAI API key not configured");
  }

  let resumeText = "";
  let fileName = "pasted-text";
  let fileSize = 0;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const pastedText = formData.get("text") as string | null;

    if (pastedText && pastedText.trim().length >= 50) {
      resumeText = pastedText.trim().slice(0, 15000);
      fileName = "pasted-text";
      fileSize = resumeText.length;
    } else if (file) {
      if (file.size > 5 * 1024 * 1024) return error("File too large (max 5MB)");

      const accepted = [".docx", ".doc", ".txt", ".md"];
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!accepted.includes(ext) && !file.type.startsWith("text/") && !file.type.includes("wordprocessingml")) {
        return error(`Unsupported file type. Accepted: Word (.docx) or plain text (.txt). Got: ${ext}`);
      }

      resumeText = await extractText(file);
      fileName = file.name;
      fileSize = file.size;
    } else {
      return error("Upload a Word document (.docx) or paste resume text");
    }
  } else {
    // JSON body with { text: "..." }
    const body = await request.json();
    if (!body.text || typeof body.text !== "string" || body.text.trim().length < 50) {
      return error("Resume text too short (minimum 50 characters)");
    }
    resumeText = body.text.trim().slice(0, 15000);
    fileName = "pasted-text";
    fileSize = resumeText.length;
  }

  if (!resumeText || resumeText.length < 50) {
    return error("Could not extract enough text. Try pasting the resume text directly.");
  }

  const service = getServiceClient();
  const startTime = Date.now();

  try {
    const parsed = await parseWithAI(resumeText);

    await service.from("resume_parse_logs").insert({
      user_id: profile.id,
      file_name: fileName,
      file_size: fileSize,
      success: true,
      openai_response_time_ms: Date.now() - startTime,
      model: "gpt-4o-mini",
    });

    return json(parsed);
  } catch (err) {
    await service.from("resume_parse_logs").insert({
      user_id: profile.id,
      file_name: fileName,
      file_size: fileSize,
      success: false,
      error_message: err instanceof Error ? err.message : "Parse failed",
      openai_response_time_ms: Date.now() - startTime,
      model: "gpt-4o-mini",
    });

    return error("Resume parse failed. Try pasting the text directly.", 500);
  }
}

async function extractText(file: File): Promise<string> {
  // Plain text / markdown
  if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    return (await file.text()).slice(0, 15000);
  }

  // Docx — extract text from XML content
  if (file.name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    const buffer = await file.arrayBuffer();
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buffer));
    const textMatches = raw.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
    const text = textMatches.map((t) => t.replace(/<[^>]+>/g, "")).join(" ");
    if (text.length >= 50) return text.slice(0, 15000);

    // Fallback: try raw text extraction
    return (await file.text()).slice(0, 15000);
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
