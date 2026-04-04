import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/logger";

/**
 * POST /api/auth/check-access
 * Checks if an email has been pre-registered by admin in the profiles table.
 * No auth required — this runs before login.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ allowed: false });
  }

  const service = createServiceClient();
  const { data, error: dbErr } = await service
    .from("profiles")
    .select("id, status")
    .ilike("email", email)
    .limit(1)
    .single();

  if (dbErr || !data) {
    await logEvent("auth.access_denied", {
      success: false,
      metadata: { email, reason: "no_profile" },
    });
    return NextResponse.json({ allowed: false });
  }

  if (data.status === "inactive_soft_locked") {
    await logEvent("auth.access_denied", {
      success: false,
      metadata: { email, reason: "locked" },
    });
    return NextResponse.json({ allowed: false, reason: "locked" });
  }

  return NextResponse.json({ allowed: true });
}
