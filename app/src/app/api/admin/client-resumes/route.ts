import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { extractText } from "@/lib/resume/extract-text";
import { parseWithAI } from "@/lib/resume/parse";
import { logEvent, logError } from "@/lib/logger";

/**
 * GET /api/admin/client-resumes?profile_id=X
 * List all resumes for a client, newest first.
 */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profile_id");
  if (!profileId) return error("profile_id required");

  const service = getServiceClient();
  const { data, error: dbErr } = await service
    .from("client_resumes")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (dbErr) return error(dbErr.message, 500);
  return json(data ?? []);
}

/**
 * POST /api/admin/client-resumes
 * Upload + parse a resume for an existing client.
 * Accepts multipart/form-data with file or text + profile_id.
 */
export async function POST(request: Request) {
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;
  if (!admin) return error("Profile not found", 404);

  const formData = await request.formData();
  const profileId = formData.get("profile_id") as string | null;
  if (!profileId) return error("profile_id required");

  const file = formData.get("file") as File | null;
  const pastedText = formData.get("text") as string | null;

  let resumeText = "";
  let fileName = "pasted-text";
  let fileSize = 0;
  let filePath: string | null = null;

  const service = getServiceClient();

  if (file && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return error("File too large (max 5MB)");

    const accepted = [".docx", ".doc", ".txt", ".md"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!accepted.includes(ext) && !file.type.startsWith("text/") && !file.type.includes("wordprocessingml")) {
      return error(`Unsupported file type. Accepted: Word (.docx) or plain text (.txt). Got: ${ext}`);
    }

    resumeText = await extractText(file);
    fileName = file.name;
    fileSize = file.size;

    // Upload to Supabase Storage
    const storagePath = `${profileId}/${Date.now()}_${file.name}`;
    const buffer = await file.arrayBuffer();
    const { error: uploadErr } = await service.storage
      .from("resumes")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadErr) {
      logError(uploadErr.message, { sourceSystem: "api.client_resumes.upload", userId: admin.id });
      return error("Failed to upload file to storage", 500);
    }
    filePath = storagePath;
  } else if (pastedText && pastedText.trim().length >= 50) {
    resumeText = pastedText.trim().slice(0, 15000);
    fileName = "pasted-text";
    fileSize = resumeText.length;
  } else {
    return error("Upload a file (.docx, .txt, .md) or paste resume text (min 50 chars)");
  }

  if (!resumeText || resumeText.length < 50) {
    return error("Could not extract enough text. Try pasting the resume text directly.");
  }

  const startTime = Date.now();

  try {
    const parsed = await parseWithAI(resumeText);

    // Log to resume_parse_logs
    await service.from("resume_parse_logs").insert({
      user_id: profileId,
      file_name: fileName,
      file_size: fileSize,
      success: true,
      openai_response_time_ms: Date.now() - startTime,
      model: "gpt-4o-mini",
    });

    // Insert client_resumes row with status=pending
    const { data: resume, error: insertErr } = await service
      .from("client_resumes")
      .insert({
        profile_id: profileId,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        parsed_data: JSON.parse(JSON.stringify(parsed)),
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      logError(insertErr.message, { sourceSystem: "api.client_resumes.insert", userId: admin.id });
      return error(insertErr.message, 500);
    }

    logEvent("admin.resume_uploaded", { userId: admin.id, metadata: { target_profile_id: profileId, resume_id: resume.id, file_name: fileName } });
    return json(resume, 201);
  } catch (err) {
    await service.from("resume_parse_logs").insert({
      user_id: profileId,
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
