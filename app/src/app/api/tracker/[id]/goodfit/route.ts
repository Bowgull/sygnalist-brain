import { requireAuth, json, error } from "@/lib/api-helpers";

/** POST /api/tracker/:id/goodfit — generate or retrieve GoodFit assessment */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const { data: entry, error: fetchErr } = await supabase
    .from("tracker_entries")
    .select("*")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .single();

  if (fetchErr || !entry) return error("Entry not found", 404);

  // Return existing if already generated
  if (entry.good_fit) {
    return json({ good_fit: entry.good_fit, cached: true });
  }

  // TODO: Phase 6 will implement AI generation here
  return json({
    good_fit: null,
    cached: false,
    message: "AI GoodFit generation will be available after Phase 6 (AI Enrichment)",
  });
}
