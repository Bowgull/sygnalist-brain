import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/** GET /api/admin/view-as/profile?client_id=xxx — get a client's profile for view-as */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return error("client_id is required", 400);

  const service = getServiceClient();
  const { data: profile, error: dbError } = await service
    .from("profiles")
    .select("*")
    .eq("id", clientId)
    .single();

  if (dbError || !profile) return error("Client not found", 404);

  return json(profile);
}
