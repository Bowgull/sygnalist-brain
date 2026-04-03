/** Normalized job from any source */
export interface RawJob {
  title: string;
  company: string;
  url: string;
  location: string | null;
  salary: string | null;
  work_mode: string | null;
  source: string;
  description_snippet: string | null;
}

export interface SourceResult {
  source: string;
  jobs: RawJob[];
  error?: string;
  duration_ms: number;
}

export interface FetchContext {
  searchTerms: string[];
  location: string;
  country: string;
}
