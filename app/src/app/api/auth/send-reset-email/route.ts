import { json, error } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail, emailButton } from "@/lib/email";
import { logEvent, logFailure } from "@/lib/logger";

/** POST /api/auth/send-reset-email - Send a branded password reset email. */
export async function POST(request: Request) {
  const body = await request.json();
  const email = (body.email as string)?.trim().toLowerCase();

  if (!email) return error("Email is required", 400);

  const service = createServiceClient();

  // Check if email exists in profiles
  const { data: profile } = await service
    .from("profiles")
    .select("id, status")
    .ilike("email", email)
    .limit(1)
    .single();

  if (!profile || profile.status === "inactive_soft_locked") {
    return json({ ok: false, reason: "no_access" });
  }

  // Generate the reset link without sending Supabase's default email
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    await logFailure("auth.password_reset_failed", `Failed to generate reset link for ${email}: ${linkError?.message ?? "no token returned"}`, {
      severity: "error",
      sourceSystem: "auth.password_reset",
      userId: profile.id,
      metadata: { email, error: linkError?.message },
    });
    return error("Failed to generate reset link", 500);
  }

  // Build a direct link to our reset-password page using the hashed token.
  // This bypasses Supabase's redirect flow which breaks on mobile (domain mismatch, fragile redirect chain).
  const origin = new URL(request.url).origin;
  const resetUrl = `${origin}/reset-password?token_hash=${linkData.properties.hashed_token}`;

  // Build branded email
  const emailHtml = `Hey there,

Someone (hopefully you) asked to reset your password. If that was you, tap the button below. If it wasn't, well, someone out there is thinking about you.

${emailButton("Set New Password", resetUrl)}

This link expires in 1 hour. After that, it self-destructs like it was never here.

If you didn't request this, just ignore this email. Your account is fine. Nobody got in. Relax.`;

  const result = await sendEmail(email, "Reset Your Password", emailHtml);

  if (!result.success) {
    await logFailure("auth.password_reset_failed", `Failed to send reset email to ${email}: ${result.error}`, {
      severity: "error",
      sourceSystem: "smtp.send",
      userId: profile.id,
      metadata: { email, error: result.error },
    });
    return error("Failed to send email", 500);
  }

  await logEvent("auth.password_reset_requested", {
    userId: profile.id,
    metadata: { email, method: "password" },
  });

  return json({ ok: true });
}
