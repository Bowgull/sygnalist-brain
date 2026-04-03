import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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
  const { data } = await service
    .from("profiles")
    .select("id, status")
    .ilike("email", email)
    .limit(1)
    .single();

  if (!data) {
    return NextResponse.json({ allowed: false });
  }

  // Also block locked profiles
  if (data.status === "inactive_soft_locked") {
    return NextResponse.json({ allowed: false, reason: "locked" });
  }

  return NextResponse.json({ allowed: true });
}
