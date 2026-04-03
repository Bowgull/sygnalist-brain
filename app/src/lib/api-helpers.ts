import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Get the authenticated user's profile, or null. */
export async function getAuthProfile(): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  profile: Profile | null;
  userId: string | null;
}> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, profile: null, userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  return { supabase, profile, userId: user.id };
}

/** Require authentication — returns 401 if not authenticated. */
export async function requireAuth() {
  const result = await getAuthProfile();
  if (!result.userId) {
    return { ...result, response: error("Unauthorized", 401) };
  }
  return { ...result, response: null };
}

/** Require admin — returns 403 if not admin. */
export async function requireAdmin() {
  const result = await requireAuth();
  if (result.response) return result;
  if (result.profile?.role !== "admin") {
    return { ...result, response: error("Forbidden", 403) };
  }
  return { ...result, response: null };
}

/** Get a service-role client for operations that bypass RLS. */
export function getServiceClient() {
  return createServiceClient();
}
