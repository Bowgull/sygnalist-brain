import type { RawJob, SourceResult, FetchContext } from "./types";

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;

const COUNTRY_MAP: Record<string, string> = {
  US: "us", CA: "ca", GB: "gb", AU: "au", DE: "de", FR: "fr",
  "United States": "us", Canada: "ca", "United Kingdom": "gb",
};

export async function fetchAdzuna(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  if (!APP_ID || !APP_KEY) {
    return { source: "adzuna", jobs: [], error: "Missing API credentials", duration_ms: 0 };
  }

  const country = COUNTRY_MAP[ctx.country] ?? "us";
  const jobs: RawJob[] = [];

  for (const term of ctx.searchTerms) {
    try {
      const params = new URLSearchParams({
        app_id: APP_ID,
        app_key: APP_KEY,
        results_per_page: "25",
        what: term,
        content_type: "application/json",
      });
      if (ctx.location) params.set("where", ctx.location);

      const res = await fetch(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!res.ok) continue;
      const data = await res.json();

      for (const r of data.results ?? []) {
        jobs.push({
          title: r.title ?? "",
          company: r.company?.display_name ?? "Unknown",
          url: r.redirect_url ?? r.adref ?? "",
          location: r.location?.display_name ?? null,
          salary: r.salary_min && r.salary_max
            ? `$${Math.round(r.salary_min).toLocaleString()} - $${Math.round(r.salary_max).toLocaleString()}`
            : r.salary_min
              ? `$${Math.round(r.salary_min).toLocaleString()}+`
              : null,
          work_mode: null,
          source: "adzuna",
          description_snippet: (r.description ?? "").slice(0, 300),
        });
      }
    } catch {
      // Skip failed term
    }
  }

  return { source: "adzuna", jobs, duration_ms: Date.now() - start };
}
