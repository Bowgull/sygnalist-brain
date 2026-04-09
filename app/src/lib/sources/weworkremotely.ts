import type { RawJob, SourceResult, FetchContext } from "./types";

/** Category slugs for WeWorkRemotely RSS feeds */
const CATEGORY_MAP: Record<string, string> = {
  programming: "remote-programming-jobs",
  design: "remote-design-jobs",
  marketing: "remote-copywriting-jobs",
  sales: "remote-sales-jobs",
  "customer support": "remote-customer-support-jobs",
  finance: "remote-finance-and-legal-jobs",
  "product management": "remote-product-jobs",
  devops: "remote-devops-sysadmin-jobs",
  "project management": "remote-project-management-jobs",
};

/** Simple XML text extractor — pulls content between a given tag */
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

/** Extract all occurrences of a tag from XML */
function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push((m[1] ?? m[2] ?? "").trim());
  }
  return results;
}

/** Detect work mode from title/description text */
function detectWorkMode(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("on-site") || lower.includes("onsite")) return "onsite";
  return "remote";
}

/** WeWorkRemotely — free RSS feed, no auth required */
export async function fetchWeWorkRemotely(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];
  const seenUrls = new Set<string>();

  // Map search terms to RSS category feeds
  const categoriesToFetch = new Set<string>();
  for (const term of ctx.searchTerms.slice(0, 4)) {
    const termLower = term.toLowerCase();
    for (const [keyword, slug] of Object.entries(CATEGORY_MAP)) {
      if (termLower.includes(keyword) || keyword.includes(termLower)) {
        categoriesToFetch.add(slug);
      }
    }
  }

  // Fallback: if no categories matched, use programming + product
  if (categoriesToFetch.size === 0) {
    categoriesToFetch.add("remote-programming-jobs");
  }

  for (const category of categoriesToFetch) {
    try {
      const res = await fetch(`https://weworkremotely.com/categories/${category}.rss`, {
        headers: { "User-Agent": "Sygnalist/1.0" },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const xml = await res.text();

      // Split by <item> tags
      const items = xml.split("<item>").slice(1);

      for (const item of items.slice(0, 25)) {
        const title = extractTag(item, "title");
        const link = extractTag(item, "link");
        const description = extractTag(item, "description");

        if (!link || seenUrls.has(link)) continue;
        seenUrls.add(link);

        // Extract company from title format "Company: Job Title"
        const colonIdx = title.indexOf(":");
        const company = colonIdx > 0 ? title.slice(0, colonIdx).trim() : "Unknown";
        const jobTitle = colonIdx > 0 ? title.slice(colonIdx + 1).trim() : title;

        // Extract region tags if present
        const regions = extractAllTags(item, "region");
        const location = regions.length > 0 ? regions.join(", ") : "Remote";

        jobs.push({
          title: jobTitle,
          company,
          url: link,
          location,
          salary: null,
          work_mode: detectWorkMode(title + " " + description),
          source: "weworkremotely",
          description_snippet: description.replace(/<[^>]*>/g, "").slice(0, 300),
        });
      }
    } catch {
      // Timeout or network error — skip category
    }
  }

  return { source: "weworkremotely", jobs, duration_ms: Date.now() - start };
}
