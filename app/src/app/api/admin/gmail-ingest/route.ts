import { requireAdmin, json, error } from "@/lib/api-helpers";

/**
 * POST /api/admin/gmail-ingest — trigger Gmail ingest.
 *
 * Stub for Phase 4. The full implementation will use Gmail API
 * with the newsletter-aware parsers (ZipRecruiter, LinkedIn, Indeed, etc.)
 */
export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;

  // TODO: Phase 4 will implement Gmail ingest with newsletter parsers
  return json({
    message: "Gmail ingest will be available after Phase 4",
    jobs_ingested: 0,
  });
}
