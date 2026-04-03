import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/profile-init
 * Called after login/signup to ensure a profile row exists.
 * If the user has an auth account but no profile, create one.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, created: false });
  }

  // Create profile using service client (bypasses RLS)
  const service = createServiceClient();
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "New User";

  const profileId = `user-${user.id.slice(0, 8)}`;

  const { error: insertErr } = await service.from("profiles").insert({
    auth_user_id: user.id,
    profile_id: profileId,
    display_name: displayName,
    email: user.email || null,
    role: "client",
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: true });
}
