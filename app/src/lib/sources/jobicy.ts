import type { RawJob, SourceResult, FetchContext } from "./types";

/** Map common country names to Jobicy geo codes */
const GEO_MAP: Record<string, string> = {
  "United States": "usa", US: "usa",
  Canada: "canada", CA: "canada",
};

/** Jobicy - free remote job API, no auth required */
export async function fetchJobicy(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];

  for (const term of ctx.searchTerms.slice(0, 3)) {
    try {
      const params = new URLSearchParams({
        count: "20",
        tag: term,
      });

      const geo = GEO_MAP[ctx.country] ?? GEO_MAP[ctx.country?.toUpperCase() ?? ""];
      if (geo) {
        params.set("geo", geo);
      }

      const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?${params}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const j of data.jobs ?? []) {
        if (!j.url) continue;

        const salary =
          j.annualSalaryMin && j.annualSalaryMax
            ? `$${Number(j.annualSalaryMin).toLocaleString()} - $${Number(j.annualSalaryMax).toLocaleString()}`
            : null;

        jobs.push({
          title: j.jobTitle ?? "",
          company: j.companyName ?? "Unknown",
          url: j.url,
          location: j.jobGeo ?? "Remote",
          salary,
          work_mode: "remote",
          source: "jobicy",
          description_snippet: (j.jobExcerpt ?? j.jobDescription ?? "")
            .replace(/<[^>]*>/g, "")
            .slice(0, 300),
        });
      }
    } catch {
      // Timeout or network error — skip term
    }
  }

  return { source: "jobicy", jobs, duration_ms: Date.now() - start };
}
