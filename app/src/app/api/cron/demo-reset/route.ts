import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { runDemoSeed } from "@/scripts/demo-seed";

const CRON_SECRET = process.env.CRON_SECRET;
const DEMO_MODE = process.env.DEMO_MODE === "true";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!DEMO_MODE) {
    return error("Demo reset is only available on demo deployments", 403);
  }

  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return error("Unauthorized", 401);
  }

  const start = Date.now();
  try {
    await runDemoSeed();
    return json({ ok: true, elapsedMs: Date.now() - start });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return error(`Reset failed: ${message}`, 500);
  }
}
