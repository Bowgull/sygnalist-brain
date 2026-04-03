import { requireAuth, json, error } from "@/lib/api-helpers";

const OPENAI_KEY = process.env.OPENAI_API_KEY;

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

  if (!OPENAI_KEY) {
    return json({ good_fit: null, cached: false, message: "AI not configured" });
  }

  // Generate GoodFit assessment
  const tracks = Array.isArray(profile.role_tracks)
    ? (profile.role_tracks as Array<{ label?: string }>).map((t) => t.label).filter(Boolean).join(", ")
    : "";

  const prompt = `You are a job-hunt coach. A client has this job in their tracker:

Job: ${entry.title} at ${entry.company}
Location: ${entry.location ?? "Not specified"}
Salary: ${entry.salary ?? "Not specified"}
Summary: ${entry.job_summary ?? "No summary available"}
WhyFit: ${entry.why_fit ?? "Not available"}

Client profile:
- Name: ${profile.display_name}
- Target roles: ${tracks || "Not specified"}
- Top skills: ${(profile.top_skills ?? []).join(", ") || "Not specified"}
- Signature stories: ${(profile.signature_stories ?? []).slice(0, 2).join("; ") || "None"}

Write a GoodFit assessment (3-5 bullets) that:
1. Identifies specific strengths the client brings to THIS role
2. Highlights 1-2 talking points for interviews using their signature stories
3. Notes any gaps or areas to prepare for
4. Gives one concrete tip for standing out in the application

Be direct, warm, and specific. No corporate-speak. Use "you" to address the client.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are Sygnalist, a direct and encouraging job-hunt coach. Write concise, actionable GoodFit assessments. Never use: 'exciting opportunity', 'dynamic team', 'fast-paced environment', 'leverage your expertise', 'passionate about'.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      return json({ good_fit: null, cached: false, message: "AI generation failed" });
    }

    const data = await res.json();
    const goodFit = data.choices?.[0]?.message?.content ?? null;

    if (goodFit) {
      // Save to tracker entry
      await supabase
        .from("tracker_entries")
        .update({
          good_fit: goodFit,
          good_fit_updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return json({ good_fit: goodFit, cached: false });
  } catch {
    return json({ good_fit: null, cached: false, message: "AI request timed out" });
  }
}
