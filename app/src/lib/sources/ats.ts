import type { RawJob, SourceResult, FetchContext } from "./types";

const API_KEY = process.env.RAPIDAPI_KEY;
const HOST = process.env.RAPIDAPI_HOST_ATS ?? "active-jobs-db.p.rapidapi.com";

/** ATS — Direct from company career pages (Greenhouse, Lever, Workday, etc.) via RapidAPI. */
export async function fetchATS(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  if (!API_KEY) {
    return { source: "ats", jobs: [], error: "Missing RapidAPI key", duration_ms: 0 };
  }

  const jobs: RawJob[] = [];

  for (const term of ctx.searchTerms.slice(0, 3)) {
    try {
      const params = new URLSearchParams({
        title_filter: term,
        limit: "20",
        offset: "0",
        description_type: "text",
      });
      if (ctx.location) {
        params.set("location_filter", ctx.location);
      }

      const res = await fetch(`https://${HOST}/active-ats-7d?${params}`, {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": HOST,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      const items = data.data ?? data.jobs ?? data.results ?? (Array.isArray(data) ? data : []);

      for (const j of items) {
        const url = j.url || j.link || j.apply_url || j.job_url;
        if (!url) continue;

        const title = j.title || j.job_title || j.name || j.position || "";
        const company = j.company || j.company_name || j.employer || "";
        if (!title && !company) continue;

        const loc = j.location || j.place || null;

        let salary: string | null = null;
        if (j.salary && typeof j.salary === "object" && (j.salary.min || j.salary.max)) {
          const min = j.salary.min ? `$${Number(j.salary.min).toLocaleString()}` : "";
          const max = j.salary.max ? `$${Number(j.salary.max).toLocaleString()}` : "";
          salary = min && max ? `${min} - ${max}` : min || max;
        }

        jobs.push({
          title,
          company: company || "Unknown",
          url,
          location: loc,
          salary,
          work_mode: j.remote || j.is_remote || (loc && /remote/i.test(loc)) ? "remote" : null,
          source: "ats",
          description_snippet: (j.description || j.desc || j.summary || "").slice(0, 300),
        });
      }
    } catch {
      // Skip failed term
    }
  }

  return { source: "ats", jobs, duration_ms: Date.now() - start };
}
