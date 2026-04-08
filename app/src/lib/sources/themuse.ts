import type { RawJob, SourceResult, FetchContext } from "./types";

/** TheMuse - free public job API, no auth required */
export async function fetchTheMuse(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];

  for (const term of ctx.searchTerms.slice(0, 3)) {
    try {
      const params = new URLSearchParams({
        page: "0",
        descending: "true",
      });
      // TheMuse uses "category" for filtering; pass search term there
      params.set("category", term);

      const res = await fetch(`https://www.themuse.com/api/public/jobs?${params}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const j of data.results ?? []) {
        const url = j.refs?.landing_page;
        if (!url) continue;

        const locations = (j.locations ?? [])
          .map((l: { name?: string }) => l.name)
          .filter(Boolean)
          .join(", ");

        jobs.push({
          title: j.name ?? "",
          company: j.company?.name ?? "Unknown",
          url,
          location: locations || null,
          salary: null,
          work_mode: locations.toLowerCase().includes("remote") ? "remote" : null,
          source: "themuse",
          description_snippet: (j.contents ?? "").replace(/<[^>]*>/g, "").slice(0, 300),
        });
      }
    } catch {
      // Timeout or network error — skip term
    }
  }

  return { source: "themuse", jobs, duration_ms: Date.now() - start };
}
