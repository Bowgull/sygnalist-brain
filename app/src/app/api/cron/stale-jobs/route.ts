import { NextRequest } from "next/server";
import { json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

const CRON_SECRET = process.env.CRON_SECRET;
const STALE_DAYS = 14;
const PURGE_DAYS = 30;

/**
 * GET /api/cron/stale-jobs - Daily job bank staleness sweep.
 *
 * 1. Marks active jobs older than 14 days as stale
 * 2. Hard-deletes archived jobs older than 30 days (if not tracked)
 * 3. Cleans expired enrichment cache entries
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return error("Unauthorized", 401);
  }

  const service = getServiceClient();
  const results = { marked_stale: 0, purged: 0, cache_cleaned: 0 };

  try {
    // Step 1: Mark active jobs as stale if updated_at > 14 days ago
    const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleData, error: staleErr } = await service
      .from("global_job_bank")
      .update({ stale_status: "stale", stale_at: new Date().toISOString() })
      .eq("stale_status", "active")
      .lt("updated_at", staleThreshold)
      .select("id");

    if (staleErr) {
      logError(staleErr.message, { severity: "error", sourceSystem: "cron.stale-jobs" });
    } else {
      results.marked_stale = staleData?.length ?? 0;
    }

    // Step 2: Purge archived jobs older than 30 days (protect tracked jobs)
    const purgeThreshold = new Date(Date.now() - PURGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Get tracked URLs to protect
    const { data: trackedUrls } = await service
      .from("tracker_entries")
      .select("url")
      .not("url", "is", null);

    const protectedUrls = new Set((trackedUrls ?? []).map((r) => r.url).filter(Boolean));

    // Get archived jobs past purge threshold
    const { data: archiveCandidates, error: archiveErr } = await service
      .from("global_job_bank")
      .select("id, url")
      .eq("stale_status", "archived")
      .lt("stale_at", purgeThreshold);

    if (archiveErr) {
      logError(archiveErr.message, { severity: "error", sourceSystem: "cron.stale-jobs" });
    } else if (archiveCandidates && archiveCandidates.length > 0) {
      const toPurge = archiveCandidates
        .filter((j) => !j.url || !protectedUrls.has(j.url))
        .map((j) => j.id);

      if (toPurge.length > 0) {
        const { error: purgeErr } = await service
          .from("global_job_bank")
          .delete()
          .in("id", toPurge);

        if (purgeErr) {
          logError(purgeErr.message, { severity: "error", sourceSystem: "cron.stale-jobs" });
        } else {
          results.purged = toPurge.length;
        }
      }
    }

    // Step 3: Clean expired enrichment cache
    const { data: cacheData, error: cacheErr } = await service
      .from("enrichment_cache")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (cacheErr) {
      logError(cacheErr.message, { severity: "warning", sourceSystem: "cron.stale-jobs" });
    } else {
      results.cache_cleaned = cacheData?.length ?? 0;
    }

    logEvent("cron.stale_jobs", { metadata: results });
    return json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logError(message, { severity: "error", sourceSystem: "cron.stale-jobs" });
    return error(message, 500);
  }
}
