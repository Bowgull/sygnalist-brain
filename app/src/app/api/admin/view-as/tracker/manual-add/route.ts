import { requireAdmin, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

const ALLOWED_STAGES = ["Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer"];

/** POST /api/admin/view-as/tracker/manual-add?client_id=xxx - manually add a job to a client's tracker */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return error("client_id is required", 400);

  const body = await request.json();

  if (!body.title || !body.company) {
    return error("Title and company are required");
  }

  const status = body.status && ALLOWED_STAGES.includes(body.status) ? body.status : "Prospect";

  const service = getServiceClient();

  // Check for duplicate URL if provided
  if (body.url) {
    const { data: existing } = await service
      .from("tracker_entries")
      .select("id")
      .eq("profile_id", clientId)
      .eq("url", body.url)
      .limit(1);

    if (existing && existing.length > 0) {
      logEvent("tracker.manual_add", { userId: clientId, requestId, success: false, metadata: { url: body.url, reason: "duplicate_url", via: "view_as" } });
      return error("Job with this URL already in tracker", 409);
    }
  }

  const { data: entry, error: insertErr } = await service
    .from("tracker_entries")
    .insert({
      profile_id: clientId,
      title: body.title,
      company: body.company,
      url: body.url || null,
      location: body.location || null,
      salary: body.salary || null,
      notes: body.notes || null,
      status,
      source: "manual",
      ...(status === "Applied" ? { date_applied: new Date().toISOString().slice(0, 10) } : {}),
    })
    .select()
    .single();

  if (insertErr) {
    logError(insertErr.message, { sourceSystem: "api.view-as.tracker.manual_add", userId: clientId, requestId, metadata: { title: body.title, company: body.company } });
    return error(insertErr.message, 500);
  }

  // Also upsert to global job bank if URL provided
  if (body.url) {
    await service.from("global_job_bank").upsert(
      {
        url: body.url,
        title: body.title,
        company: body.company,
        location: body.location || null,
        source: "manual",
        stale_status: "active",
        stale_at: null,
      },
      { onConflict: "url" }
    );
  }

  logEvent("tracker.manual_add", { userId: clientId, requestId, metadata: { tracker_entry_id: entry.id, via: "view_as" } });

  // Fire-and-forget: auto-generate GoodFit for the new tracker entry (using view-as endpoint)
  const origin = new URL(request.url).origin;
  fetch(`${origin}/api/admin/view-as/tracker/${entry.id}/goodfit?client_id=${clientId}`, {
    method: "POST",
    headers: { cookie: request.headers.get("cookie") ?? "" },
  }).catch(() => { /* non-critical */ });

  return json(entry, 201);
}
