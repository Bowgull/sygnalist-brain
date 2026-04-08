import type { RawJob, SourceResult, FetchContext } from "./types";

/** RemoteOK - free remote job API, no auth required */
export async function fetchRemoteOK(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];

  for (const term of ctx.searchTerms.slice(0, 3)) {
    try {
      const tag = term.toLowerCase().replace(/\s+/g, "-");

      const res = await fetch(`https://remoteok.com/api?tag=${encodeURIComponent(tag)}`, {
        headers: { "User-Agent": "Sygnalist/1.0" },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      // First element is metadata/legal notice — skip it
      const listings = Array.isArray(data) ? data.slice(1) : [];

      for (const j of listings) {
        if (!j.url) continue;
        const salary =
          j.salary_min && j.salary_max
            ? `$${Number(j.salary_min).toLocaleString()} - $${Number(j.salary_max).toLocaleString()}`
            : null;

        jobs.push({
          title: j.position ?? "",
          company: j.company ?? "Unknown",
          url: j.url,
          location: j.location || "Remote",
          salary,
          work_mode: "remote",
          source: "remoteok",
          description_snippet: (j.description ?? "").replace(/<[^>]*>/g, "").slice(0, 300),
        });
      }
    } catch {
      // Timeout or network error — skip term
    }
  }

  return { source: "remoteok", jobs, duration_ms: Date.now() - start };
}
