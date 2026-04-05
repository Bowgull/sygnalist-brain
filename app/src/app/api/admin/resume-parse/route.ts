import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { extractText } from "@/lib/resume/extract-text";
import { parseWithAI } from "@/lib/resume/parse";

/**
 * POST /api/admin/resume-parse - Parse a resume with AI
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
