function fetchFromSource_(source, term) {
  const s = String(source || "").toLowerCase().trim();
  const t = String(term || "").trim();

  if (s === "remotive") return fetchRemotive_(t);
  if (s === "remoteok") return fetchRemoteOK_(t);

  // Feature flags for future sources live here
  throw new Error("Unknown source: " + source);
}

function fetchRemotive_(term) {
  const url = "https://remotive.com/api/remote-jobs?search=" + encodeURIComponent(term);
  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true
  });

  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("Remotive HTTP " + code);

  const json = JSON.parse(resp.getContentText());
  const jobs = Array.isArray(json.jobs) ? json.jobs : [];

  return jobs.map(j => ({
    title: String(j.title || ""),
    company: String(j.company_name || j.company || ""),
    url: String(j.url || ""),
    source: "remotive",
    location: String(j.candidate_required_location || j.location || "") || null,
    salary: parseSalary_(j.salary),
    description: String(j.description || ""),
    remote: true,
    tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
    raw: j
  })).filter(j => j.title && j.company && j.url);
}

function fetchRemoteOK_(term) {
  // RemoteOK doesn’t reliably support free-text search; tags are more consistent.
  // We still pass term as a tag-ish string.
  const tag = String(term || "").toLowerCase().replace(/\s+/g, "-");
  const url = "https://remoteok.com/api?tag=" + encodeURIComponent(tag);

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      "User-Agent": "Sygnalist/" + Sygnalist_VERSION + " (Apps Script)"
    }
  });

  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("RemoteOK HTTP " + code);

  const arr = JSON.parse(resp.getContentText());
  if (!Array.isArray(arr)) return [];

  // RemoteOK returns a first element that’s metadata. Jobs follow.
  const jobs = arr.slice(1);

  return jobs.map(j => ({
    title: String(j.position || j.title || ""),
    company: String(j.company || ""),
    url: String(j.url || j.apply_url || ""),
    source: "remoteok",
    location: String(j.location || "") || null,
    salary: {
      min: j.salary_min ? Number(j.salary_min) : null,
      max: j.salary_max ? Number(j.salary_max) : null,
      currency: j.currency ? String(j.currency) : null
    },
    description: String(j.description || ""),
    remote: j.location ? (String(j.location).toLowerCase().includes("remote") ? true : null) : null,
    tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
    raw: j
  })).filter(j => j.title && j.company && j.url);
}

function parseSalary_(salaryStr) {
  const s = String(salaryStr || "").trim();
  if (!s) return { min: null, max: null, currency: null };

  // Keep it dumb/simple for v1: store as unknown numeric
  // Later we can do real parsing.
  return { min: null, max: null, currency: null };
}
