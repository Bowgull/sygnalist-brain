import { json } from "@/lib/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { logEvent, logFailure } from "@/lib/logger";

/** POST /api/auth/log — log an auth event from the client. */
export async function POST(request: Request) {
  const body = await request.json();
  const event = body.event as string;
  const method = body.method as string | undefined;
  const errorMessage = body.error as string | undefined;
  const email = body.email as string | undefined;

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
  } catch { /* Can't identify user — still log */ }

  if (event === "login_failed") {
    await logFailure(`auth.${event}`, `Login failed${email ? ` for ${email}` : ""}: ${errorMessage ?? "unknown error"}`, {
      severity: "error",
      sourceSystem: "auth.magic_link",
      userId,
      metadata: {
        method,
        stage: "otp_request",
        ...(email ? { email } : {}),
        ...(errorMessage ? { error: errorMessage, cause: errorMessage } : {}),
      },
    });
  } else {
    await logEvent(`auth.${event}`, {
      userId,
      success: true,
      metadata: {
        method,
        ...(email ? { email } : {}),
      },
    });
  }

  return json({ ok: true });
}
