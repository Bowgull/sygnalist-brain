import type { RawJob, SourceResult, FetchContext } from "./types";

/** Arbeitnow - free, no API key needed */
export async function fetchArbeitnow(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];

  try {
    const params = new URLSearchParams({ page: "1" });
    // Arbeitnow uses tag-based search
    if (ctx.searchTerms.length > 0) {
      params.set("tag", ctx.searchTerms[0]);
    }

    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?${params}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { source: "arbeitnow", jobs: [], error: `HTTP ${res.status}`, duration_ms: Date.now() - start };
    }

    const data = await res.json();

    for (const j of data.data ?? []) {
      if (!j.url) continue;
      jobs.push({
        title: j.title ?? "",
        company: j.company_name ?? "Unknown",
        url: j.url,
        location: j.location ?? null,
        salary: null,
        work_mode: j.remote ? "remote" : null,
        source: "arbeitnow",
        description_snippet: (j.description ?? "").replace(/<[^>]+>/g, "").slice(0, 300),
      });
    }
  } catch {
    // Timeout or network error
  }

  return { source: "arbeitnow", jobs, duration_ms: Date.now() - start };
}
