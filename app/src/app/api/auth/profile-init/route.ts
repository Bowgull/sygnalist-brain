import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/profile-init
 * Links an auth user to their pre-existing profile (created by admin).
 * Does NOT create profiles — admin must add the user first.
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
      await service
        .from("profiles")
        .update({ auth_user_id: user.id })
        .eq("id", profile.id);

      return NextResponse.json({ ok: true, linked: true });
    }
  }

  return NextResponse.json({ ok: false, linked: false, reason: "no_profile" });
}
