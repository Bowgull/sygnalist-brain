import { NextResponse, type NextRequest } from "next/server";

const DEMO_MODE = process.env.DEMO_MODE === "true";

/**
 * Demo gate.
 *
 * Philosophy: demo users should be able to PLAY. Writes against demo profile
 * data are allowed and cleaned up nightly by /api/cron/demo-reset. The only
 * routes hard-blocked here are ones that hit external systems we never want
 * fired in demo (real Gmail polling, cron triggers).
 *
 * Routes that DO call external services (OpenAI, job sources, Gmail ingest)
 * short-circuit themselves with fixture data when DEMO_MODE is set — see
 * /api/fetch, /api/admin/gmail-ingest, /api/admin/resume-parse,
 * /api/tracker/[id]/goodfit. The gate doesn't need to block them.
 */
const HARD_BLOCKED_PATHS = [
  "/api/cron",
  "/api/admin/messages/poll-replies",
];

export function checkDemoGate(request: NextRequest): NextResponse | null {
  if (!DEMO_MODE) return null;

  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api")) return null;

  const isHardBlocked = HARD_BLOCKED_PATHS.some((p) => path.startsWith(p));
  if (!isHardBlocked) return null;

  return NextResponse.json(
    {
      error: "demo_mode",
      message: "This action isn't available in the demo. Try the rest of the app — your changes reset nightly.",
    },
    { status: 403 }
  );
}
