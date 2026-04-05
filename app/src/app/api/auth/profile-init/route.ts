import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { logEvent, logError } from "@/lib/logger";

/**
 * POST /api/auth/profile-init
 * Links an auth user to their pre-existing profile (created by admin).
 * Does NOT create profiles - admin must add the user first.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if already linked
  const { data: linked } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (linked) {
    return NextResponse.json({ ok: true, linked: true });
  }

  // Find profile by email and link it
  if (user.email) {
    const service = createServiceClient();
    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .ilike("email", user.email)
      .is("auth_user_id", null)
      .limit(1)
      .single();

    if (profile) {
      const { error: updateErr } = await service
        .from("profiles")
        .update({ auth_user_id: user.id })
        .eq("id", profile.id);

      if (updateErr) {
        await logError(updateErr.message, {
          sourceSystem: "auth.profile_init",
          metadata: { email: user.email, profile_id: profile.id },
        });
        return NextResponse.json({ ok: false, linked: false, reason: "link_failed" });
      }

      await logEvent("auth.profile_linked", {
        userId: profile.id,
        metadata: { email: user.email },
      });

      return NextResponse.json({ ok: true, linked: true });
    }
  }

  await logEvent("auth.access_denied", {
    success: false,
    metadata: { email: user.email, reason: "no_profile" },
  });

  return NextResponse.json({ ok: false, linked: false, reason: "no_profile" });
}
