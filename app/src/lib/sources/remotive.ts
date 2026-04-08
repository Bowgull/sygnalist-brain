import type { RawJob, SourceResult, FetchContext } from "./types";

/** Remotive - free remote job API, no auth required */
export async function fetchRemotive(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];

  for (const term of ctx.searchTerms.slice(0, 3)) {
    try {
      const params = new URLSearchParams({ search: term, limit: "50" });

      const res = await fetch(`https://remotive.com/api/remote-jobs?${params}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const j of data.jobs ?? []) {
        if (!j.url) continue;
        jobs.push({
          title: j.title ?? "",
          company: j.company_name ?? "Unknown",
          url: j.url,
          location: j.candidate_required_location || "Remote",
          salary: j.salary || null,
          work_mode: "remote",
          source: "remotive",
          description_snippet: (j.description ?? "").replace(/<[^>]*>/g, "").slice(0, 300),
        });
      }
    } catch {
      // Timeout or network error — skip term
    }
  }

  return { source: "remotive", jobs, duration_ms: Date.now() - start };
}
