/****************************************************
 * fetch_adapters.js
 * Job board API adapters + parallel fetch support
 * Sources: remotive, remoteok, jooble, adzuna_us, adzuna_ca, usajobs
 ****************************************************/

function fetchFromSource_(source, term) {
  const s = String(source || "").toLowerCase().trim();
  const t = String(term || "").trim();

  if (s === "remotive") return fetchRemotive_(t);
  if (s === "remoteok") return fetchRemoteOK_(t);
  if (s === "jooble") return fetchJooble_(t);
  if (s === "adzuna_us") return fetchAdzuna_(t, "us");
  if (s === "adzuna_ca") return fetchAdzuna_(t, "ca");
  if (s === "usajobs") return fetchUSAJobs_(t);

  throw new Error("Unknown source: " + source);
}

// ─── Remotive ─────────────────────────────────────────────────────────────
function fetchRemotive_(term) {
  const url = "https://remotive.com/api/remote-jobs?search=" + encodeURIComponent(term);
  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true
  });
  return parseRemotiveResponse_(resp);
}

function buildRemotiveRequest_(term) {
  return {
    url: "https://remotive.com/api/remote-jobs?search=" + encodeURIComponent(term),
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true,
    timeout: 12
  };
}

function parseRemotiveResponse_(resp) {
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) return [];
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

// ─── RemoteOK ─────────────────────────────────────────────────────────────
function fetchRemoteOK_(term) {
  const tag = String(term || "").toLowerCase().replace(/\s+/g, "-");
  const url = "https://remoteok.com/api?tag=" + encodeURIComponent(tag);
  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "Sygnalist/" + Sygnalist_VERSION + " (Apps Script)" }
  });
  return parseRemoteOKResponse_(resp);
}

function buildRemoteOKRequest_(term) {
  const tag = String(term || "").toLowerCase().replace(/\s+/g, "-");
  return {
    url: "https://remoteok.com/api?tag=" + encodeURIComponent(tag),
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { "User-Agent": "Sygnalist/" + Sygnalist_VERSION + " (Apps Script)" }
  };
}

function parseRemoteOKResponse_(resp) {
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) return [];
  const arr = JSON.parse(resp.getContentText());
  if (!Array.isArray(arr)) return [];
  const jobs = arr.slice(1);
  return jobs.map(j => ({
    title: String(j.position || j.title || ""),
    company: String(j.company || ""),
    url: String(j.url || j.apply_url || ""),
    source: "remoteok",
    location: String(j.location || "") || null,
    salary: { min: j.salary_min ? Number(j.salary_min) : null, max: j.salary_max ? Number(j.salary_max) : null, currency: j.currency ? String(j.currency) : null },
    description: String(j.description || ""),
    remote: true,
    tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
    raw: j
  })).filter(j => j.title && j.company && j.url);
}

// ─── Jooble (aggregates Indeed, Monster, Glassdoor, etc.) ──────────────────
function fetchJooble_(term, location) {
  const key = getOptionalAPIKey_("JOOBLE_API_KEY");
  if (!key) return [];
  const req = buildJoobleRequest_(term, location || "United States", key);
  const resp = UrlFetchApp.fetch(req.url, req);
  return parseJoobleResponse_(resp);
}

function buildJoobleRequest_(term, location, apiKey) {
  return {
    url: "https://jooble.org/api/" + apiKey,
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      keywords: String(term || "").trim(),
      location: String(location || "United States").trim(),
      page: 1
    }),
    muteHttpExceptions: true,
    timeout: 12
  };
}

function parseJoobleResponse_(resp) {
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) return [];
  let json;
  try {
    json = JSON.parse(resp.getContentText());
  } catch (e) {
    return [];
  }
  const jobs = Array.isArray(json.jobs) ? json.jobs : [];
  return jobs.map(j => ({
    title: String(j.title || ""),
    company: String(j.company || ""),
    url: String(j.link || j.url || ""),
    source: "jooble",
    location: String(j.location || "").trim() || null,
    salary: parseSalary_(j.salary),
    description: String(j.snippet || j.description || ""),
    remote: null,
    tags: [],
    raw: j
  })).filter(j => j.title && j.company && j.url);
}

