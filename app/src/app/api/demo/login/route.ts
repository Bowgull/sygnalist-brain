import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "demo@bridgefour.xyz";
const DEMO_MODE = process.env.DEMO_MODE === "true";

/**
 * Server-issued demo session.
 *
 * Flow:
 *   1. Service-role admin generates a one-time magic-link token for the demo user.
 *   2. SSR Supabase client verifies that token, which writes session cookies on the response.
 *   3. Client navigates to /inbox; cookies travel with the request.
 *
 * This avoids client-side signInWithPassword entirely — no password drift,
 * no third-party-cookie issues, no auth stalls. Same-origin cookies, set server-side.
 */
export async function POST() {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "demo_mode_off" }, { status: 404 });
  }

  const service = createServiceClient();

  const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: "demo_provision_failed", detail: linkErr?.message ?? "no token" },
      { status: 500 }
    );
  }

  const ssr = await createServerSupabase();
  const { error: otpErr } = await ssr.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (otpErr) {
    return NextResponse.json(
      { error: "demo_session_failed", detail: otpErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, redirect: "/inbox" });
}
