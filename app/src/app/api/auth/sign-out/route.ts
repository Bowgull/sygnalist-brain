import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("syg_session_start");
  return response;
}
