import type { RawJob, SourceResult, FetchContext } from "./types";
import type { Database, Json } from "@/types/database";
import { fetchAdzuna } from "./adzuna";
import { fetchJooble } from "./jooble";
import { fetchJSearch } from "./jsearch";
import { fetchLinkedIn } from "./linkedin";
import { fetchArbeitnow } from "./arbeitnow";
import { fetchHimalayas } from "./himalayas";
import { scoreJobs, type ScoredJob } from "@/lib/scoring/score";
import { enrichJobs } from "@/lib/enrichment/enrich";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_SEARCH_TERMS = 8;
const MAX_INBOX_JOBS = 8;

interface RoleTrack {
  label?: string;
  roleKeywords?: string[];
  priorityWeight?: number;
}

/** Resolve search terms: override > auto-generated from role_tracks */
export function resolveSearchTerms(profile: Database["public"]["Tables"]["profiles"]["Row"]): string[] {
  // If admin set an override, use those
  if (profile.search_terms_override) {
    const override = profile.search_terms_override as string[];
    if (Array.isArray(override) && override.length > 0) {
      return override.slice(0, MAX_SEARCH_TERMS);
    }
  }

  // Auto-generate from role_tracks
  const tracks = (profile.role_tracks ?? []) as RoleTrack[];
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return [];
  }

  // Sort tracks by priority weight descending
  const sorted = [...tracks].sort(
    (a, b) => (b.priorityWeight ?? 1.0) - (a.priorityWeight ?? 1.0),
  );

  const terms: string[] = [];
  const seen = new Set<string>();

  // First pass: track labels (primary terms)
  for (const t of sorted) {
    const label = t.label?.trim();
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      terms.push(label);
    }
  }

  // Second pass: roleKeywords from higher-weight tracks first
  for (const t of sorted) {
    if (terms.length >= MAX_SEARCH_TERMS) break;
    for (const kw of t.roleKeywords ?? []) {
      if (terms.length >= MAX_SEARCH_TERMS) break;
      const clean = kw.trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        terms.push(clean);
      }
    }
  }

  return terms;
}

/** Resolve location from profile */
function resolveLocation(profile: Database["public"]["Tables"]["profiles"]["Row"]): {
  location: string;
  country: string;
} {
  const location =
    profile.current_city ||
    (profile.preferred_cities?.length ? profile.preferred_cities[0] : "") ||
    (profile.preferred_locations?.length ? profile.preferred_locations[0] : "");

  const country =
    (profile.preferred_countries?.length ? profile.preferred_countries[0] : "") || "";

  return { location, country };
}

/** Deduplicate jobs by normalized URL */
function deduplicateJobs(jobs: RawJob[]): RawJob[] {
  const seen = new Set<string>();
  const result: RawJob[] = [];

  for (const job of jobs) {
    const key = normalizeUrl(job.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(job);
  }

  return result;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip tracking params
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("ref");
    return u.origin + u.pathname + (u.search || "");
  } catch {
    return url.toLowerCase().trim();
  }
}

export interface FetchPipelineResult {
  requestId: string;
  searchTerms: string[];
  sourceResults: Array<{ source: string; count: number; duration_ms: number; error?: string }>;
  totalRaw: number;
  afterDedupe: number;
  afterFilter: number;
  jobsDelivered: number;
  duration_ms: number;
}

