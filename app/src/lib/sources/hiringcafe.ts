import type { RawJob, SourceResult, FetchContext } from "./types";

/** Extract a clean origin label from the apply URL domain */
function extractOriginLabel(applyUrl: string | undefined): string {
  if (!applyUrl) return "direct";
  try {
    const hostname = new URL(applyUrl).hostname.replace(/^www\./, "");
    if (hostname.includes("greenhouse.io")) return "greenhouse";
    if (hostname.includes("lever.co")) return "lever";
    if (hostname.includes("workday.com") || hostname.includes("myworkdayjobs.com")) return "workday";
    if (hostname.includes("smartrecruiters.com")) return "smartrecruiters";
    if (hostname.includes("icims.com")) return "icims";
    if (hostname.includes("ashbyhq.com")) return "ashby";
    if (hostname.includes("breezy.hr")) return "breezy";
    if (hostname.includes("jobvite.com")) return "jobvite";
    if (hostname.includes("taleo.net")) return "taleo";
    if (hostname.includes("bamboohr.com")) return "bamboohr";
    if (hostname.includes("recruitee.com")) return "recruitee";
    if (hostname.includes("jazz.co") || hostname.includes("applytojob.com")) return "jazzhr";
    // Fallback: second-level domain
    const parts = hostname.split(".");
    return parts.length >= 2 ? parts[parts.length - 2] : "direct";
  } catch {
    return "direct";
  }
}

/** Normalize workplace_type to remote/hybrid/onsite/null */
function normalizeWorkMode(type: string | undefined | null): string | null {
  if (!type) return null;
  const lower = type.toLowerCase();
  if (lower.includes("remote")) return "remote";
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("onsite") || lower.includes("on-site") || lower.includes("on site")) return "onsite";
  return null;
}

/** hiring.cafe — AI-powered job aggregator (scrapes employer career pages) */
export async function fetchHiringCafe(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];

  try {
    const res = await fetch("https://hiring.cafe/api/search-jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Origin: "https://hiring.cafe",
        Referer: "https://hiring.cafe/",
      },
      body: JSON.stringify({
        searchQuery: ctx.searchTerms.slice(0, 3).join(" "),
        location: ctx.location || undefined,
        dateFetchedPastNDays: 14,
        sortBy: "relevance",
        size: 50,
        page: 0,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { source: "hiringcafe", jobs: [], error: `HTTP ${res.status}`, duration_ms: Date.now() - start };
    }

    const data = await res.json();
    const hits = data?.hits?.hits ?? [];

    for (const hit of hits) {
      const s = hit._source;
      if (!s?.apply_url) continue;

      const salaryMin = s.salary_min;
      const salaryMax = s.salary_max;
      let salary: string | null = null;
      if (salaryMin && salaryMax) {
        salary = `$${Number(salaryMin).toLocaleString()} - $${Number(salaryMax).toLocaleString()}`;
      } else if (salaryMin) {
        salary = `$${Number(salaryMin).toLocaleString()}+`;
      } else if (salaryMax) {
        salary = `Up to $${Number(salaryMax).toLocaleString()}`;
      }

      jobs.push({
        title: s.title ?? "",
        company: s.company ?? s.company_name ?? "Unknown",
        url: s.apply_url,
        location: s.location ?? null,
        salary,
        work_mode: normalizeWorkMode(s.workplace_type),
        source: extractOriginLabel(s.apply_url),
        description_snippet: (s.description_clean ?? s.description_raw ?? "").slice(0, 300),
      });
    }
  } catch {
    // Timeout or network error — silent, same as other sources
  }

  return { source: "hiringcafe", jobs, duration_ms: Date.now() - start };
}
