import { json } from "@/lib/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { logEvent } from "@/lib/logger";

/**
 * POST /api/auth/log — log an auth event from the client.
 *
 * The login page calls this after Supabase auth completes so we can
 * record login success/failure server-side without exposing the logger
 * to the browser.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const event = body.event as string; // "login" | "login_failed" | "logout"
  const method = body.method as string | undefined; // "password" | "magic" | "google"
  const errorMessage = body.error as string | undefined;

  // Try to identify the user (may not have a session yet on failure)
  let userId: string | null = null;
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      userId = profile?.id ?? null;
    }
  } catch {
    // Can't identify user — still log the event
  }

  await logEvent(`auth.${event}`, {
    userId,
    success: event !== "login_failed",
    metadata: {
      method,
      ...(errorMessage ? { error: errorMessage } : {}),
    },
  });

  return json({ ok: true });
}
