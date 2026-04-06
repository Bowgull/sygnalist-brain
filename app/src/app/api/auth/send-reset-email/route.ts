import { json, error } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { logEvent, logFailure } from "@/lib/logger";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sygnalist.app";

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
    options: { redirectTo: `${SITE_URL}/reset-password` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    await logFailure("auth.password_reset_failed", `Failed to generate reset link for ${email}: ${linkError?.message ?? "no link returned"}`, {
      severity: "error",
      sourceSystem: "auth.password_reset",
      userId: profile.id,
      metadata: { email, error: linkError?.message },
    });
    return error("Failed to generate reset link", 500);
  }

  // The action_link from Supabase contains the token. We need to extract the code
  // and redirect through our callback or directly to reset-password
  const resetUrl = linkData.properties.action_link;

  // Build branded email
  const emailHtml = `Hey there,

Someone (hopefully you) asked to reset your password. If that was you, tap the button below. If it wasn't, well, someone out there is thinking about you.

<div style="text-align:center;margin:24px 0;">
  <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#A9FFB5,#5EF2C7,#39D6FF);color:#0C1016;font-weight:700;font-size:15px;text-decoration:none;border-radius:12px;">Set New Password</a>
</div>

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