/** Run the full fetch pipeline for a profile */
export async function runFetchPipeline(
  profile: Database["public"]["Tables"]["profiles"]["Row"],
  service: SupabaseClient<Database>,
): Promise<FetchPipelineResult> {
  const pipelineStart = Date.now();
  const requestId = crypto.randomUUID();
  const searchTerms = resolveSearchTerms(profile);

  if (searchTerms.length === 0) {
    return {
      requestId,
      searchTerms: [],
      sourceResults: [],
      totalRaw: 0,
      afterDedupe: 0,
      afterFilter: 0,
      jobsDelivered: 0,
      duration_ms: Date.now() - pipelineStart,
    };
  }

  const { location, country } = resolveLocation(profile);
  const ctx: FetchContext = { searchTerms, location, country };

  // Run all sources in parallel
  const sourcePromises: Promise<SourceResult>[] = [
    fetchAdzuna(ctx),
    fetchJooble(ctx),
    fetchJSearch(ctx),
    fetchLinkedIn(ctx),
    fetchArbeitnow(ctx),
    fetchHimalayas(ctx),
  ];

  const results = await Promise.allSettled(sourcePromises);
  const sourceResults: SourceResult[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      sourceResults.push(r.value);
    }
  }

  // Collect all raw jobs
  const allRaw: RawJob[] = [];
  for (const sr of sourceResults) {
    allRaw.push(...sr.jobs);
  }
  const totalRaw = allRaw.length;

  // Deduplicate by URL
  const deduped = deduplicateJobs(allRaw);
  const afterDedupe = deduped.length;

  // Filter out dismissed jobs and jobs already in tracker/inbox
  const filtered = await filterExistingJobs(deduped, profile.id, service);
  const afterFilter = filtered.length;

  // Phase 5: Score jobs
  const scored = scoreJobs(filtered, profile);

  // Take top N
  const topJobs = scored.slice(0, MAX_INBOX_JOBS);

  // Phase 6: Enrich with AI (summaries + whyFit)
  const enriched = await enrichJobs(topJobs, profile, service);

  // Insert into inbox_jobs
  if (enriched.length > 0) {
    const rows = enriched.map((job) => ({
      profile_id: profile.id,
      title: job.title,
      company: job.company,
      url: job.url || null,
      source: job.source || null,
      location: job.location || null,
      role_type: job.work_mode || null,
      lane_label: job.lane_label || null,
      salary: job.salary || null,
      salary_below_min: job.salary_below_min ?? false,
      score: job.score,
      tier: job.tier,
      match_hits: job.match_hits ?? 0,
      job_summary: job.job_summary || null,
      why_fit: job.why_fit || null,
      category: job.category || null,
    }));

    await service.from("inbox_jobs").insert(rows);
  }

  // Log each source result
  const logRows = sourceResults.map((sr) => ({
    profile_id: profile.id,
    batch_id: requestId,
    source_name: sr.source,
    jobs_returned: sr.jobs.length,
    jobs_after_dedupe: afterDedupe,
    success: !sr.error,
    error_message: sr.error || null,
    duration_ms: sr.duration_ms,
    request_id: requestId,
  }));

  await service.from("job_fetch_logs").insert(logRows);

  // Update last_fetch_at on profile
  await service
    .from("profiles")
    .update({ last_fetch_at: new Date().toISOString() })
    .eq("id", profile.id);

  return {
    requestId,
    searchTerms,
    sourceResults: sourceResults.map((sr) => ({
      source: sr.source,
      count: sr.jobs.length,
      duration_ms: sr.duration_ms,
      error: sr.error,
    })),
    totalRaw,
    afterDedupe,
    afterFilter,
    jobsDelivered: enriched.length,
    duration_ms: Date.now() - pipelineStart,
  };
}

/** Filter out jobs the user has already dismissed, promoted, or has in inbox */
async function filterExistingJobs(
  jobs: RawJob[],
  profileId: string,
  service: SupabaseClient<Database>,
): Promise<RawJob[]> {
  if (jobs.length === 0) return [];

  const urls = jobs.map((j) => j.url).filter(Boolean);

  // Get dismissed URLs
  const { data: dismissed } = await service
    .from("dismissed_jobs")
    .select("url")
    .eq("profile_id", profileId)
    .in("url", urls);

  const dismissedUrls = new Set((dismissed ?? []).map((d) => d.url));

  // Get tracker URLs
  const { data: tracked } = await service
    .from("tracker_entries")
    .select("url")
    .eq("profile_id", profileId)
    .in("url", urls);

  const trackedUrls = new Set((tracked ?? []).map((t) => t.url));

  // Get current inbox URLs
  const { data: inboxed } = await service
    .from("inbox_jobs")
    .select("url")
    .eq("profile_id", profileId)
    .in("url", urls);

  const inboxUrls = new Set((inboxed ?? []).map((i) => i.url));

  return jobs.filter(
    (j) => j.url && !dismissedUrls.has(j.url) && !trackedUrls.has(j.url) && !inboxUrls.has(j.url),
  );
}
