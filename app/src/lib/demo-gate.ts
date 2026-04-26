import { NextResponse, type NextRequest } from "next/server";

const DEMO_MODE = process.env.DEMO_MODE === "true";

const ALWAYS_BLOCKED_PATHS = [
  "/api/cron",
  "/api/fetch",
  "/api/admin/fetch",
  "/api/admin/view-as/fetch",
  "/api/admin/gmail-ingest",
  "/api/admin/messages/poll-replies",
  "/api/admin/resume-parse",
];

const BLOCKED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const ALLOWED_PATHS = ["/api/auth"];

export function checkDemoGate(request: NextRequest): NextResponse | null {
  if (!DEMO_MODE) return null;

  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api")) return null;
  if (ALLOWED_PATHS.some((p) => path.startsWith(p))) return null;

  const isAlwaysBlocked = ALWAYS_BLOCKED_PATHS.some((p) => path.startsWith(p));
  const isWriteMethod = BLOCKED_METHODS.has(request.method);

  if (!isAlwaysBlocked && !isWriteMethod) return null;

  return NextResponse.json(
    {
      error: "demo_mode",
      message: "This is a read-only demo. Writes, fetches, and AI calls are disabled.",
    },
    { status: 403 }
  );
}
