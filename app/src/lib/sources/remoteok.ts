import type { RawJob, SourceResult, FetchContext } from "./types";

/** Map common search terms to valid RemoteOK tag slugs */
const TAG_MAP: Record<string, string> = {
  // Engineering / Dev
  "software engineer": "dev",
  "software developer": "dev",
  developer: "dev",
  engineer: "dev",
  engineering: "dev",
  "full stack": "full-stack",
  frontend: "frontend",
  "front end": "frontend",
  backend: "backend",
  "back end": "backend",
  devops: "devops",
  sre: "devops",
  // Languages / Frameworks
  javascript: "javascript",
  typescript: "javascript",
  python: "python",
  react: "react",
  node: "nodejs",
  golang: "golang",
  go: "golang",
  rust: "rust",
  java: "java",
  ruby: "ruby",
  // Data
  data: "data",
  "data analyst": "data",
  "data scientist": "data",
  "data engineer": "data",
  analytics: "data",
  "machine learning": "machine-learning",
  ai: "machine-learning",
  // Design
  design: "design",
  designer: "design",
  ux: "design",
  "product designer": "design",
  // Product / Management
  "product manager": "product",
  product: "product",
  // Marketing / Sales
  marketing: "marketing",
  sales: "sales",
  "account executive": "sales",
  "account manager": "sales",
  "customer success": "customer-support",
  support: "customer-support",
  // Other
  finance: "finance",
  hr: "hr",
  recruiter: "hr",
  writing: "copywriting",
  copywriting: "copywriting",
};

/** Resolve search terms to RemoteOK tags. Falls back to general feed. */
function resolveTags(terms: string[]): string[] {
  const tags = new Set<string>();
  for (const term of terms) {
    const lower = term.toLowerCase();
    if (TAG_MAP[lower]) {
      tags.add(TAG_MAP[lower]);
      continue;
    }
    for (const [key, tag] of Object.entries(TAG_MAP)) {
      if (lower.includes(key) || key.includes(lower)) {
        tags.add(tag);
        break;
      }
    }
  }
  return [...tags];
}

/** RemoteOK - free remote job API, no auth required */
export async function fetchRemoteOK(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];
  const seenUrls = new Set<string>();

  const tags = resolveTags(ctx.searchTerms);

  // If no tags matched, fetch the general feed
  if (tags.length === 0) {
    tags.push("");
  }

  for (const tag of tags.slice(0, 3)) {
    try {
      const url = tag
        ? `https://remoteok.com/api?tag=${encodeURIComponent(tag)}`
        : "https://remoteok.com/api";

      const res = await fetch(url, {
        headers: { "User-Agent": "Sygnalist/1.0" },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      // First element is metadata/legal notice — skip it
      const listings = Array.isArray(data) ? data.slice(1) : [];

      for (const j of listings) {
        if (!j.url || seenUrls.has(j.url)) continue;
        seenUrls.add(j.url);

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
      // Timeout or network error — skip tag
    }
  }

  return { source: "remoteok", jobs, duration_ms: Date.now() - start };
}
