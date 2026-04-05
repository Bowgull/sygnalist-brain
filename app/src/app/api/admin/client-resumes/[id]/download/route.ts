import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/**
 * GET /api/admin/client-resumes/:id/download
 * Returns a signed URL to download the resume file from Supabase Storage.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();

  const { data: resume, error: fetchErr } = await service
    .from("client_resumes")
    .select("file_path, file_name")
    .eq("id", id)
    .single();

  if (fetchErr || !resume) return error("Resume not found", 404);
  if (!resume.file_path) return error("No file attached (pasted text only)", 400);

  const { data: signedUrl, error: signErr } = await service.storage
    .from("resumes")
    .createSignedUrl(resume.file_path, 300); // 5 min expiry

  if (signErr || !signedUrl) return error("Failed to generate download link", 500);

  return json({ url: signedUrl.signedUrl, file_name: resume.file_name });
}
