import type { RawJob, SourceResult, FetchContext } from "./types";

const API_KEY = process.env.JOOBLE_API_KEY;

export async function fetchJooble(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  if (!API_KEY) {
    return { source: "jooble", jobs: [], error: "Missing API key", duration_ms: 0 };
  }

  const jobs: RawJob[] = [];

  for (const term of ctx.searchTerms) {
    try {
      const res = await fetch(`https://jooble.org/api/${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: term,
          location: ctx.location || undefined,
          page: 1,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const j of data.jobs ?? []) {
        if (!j.link) continue;
        jobs.push({
          title: j.title ?? "",
          company: j.company ?? "Unknown",
          url: j.link,
          location: j.location ?? null,
          salary: j.salary ?? null,
          work_mode: j.type?.toLowerCase().includes("remote") ? "remote" : null,
          source: "jooble",
          description_snippet: (j.snippet ?? "").slice(0, 300),
        });
      }
    } catch {
      // Skip failed term
    }
  }

  return { source: "jooble", jobs, duration_ms: Date.now() - start };
}
