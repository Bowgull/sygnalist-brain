import type { RawJob, SourceResult, FetchContext } from "./types";

/** Himalayas.app - free remote job board API */
export async function fetchHimalayas(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];

  try {
    const params = new URLSearchParams({ limit: "50" });
    const queryParts = ctx.searchTerms.slice(0, 3);
    if (ctx.country) {
      queryParts.push(ctx.country);
    }
    if (queryParts.length > 0) {
      params.set("q", queryParts.join(" "));
    }

    const res = await fetch(`https://himalayas.app/jobs/api?${params}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { source: "himalayas", jobs: [], error: `HTTP ${res.status}`, duration_ms: Date.now() - start };
    }

    const data = await res.json();

    for (const j of data.jobs ?? []) {
      if (!j.applicationLink && !j.externalUrl) continue;
      jobs.push({
        title: j.title ?? "",
        company: j.companyName ?? "Unknown",
        url: j.applicationLink ?? j.externalUrl ?? "",
        location: j.locationRestrictions?.join(", ") ?? "Remote",
        salary: j.minSalary && j.maxSalary
          ? `$${j.minSalary.toLocaleString()} - $${j.maxSalary.toLocaleString()}`
          : null,
        work_mode: "remote",
        source: "himalayas",
        description_snippet: (j.excerpt ?? j.description ?? "").slice(0, 300),
      });
    }
  } catch {
    // Timeout or network error
  }

  return { source: "himalayas", jobs, duration_ms: Date.now() - start };
}
