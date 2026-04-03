import type { RawJob, SourceResult, FetchContext } from "./types";

const API_KEY = process.env.RAPIDAPI_KEY;
const HOST = process.env.RAPIDAPI_HOST_JSEARCH ?? "active-jobs-db.p.rapidapi.com";

export async function fetchJSearch(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  if (!API_KEY) {
    return { source: "jsearch", jobs: [], error: "Missing RapidAPI key", duration_ms: 0 };
  }

  const jobs: RawJob[] = [];

  for (const term of ctx.searchTerms) {
    try {
      const query = ctx.location ? `${term} in ${ctx.location}` : term;
      const params = new URLSearchParams({
        query,
        page: "1",
        num_pages: "1",
      });

      const res = await fetch(`https://${HOST}/active-ats-7d?${params}`, {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": HOST,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const j of data.data ?? []) {
        if (!j.job_apply_link && !j.job_google_link) continue;
        jobs.push({
          title: j.job_title ?? "",
          company: j.employer_name ?? "Unknown",
          url: j.job_apply_link ?? j.job_google_link ?? "",
          location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || null,
          salary: j.job_min_salary && j.job_max_salary
            ? `$${j.job_min_salary.toLocaleString()} - $${j.job_max_salary.toLocaleString()}`
            : null,
          work_mode: j.job_is_remote ? "remote" : null,
          source: "jsearch",
          description_snippet: (j.job_description ?? "").slice(0, 300),
        });
      }
    } catch {
      // Skip failed term
    }
  }

  return { source: "jsearch", jobs, duration_ms: Date.now() - start };
}
