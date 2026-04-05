import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logEvent, logFailure } from "@/lib/logger";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/inbox";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Get the user's email from the session
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        // Check if admin has pre-registered this email
        const service = createServiceClient();
        const { data: profile } = await service
          .from("profiles")
          .select("id, status")
          .ilike("email", user.email)
          .limit(1)
          .single();

        if (!profile || profile.status === "inactive_soft_locked") {
          // Not allowed - sign them out and redirect to login with denied message
          await supabase.auth.signOut();
          await logFailure("auth.login_failed", `Callback denied: ${!profile ? "no profile" : "profile locked"} for ${user.email}`, {
            severity: "warning",
            sourceSystem: "auth.callback",
            metadata: {
              email: user.email,
              stage: "profile_lookup",
              reason: !profile ? "no_profile" : "locked",
            },
          });
          return NextResponse.redirect(`${origin}/login?error=no_access`);
        }

        // Link auth user to existing profile if not already linked
        if (profile) {
          await service
            .from("profiles")
            .update({ auth_user_id: user.id })
            .eq("id", profile.id)
            .is("auth_user_id", null);
        }

        await logEvent("auth.login", { userId: profile?.id, metadata: { method: "magic_link", email: user.email } });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  await logFailure("auth.login_failed", "Magic link callback failed: code exchange error", {
    severity: "error",
    sourceSystem: "auth.callback",
    metadata: { stage: "code_exchange", cause: "code_exchange_failed" },
  });
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
