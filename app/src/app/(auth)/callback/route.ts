import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { logEvent } from "@/lib/logger";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/inbox";

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Look up profile to get profile.id for the log
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", data.user.id)
        .single();

      await logEvent("auth.login", {
        userId: profile?.id,
        metadata: { method: "oauth_callback" },
      });

      return NextResponse.redirect(`${origin}${next}`);
    }

    await logEvent("auth.login_failed", {
      success: false,
      metadata: { method: "oauth_callback", error: error?.message ?? "unknown" },
    });
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
