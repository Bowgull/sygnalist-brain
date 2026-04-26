import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkDemoGate } from "@/lib/demo-gate";

export async function proxy(request: NextRequest) {
  const blocked = checkDemoGate(request);
  if (blocked) return blocked;
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
