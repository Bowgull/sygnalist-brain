import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";
import type { ParsedResume } from "@/types/resume";

/**
 * PATCH /api/admin/client-resumes/:id
 * Approve or reject a parsed resume.
 *
 * Body: { action: 'approve' | 'reject', selected_fields?: string[] }
 *
 * On approve: applies parsed_data fields to the profile, filtered by selected_fields.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile: admin, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  const action = body.action as string;
  if (action !== "approve" && action !== "reject") {
    return error("action must be 'approve' or 'reject'");
  }

  const service = getServiceClient();

  const { data: resume, error: fetchErr } = await service
    .from("client_resumes")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !resume) return error("Resume not found", 404);

  if (action === "reject") {
    await service.from("client_resumes").update({ status: "rejected" }).eq("id", id);
    logEvent("admin.resume_rejected", { userId: admin?.id, metadata: { resume_id: id, profile_id: resume.profile_id } });
    return json({ ...resume, status: "rejected" });
  }

  // Approve - build profile patch from parsed_data
  const parsed = resume.parsed_data as unknown as ParsedResume | null;
  if (!parsed) return error("No parsed data on this resume");

  const selectedFields = (body.selected_fields as string[] | undefined) ?? null;

  const fieldMap: Record<string, unknown> = {
    display_name: parsed.display_name || undefined,
    current_city: parsed.current_city || undefined,
    top_skills: parsed.top_skills?.length ? parsed.top_skills : undefined,
    skill_keywords_plus: parsed.skill_keywords_plus?.length ? parsed.skill_keywords_plus : undefined,
    role_tracks: parsed.role_tracks?.length ? parsed.role_tracks : undefined,
    preferred_locations: parsed.preferred_locations?.length ? parsed.preferred_locations : undefined,
    accept_remote: parsed.accept_remote,
    accept_hybrid: parsed.accept_hybrid,
    accept_onsite: parsed.accept_onsite,
    salary_min: parsed.salary_estimate ? parseSalaryMin(parsed.salary_estimate) : undefined,
    skill_profile_text: parsed.summary || undefined,
  };

  const patch: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fieldMap)) {
    if (val === undefined) continue;
    if (selectedFields && !selectedFields.includes(key)) continue;
    patch[key] = val;
  }

  if (Object.keys(patch).length === 0) {
    return error("No fields selected to apply");
  }

  const { data: updatedProfile, error: updateErr } = await service
    .from("profiles")
    .update(patch)
    .eq("id", resume.profile_id)
    .select()
    .single();

  if (updateErr) {
    logError(updateErr.message, { sourceSystem: "api.client_resumes.approve", userId: admin?.id });
    return error(updateErr.message, 500);
  }

  await service
    .from("client_resumes")
    .update({ status: "approved", applied_at: new Date().toISOString() })
    .eq("id", id);

  logEvent("admin.resume_approved", {
    userId: admin?.id,
    metadata: { resume_id: id, profile_id: resume.profile_id, applied_fields: Object.keys(patch) },
  });

  return json({ resume: { ...resume, status: "approved", applied_at: new Date().toISOString() }, profile: updatedProfile });
}

function parseSalaryMin(estimate: string): number | undefined {
  // Extract first number from strings like "$120,000 - $160,000" or "$80k-$120k"
  const match = estimate.replace(/,/g, "").match(/\$?\s*(\d+)/);
  if (!match) return undefined;
  let num = parseInt(match[1], 10);
  // If number is small (like 80), assume it's in thousands
  if (num < 1000) num *= 1000;
  return num;
}
