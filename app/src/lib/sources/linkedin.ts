import type { RawJob, SourceResult, FetchContext } from "./types";

const API_KEY = process.env.RAPIDAPI_KEY;
const HOST = process.env.RAPIDAPI_HOST_LINKEDIN ?? "linkedin-job-search-api.p.rapidapi.com";

export async function fetchLinkedIn(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  if (!API_KEY) {
    return { source: "linkedin", jobs: [], error: "Missing RapidAPI key", duration_ms: 0 };
  }

  const jobs: RawJob[] = [];

  for (const term of ctx.searchTerms) {
    try {
      const params = new URLSearchParams({
        keywords: term,
        locationId: "",
        datePosted: "pastWeek",
        sort: "mostRelevant",
      });
      if (ctx.location) params.set("locationId", ctx.location);

      const res = await fetch(`https://${HOST}/active-jb-7d?${params}`, {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": HOST,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const j of data.data ?? data ?? []) {
        if (!j.url && !j.jobUrl) continue;
        jobs.push({
          title: j.title ?? j.jobTitle ?? "",
          company: j.company ?? j.companyName ?? "Unknown",
          url: j.url ?? j.jobUrl ?? "",
          location: j.location ?? j.jobLocation ?? null,
          salary: j.salary ?? null,
          work_mode: (j.workType ?? j.title ?? "").toLowerCase().includes("remote") ? "remote" : null,
          source: "linkedin",
          description_snippet: (j.description ?? "").slice(0, 300),
        });
      }
    } catch {
      // Skip failed term
    }
  }

  return { source: "linkedin", jobs, duration_ms: Date.now() - start };
}
