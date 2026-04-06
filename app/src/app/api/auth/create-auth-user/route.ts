import { requireAdmin, json, error } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/server";
import { logEvent, logError } from "@/lib/logger";

/** POST /api/auth/create-auth-user - Create a Supabase auth user with no password (admin only). */
export async function POST(request: Request) {
  const { response, profile } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  const email = (body.email as string)?.trim().toLowerCase();

  if (!email) return error("Email is required", 400);

  const service = createServiceClient();
  const { data, error: createError } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createError) {
    // Idempotent: if user already exists, that's fine
    if (createError.message?.includes("already been registered")) {
      return json({ ok: true, exists: true });
    }
    await logError(`Failed to create auth user for ${email}: ${createError.message}`, {
      sourceSystem: "auth.admin",
      userId: profile?.id,
      metadata: { email, error: createError.message },
    });
    return error(createError.message, 500);
  }

  await logEvent("admin.auth_user_created", {
    userId: profile?.id,
    metadata: { email, auth_user_id: data.user?.id },
  });

  return json({ ok: true, exists: false, auth_user_id: data.user?.id });
}
