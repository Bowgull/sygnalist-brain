import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logFailure } from "@/lib/logger";

/**
 * POST /api/auth/check-access
 * Checks if an email has been pre-registered by admin in the profiles table.
 * No auth required - this runs before login.
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
    await logFailure("auth.access_denied", `Access denied: no profile found for ${email}`, {
      severity: "warning",
      sourceSystem: "auth.access_check",
      metadata: { email, reason: "no_profile", stage: "access_check" },
    });
    return NextResponse.json({ allowed: false });
  }

  if (data.status === "inactive_soft_locked") {
    await logFailure("auth.access_denied", `Access denied: profile locked for ${email}`, {
      severity: "warning",
      sourceSystem: "auth.access_check",
      userId: data.id,
      metadata: { email, reason: "locked", stage: "access_check" },
    });
    return NextResponse.json({ allowed: false, reason: "locked" });
  }

  return NextResponse.json({ allowed: true });
}