// ─── Adzuna (US + Canada) ──────────────────────────────────────────────────
function fetchAdzuna_(term, country) {
  const appId = getOptionalAPIKey_("ADZUNA_APP_ID");
  const appKey = getOptionalAPIKey_("ADZUNA_APP_KEY");
  if (!appId || !appKey) return [];
  const req = buildAdzunaRequest_(term, country, appId, appKey);
  const resp = UrlFetchApp.fetch(req.url, req);
  return parseAdzunaResponse_(resp, country);
}

function buildAdzunaRequest_(term, country, appId, appKey) {
  const c = String(country || "us").toLowerCase();
  return {
    url: "https://api.adzuna.com/v1/api/jobs/" + c + "/search/1" +
      "?app_id=" + encodeURIComponent(appId) + "&app_key=" + encodeURIComponent(appKey) +
      "&what=" + encodeURIComponent(String(term || "").trim()) +
      "&results_per_page=25",
    method: "get",
    muteHttpExceptions: true
  };
}

function parseAdzunaResponse_(resp, country) {
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) return [];
  let json;
  try {
    json = JSON.parse(resp.getContentText());
  } catch (e) {
    return [];
  }
  const results = json.results || [];
  const src = "adzuna_" + (String(country || "us").toLowerCase());
  return results.map(j => {
    var salary = { min: null, max: null, currency: null };
    if (j.salary_min != null || j.salary_max != null) {
      salary.min = j.salary_min != null ? Number(j.salary_min) : null;
      salary.max = j.salary_max != null ? Number(j.salary_max) : null;
      salary.currency = (j.salary_currency && String(j.salary_currency).trim()) || "USD";
    } else if (j.salary_display && String(j.salary_display).trim()) {
      salary = parseSalary_(j.salary_display);
    }
    return {
      title: String(j.title || ""),
      company: String((j.company && j.company.display_name) || j.company_name || ""),
      url: String(j.redirect_url || j.url || ""),
      source: src,
      location: String((j.location && j.location.display_name) || j.location || "").trim() || null,
      salary: salary,
      description: String(j.description || ""),
      remote: null,
      tags: [],
      raw: j
    };
  }).filter(j => j.title && (j.company || j.url));
}

// ─── USAJobs (federal jobs; API key required - get free at developer.usajobs.gov)
function fetchUSAJobs_(term) {
  const key = getOptionalAPIKey_("USAJOBS_API_KEY");
  if (!key) return [];
  const req = buildUSAJobsRequest_(term, key);
  const resp = UrlFetchApp.fetch(req.url, req);
  return parseUSAJobsResponse_(resp);
}

function buildUSAJobsRequest_(term, apiKey) {
  var headers = { "User-Agent": "Sygnalist/" + Sygnalist_VERSION + " (job search)" };
  if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
  return {
    url: "https://data.usajobs.gov/api/search?Keyword=" + encodeURIComponent(String(term || "").trim()) + "&ResultsPerPage=25",
    method: "get",
    muteHttpExceptions: true,
    headers: headers,
    timeout: 12
  };
}

function parseUSAJobsResponse_(resp) {
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) return [];
  let json;
  try {
    json = JSON.parse(resp.getContentText());
  } catch (e) {
    return [];
  }
  const searchResult = json.SearchResult || {};
  const items = searchResult.SearchResultItems || [];
  return items.map(item => {
    const d = item.MatchedObjectDescriptor || {};
    const locs = d.PositionLocation || [];
    const locStr = locs.length ? (locs[0].CityName + ", " + locs[0].StateCode).trim() : "";
    const summary = (d.UserArea && d.UserArea.Details && d.UserArea.Details.JobSummary) || "";
    return {
      title: String(d.PositionTitle || ""),
      company: String(d.OrganizationName || ""),
      url: String(d.ApplyURI || d.PositionURI || ""),
      source: "usajobs",
      location: locStr || null,
      salary: parseSalary_(null),
      description: String(summary || ""),
      remote: null,
      tags: [],
      raw: item
    };
  }).filter(j => j.title && j.company && j.url);
}

