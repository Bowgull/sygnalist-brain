import type { RawJob, SourceResult, FetchContext } from "./types";

/** Map common search terms to valid TheMuse category values */
const CATEGORY_MAP: Record<string, string> = {
  // Engineering / Tech
  "software engineer": "Engineering",
  "software developer": "Engineering",
  developer: "Engineering",
  engineer: "Engineering",
  engineering: "Engineering",
  frontend: "Engineering",
  backend: "Engineering",
  "full stack": "Engineering",
  devops: "Engineering",
  sre: "Engineering",
  // Data
  data: "Data and Analytics",
  "data analyst": "Data and Analytics",
  "data scientist": "Data and Analytics",
  "data engineer": "Data and Analytics",
  analytics: "Data and Analytics",
  // Design
  design: "Design and UX",
  designer: "Design and UX",
  ux: "Design and UX",
  "ux designer": "Design and UX",
  "product designer": "Design and UX",
  // Product
  "product manager": "Product",
  "product management": "Product",
  product: "Product",
  // Project Management
  "project manager": "Project Management",
  "project management": "Project Management",
  scrum: "Project Management",
  // Marketing
  marketing: "Marketing and PR",
  "content marketing": "Marketing and PR",
  seo: "Marketing and PR",
  // Sales / Account
  sales: "Sales",
  "account executive": "Account Management",
  "account manager": "Account Management",
  "customer success": "Account Management",
  // Operations
  operations: "Business Operations",
  "business operations": "Business Operations",
  // HR
  hr: "Human Resources",
  recruiter: "Human Resources",
  recruiting: "Human Resources",
  // Finance
  finance: "Finance",
  accounting: "Finance",
  // Education
  education: "Education",
  // Healthcare
  healthcare: "Healthcare",
};

/** Resolve search terms to TheMuse categories. Returns unique category names. */
function resolveCategories(terms: string[]): string[] {
  const categories = new Set<string>();
  for (const term of terms) {
    const lower = term.toLowerCase();
    // Direct match
    if (CATEGORY_MAP[lower]) {
      categories.add(CATEGORY_MAP[lower]);
      continue;
    }
    // Partial match — check if any key is contained in the term
    for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
      if (lower.includes(key) || key.includes(lower)) {
        categories.add(cat);
        break;
      }
    }
  }
  return [...categories];
}

/** TheMuse - free public job API, no auth required */
export async function fetchTheMuse(ctx: FetchContext): Promise<SourceResult> {
  const start = Date.now();
  const jobs: RawJob[] = [];

  const categories = resolveCategories(ctx.searchTerms);

  // Fallback: if no categories matched, use broad ones
  if (categories.length === 0) {
    categories.push("Business Operations", "Sales");
  }

  for (const category of categories.slice(0, 4)) {
    try {
      const params = new URLSearchParams({
        page: "0",
        descending: "true",
        category,
      });

      if (ctx.location) {
        params.set("location", ctx.location);
      }

      const res = await fetch(`https://www.themuse.com/api/public/jobs?${params}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const j of data.results ?? []) {
        const url = j.refs?.landing_page;
        if (!url) continue;

        const locations = (j.locations ?? [])
          .map((l: { name?: string }) => l.name)
          .filter(Boolean)
          .join(", ");

        jobs.push({
          title: j.name ?? "",
          company: j.company?.name ?? "Unknown",
          url,
          location: locations || null,
          salary: null,
          work_mode: locations.toLowerCase().includes("remote") ? "remote" : null,
          source: "themuse",
          description_snippet: (j.contents ?? "").replace(/<[^>]*>/g, "").slice(0, 300),
        });
      }
    } catch {
      // Timeout or network error — skip category
    }
  }

  return { source: "themuse", jobs, duration_ms: Date.now() - start };
}