// ─── Parallel fetch: build all requests ───────────────────────────────────
function buildParallelFetchRequests_(plan, profile) {
  const out = [];
  const sources = plan.sources || [];
  const terms = plan.searchTerms || [];
  const location = (profile.preferredLocations && profile.preferredLocations[0]) ? String(profile.preferredLocations[0]) : "United States";

  // #region agent log - DEBUG: which keys are set (no values)
  var keysStatus = {
    jooble: !!getOptionalAPIKey_("JOOBLE_API_KEY"),
    adzuna: !!(getOptionalAPIKey_("ADZUNA_APP_ID") && getOptionalAPIKey_("ADZUNA_APP_KEY")),
    usajobs: !!getOptionalAPIKey_("USAJOBS_API_KEY")
  };
  if (typeof logEvent_ === "function") {
    logEvent_({
      timestamp: Date.now(),
      profileId: profile.profileId || null,
      action: "fetch_enriched",
      source: "debug",
      details: {
        level: "INFO",
        message: "API keys status",
        meta: keysStatus,
        version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "?"
      }
    });
  }
  // #endregion

  for (let si = 0; si < sources.length; si++) {
    const source = String(sources[si] || "").toLowerCase().trim();
    for (let ti = 0; ti < terms.length; ti++) {
      const term = String(terms[ti] || "").trim();
      if (!term) continue;

      let req = null;
      if (source === "remotive") {
        req = buildRemotiveRequest_(term);
      } else if (source === "remoteok") {
        req = buildRemoteOKRequest_(term);
      } else if (source === "jooble") {
        const key = getOptionalAPIKey_("JOOBLE_API_KEY");
        if (key) req = buildJoobleRequest_(term, location, key);
      } else if (source === "adzuna_us") {
        const appId = getOptionalAPIKey_("ADZUNA_APP_ID");
        const appKey = getOptionalAPIKey_("ADZUNA_APP_KEY");
        if (appId && appKey) req = buildAdzunaRequest_(term, "us", appId, appKey);
      } else if (source === "adzuna_ca") {
        const appId = getOptionalAPIKey_("ADZUNA_APP_ID");
        const appKey = getOptionalAPIKey_("ADZUNA_APP_KEY");
        if (appId && appKey) req = buildAdzunaRequest_(term, "ca", appId, appKey);
      } else if (source === "usajobs") {
        var usajobsKey = getOptionalAPIKey_("USAJOBS_API_KEY");
        if (usajobsKey) req = buildUSAJobsRequest_(term, usajobsKey);
      }

      if (req) out.push({ source: source, term: term, request: req });
    }
  }

  return out;
}

// ─── Parallel fetch: parse one response ────────────────────────────────────
function parseParallelFetchResponse_(resp, item) {
  const source = item.source || "";
  try {
    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) return [];
    if (source === "remotive") return parseRemotiveResponse_(resp);
    if (source === "remoteok") return parseRemoteOKResponse_(resp);
    if (source === "jooble") return parseJoobleResponse_(resp);
    if (source === "adzuna_us") return parseAdzunaResponse_(resp, "us");
    if (source === "adzuna_ca") return parseAdzunaResponse_(resp, "ca");
    if (source === "usajobs") return parseUSAJobsResponse_(resp);
  } catch (e) {
    return [];
  }
  return [];
}

/**
 * Parse salary string (e.g. "$68,000 - 90,000+", "£50k-60k") to { min, max, currency }.
 * Also accepts null/empty -> returns nulls.
 */
function parseSalary_(salaryStr) {
  const s = String(salaryStr || "").trim();
  if (!s) return { min: null, max: null, currency: null };
  var currency = "USD";
  if (/£/.test(s)) currency = "GBP";
  else if (/€/.test(s)) currency = "EUR";
  var numStr = s.replace(/[^\d.,\s\-–—]/g, " ").replace(/\s+/g, " ");
  var parts = numStr.split(/[\-–—]/).map(function (p) { return p.replace(/[,\s]/g, ""); }).filter(Boolean);
  var min = null, max = null;
  if (parts.length >= 2) {
    var a = parseInt(parts[0], 10);
    var b = parseInt(parts[1], 10);
    if (!isNaN(a) && !isNaN(b)) {
      min = Math.min(a, b);
      max = Math.max(a, b);
      if (min < 1000 && max < 1000 && (s.toLowerCase().indexOf("k") !== -1 || /000/.test(s))) {
        min = min * 1000;
        max = max * 1000;
      }
    }
  } else if (parts.length === 1) {
    var n = parseInt(parts[0], 10);
    if (!isNaN(n)) {
      if (s.toLowerCase().indexOf("k") !== -1 && n < 1000) n = n * 1000;
      min = n;
      max = n;
    }
  }
  return { min: min, max: max, currency: currency };
}













