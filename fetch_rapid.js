/****************************************************
 * fetch_rapid.js
 * RapidAPI LinkedIn + ATS + JSearch. JSearch is primary (no quota); LinkedIn/ATS secondary.
 * Credentials: Script Properties RAPIDAPI_KEY, RAPIDAPI_HOST_LINKEDIN, RAPIDAPI_HOST_ATS, RAPIDAPI_HOST_JSEARCH.
 * Only called from fetch_enriched when jobs.length < RAPID_GATE_MIN_CANDIDATES.
 ****************************************************/

function getRapidApiKey_() {
  return PropertiesService.getScriptProperties().getProperty("RAPIDAPI_KEY") || null;
}

function getRapidHost_(which) {
  if (which === "JSEARCH") {
    var host = PropertiesService.getScriptProperties().getProperty("RAPIDAPI_HOST_JSEARCH") || null;
    if (host) return host;
    return "jsearch.p.rapidapi.com";
  }
  var key = (which === "LINKEDIN") ? "RAPIDAPI_HOST_LINKEDIN" : "RAPIDAPI_HOST_ATS";
  var host = PropertiesService.getScriptProperties().getProperty(key) || null;
  if (host) return host;
  if (which === "LINKEDIN") return "linkedin-job-search-api.p.rapidapi.com";
  if (which === "ATS") return "active-jobs-db.p.rapidapi.com";
  return null;
}

var RAPID_QUOTA_KEYS = {
  DATE: "rapidapi_date",
  CALLS_TODAY: "rapidapi_calls_today",
  CALLS_MONTH: "rapidapi_calls_month",
  MONTH_KEY: "rapidapi_month_key"
};

/**
 * Check daily/monthly RapidAPI caps. Resets counters when date or month changes.
 * Returns { allowed: true } if under limit; { allowed: false } and logs when at limit.
 */
function checkRapidApiQuota_() {
  var maxDay = (typeof CONFIG !== "undefined" && typeof CONFIG.RAPID_MAX_CALLS_PER_DAY === "number")
    ? CONFIG.RAPID_MAX_CALLS_PER_DAY
    : 2;
  var maxMonth = (typeof CONFIG !== "undefined" && typeof CONFIG.RAPID_MAX_CALLS_PER_MONTH === "number")
    ? CONFIG.RAPID_MAX_CALLS_PER_MONTH
    : 25;
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone ? Session.getScriptTimeZone() : "UTC", "yyyy-MM-dd");
  var monthKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone ? Session.getScriptTimeZone() : "UTC", "yyyy-MM");
  var storedDate = props.getProperty(RAPID_QUOTA_KEYS.DATE) || "";
  var storedMonth = props.getProperty(RAPID_QUOTA_KEYS.MONTH_KEY) || "";
  var callsToday = parseInt(props.getProperty(RAPID_QUOTA_KEYS.CALLS_TODAY) || "0", 10);
  var callsMonth = parseInt(props.getProperty(RAPID_QUOTA_KEYS.CALLS_MONTH) || "0", 10);

  if (storedDate !== today) {
    callsToday = 0;
    props.setProperty(RAPID_QUOTA_KEYS.DATE, today);
    props.setProperty(RAPID_QUOTA_KEYS.CALLS_TODAY, "0");
  }
  if (storedMonth !== monthKey) {
    callsMonth = 0;
    props.setProperty(RAPID_QUOTA_KEYS.MONTH_KEY, monthKey);
    props.setProperty(RAPID_QUOTA_KEYS.CALLS_MONTH, "0");
  }

  if (callsToday >= maxDay || callsMonth >= maxMonth) {
    if (typeof Logger !== "undefined") Logger.log("RapidAPI skipped: daily/monthly limit reached.");
    return { allowed: false };
  }
  return { allowed: true };
}

/**
 * Increment RapidAPI usage by 1 (call after each successful LinkedIn or ATS request).
 */
function incrementRapidApiUsage_() {
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone ? Session.getScriptTimeZone() : "UTC", "yyyy-MM-dd");
  var monthKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone ? Session.getScriptTimeZone() : "UTC", "yyyy-MM");
  var storedDate = props.getProperty(RAPID_QUOTA_KEYS.DATE) || "";
  var storedMonth = props.getProperty(RAPID_QUOTA_KEYS.MONTH_KEY) || "";
  var callsToday = parseInt(props.getProperty(RAPID_QUOTA_KEYS.CALLS_TODAY) || "0", 10);
  var callsMonth = parseInt(props.getProperty(RAPID_QUOTA_KEYS.CALLS_MONTH) || "0", 10);

  if (storedDate !== today) { callsToday = 0; props.setProperty(RAPID_QUOTA_KEYS.DATE, today); }
  if (storedMonth !== monthKey) { callsMonth = 0; props.setProperty(RAPID_QUOTA_KEYS.MONTH_KEY, monthKey); }

  props.setProperty(RAPID_QUOTA_KEYS.CALLS_TODAY, String(callsToday + 1));
  props.setProperty(RAPID_QUOTA_KEYS.CALLS_MONTH, String(callsMonth + 1));
}

/**
 * Build UrlFetchApp request for LinkedIn active jobs (last 7 days).
 * opts: { limit, offset, title_filter?, location_filter? }
 */
function buildRapidLinkedInRequest_(opts) {
  var key = getRapidApiKey_();
  var host = getRapidHost_("LINKEDIN");
  if (!key || !host) return null;
  var limit = (opts && typeof opts.limit === "number") ? Math.min(100, Math.max(1, opts.limit)) : 20;
  var offset = (opts && typeof opts.offset === "number") ? Math.max(0, opts.offset) : 0;
  var url = "https://" + host + "/active-jb-7d?limit=" + limit + "&offset=" + offset + "&description_type=text";
  if (opts && typeof opts.title_filter === "string" && opts.title_filter.trim()) {
    url += "&title_filter=" + encodeURIComponent(opts.title_filter.trim());
  }
  if (opts && typeof opts.location_filter === "string" && opts.location_filter.trim()) {
    url += "&location_filter=" + encodeURIComponent(opts.location_filter.trim());
  }
  return {
    url: url,
    method: "get",
    muteHttpExceptions: true,
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": host
    },
    timeout: 15
  };
}

/**
 * Build UrlFetchApp request for ATS active jobs (last 7 days).
 * opts: { limit, offset, title_filter?, location_filter? }
 */
function buildRapidATSRequest_(opts) {
  var key = getRapidApiKey_();
  var host = getRapidHost_("ATS");
  if (!key || !host) return null;
  var limit = (opts && typeof opts.limit === "number") ? Math.min(100, Math.max(1, opts.limit)) : 20;
  var offset = (opts && typeof opts.offset === "number") ? Math.max(0, opts.offset) : 0;
  var url = "https://" + host + "/active-ats-7d?limit=" + limit + "&offset=" + offset + "&description_type=text";
  if (opts && typeof opts.title_filter === "string" && opts.title_filter.trim()) {
    url += "&title_filter=" + encodeURIComponent(opts.title_filter.trim());
  }
  if (opts && typeof opts.location_filter === "string" && opts.location_filter.trim()) {
    url += "&location_filter=" + encodeURIComponent(opts.location_filter.trim());
  }
  return {
    url: url,
    method: "get",
    muteHttpExceptions: true,
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": host
    },
    timeout: 15
  };
}

/**
 * Build UrlFetchApp request for JSearch search.
 * opts: { query (required), country?, page?, num_pages? }
 */
function buildRapidJSearchRequest_(opts) {
  var key = getRapidApiKey_();
  var host = getRapidHost_("JSEARCH");
  if (!key || !host) return null;
  var query = (opts && typeof opts.query === "string") ? opts.query.trim() : "";
  if (!query) return null;
  var country = (opts && typeof opts.country === "string" && opts.country.trim()) ? opts.country.trim() : "us";
  var page = (opts && typeof opts.page === "number") ? Math.max(1, opts.page) : 1;
  var numPages = (opts && typeof opts.num_pages === "number") ? Math.max(1, Math.min(10, opts.num_pages)) : 1;
  var url = "https://" + host + "/search?query=" + encodeURIComponent(query) + "&page=" + page + "&num_pages=" + numPages + "&country=" + encodeURIComponent(country) + "&date_posted=all";
  return {
    url: url,
    method: "get",
    muteHttpExceptions: true,
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": host
    },
    timeout: 15
  };
}

/**
 * Build UrlFetchApp request for JSearch job-details.
 */
function buildRapidJSearchJobDetailsRequest_(jobId, country) {
  var key = getRapidApiKey_();
  var host = getRapidHost_("JSEARCH");
  if (!key || !host || !jobId) return null;
  var c = (typeof country === "string" && country.trim()) ? country.trim() : "us";
  var url = "https://" + host + "/job-details?job_id=" + encodeURIComponent(String(jobId)) + "&country=" + encodeURIComponent(c);
  return {
    url: url,
    method: "get",
    muteHttpExceptions: true,
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": host
    },
    timeout: 15
  };
}

/**
 * Build UrlFetchApp request for JSearch estimated-salary.
 */
function buildRapidJSearchEstimatedSalaryRequest_(opts) {
  var key = getRapidApiKey_();
  var host = getRapidHost_("JSEARCH");
  if (!key || !host) return null;
  var jobTitle = (opts && typeof opts.job_title === "string") ? opts.job_title.trim() : "";
  var location = (opts && typeof opts.location === "string") ? opts.location.trim() : "United States";
  if (!jobTitle) return null;
  var url = "https://" + host + "/estimated-salary?job_title=" + encodeURIComponent(jobTitle) + "&location=" + encodeURIComponent(location) + "&location_type=ANY&years_of_experience=ALL";
  return {
    url: url,
    method: "get",
    muteHttpExceptions: true,
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": host
    },
    timeout: 15
  };
}
function normalizeLinkedInJob_(raw) {
  if (!raw || typeof raw !== "object") return null;
  var title = String(raw.title || raw.job_title || raw.name || "").trim();
  var company = String(raw.company_name || raw.company || raw.employer || raw.organization || "").trim();
  if (!title && !company) return null;
  var url = String(raw.url || raw.link || raw.apply_url || raw.job_url || "").trim();
  var desc = String(raw.description || raw.desc || raw.summary || "").trim();
  var loc = String(raw.location || raw.place || "").trim() || null;
  var postedAt = raw.posted_at || raw.postedAt || raw.date || null;
  var salary = null;
  if (raw.salary && typeof raw.salary === "object") {
    salary = {
      min: raw.salary.min != null ? Number(raw.salary.min) : null,
      max: raw.salary.max != null ? Number(raw.salary.max) : null,
      currency: raw.salary.currency ? String(raw.salary.currency) : "USD"
    };
  } else if (typeof raw.salary === "string" && raw.salary.trim()) {
    salary = { min: null, max: null, currency: "USD" };
  }
  return {
    title: title || "Untitled",
    company: company || "Unknown",
    url: url || null,
    source: "RAPID_LINKEDIN",
    location: loc,
    description: desc,
    salary: salary,
    postedAt: postedAt,
    remote: !!(raw.remote || raw.is_remote || (loc && /remote/i.test(loc))),
    raw: raw
  };
}

/**
 * Normalize a single ATS API item to internal job shape.
 */
function normalizeATSJob_(raw) {
  if (!raw || typeof raw !== "object") return null;
  var title = String(raw.title || raw.job_title || raw.name || raw.position || "").trim();
  var company = String(raw.company || raw.company_name || raw.employer || "").trim();
  if (!title && !company) return null;
  var url = String(raw.url || raw.link || raw.apply_url || raw.job_url || "").trim();
  var desc = String(raw.description || raw.desc || raw.summary || "").trim();
  var loc = String(raw.location || raw.place || "").trim() || null;
  var postedAt = raw.posted_at || raw.postedAt || raw.date || raw.created_at || null;
  var salary = null;
  if (raw.salary && typeof raw.salary === "object") {
    salary = {
      min: raw.salary.min != null ? Number(raw.salary.min) : null,
      max: raw.salary.max != null ? Number(raw.salary.max) : null,
      currency: raw.salary.currency ? String(raw.salary.currency) : "USD"
    };
  }
  return {
    title: title || "Untitled",
    company: company || "Unknown",
    url: url || null,
    source: "RAPID_ATS",
    location: loc,
    description: desc,
    salary: salary,
    postedAt: postedAt,
    remote: !!(raw.remote || raw.is_remote || (loc && /remote/i.test(loc))),
    raw: raw
  };
}

/**
 * Normalize a single JSearch API item to internal job shape.
 * JSearch fields: job_id, job_title, employer_name, job_apply_link, job_description, job_city, job_country, job_min_salary, job_max_salary, job_posted_at_timestamp, job_is_remote, etc.
 */
function normalizeJSearchJob_(raw) {
  if (!raw || typeof raw !== "object") return null;
  var title = String(raw.job_title || raw.title || raw.name || "").trim();
  var company = String(raw.employer_name || raw.company_name || raw.company || raw.employer || "").trim();
  if (!title && !company) return null;
  var url = String(raw.job_apply_link || raw.url || raw.link || raw.apply_url || "").trim();
  var desc = String(raw.job_description || raw.description || raw.desc || raw.summary || "").trim();
  var city = String(raw.job_city || raw.city || "").trim();
  var country = String(raw.job_country || raw.country || "").trim();
  var loc = [city, country].filter(Boolean).join(", ") || null;
  var postedAt = raw.job_posted_at_timestamp != null ? raw.job_posted_at_timestamp : (raw.posted_at || raw.postedAt || raw.date || null);
  var salary = null;
  if (raw.job_min_salary != null || raw.job_max_salary != null) {
    salary = {
      min: raw.job_min_salary != null ? Number(raw.job_min_salary) : null,
      max: raw.job_max_salary != null ? Number(raw.job_max_salary) : null,
      currency: (raw.job_salary_currency && String(raw.job_salary_currency).trim()) || "USD"
    };
  } else if (raw.salary && typeof raw.salary === "object") {
    salary = {
      min: raw.salary.min != null ? Number(raw.salary.min) : null,
      max: raw.salary.max != null ? Number(raw.salary.max) : null,
      currency: raw.salary.currency ? String(raw.salary.currency) : "USD"
    };
  }
  var remote = !!(raw.job_is_remote || raw.remote || raw.is_remote || (loc && /remote/i.test(loc)));
  var rawCopy = {};
  for (var k in raw) { if (raw.hasOwnProperty(k)) rawCopy[k] = raw[k]; }
  return {
    title: title || "Untitled",
    company: company || "Unknown",
    url: url || null,
    source: "RAPID_JSEARCH",
    location: loc,
    description: desc,
    salary: salary,
    postedAt: postedAt,
    remote: remote,
    raw: rawCopy
  };
}

/**
 * Fetch LinkedIn active jobs (7d). Returns normalized job array; empty if key/host missing or request fails.
 * Applies CONFIG.RAPID_LINKEDIN_MAX cap.
 * Return shape: { jobs: Array, rawCount: number, parsedCount: number, rejectedCount: number }
 * for logging; callers should use .jobs for the array.
 */
function fetchRapidLinkedInActive7d_(opts) {
  if (typeof checkRapidApiQuota_ === "function" && !checkRapidApiQuota_().allowed) {
    return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0, quotaExceeded: true };
  }
  var req = buildRapidLinkedInRequest_(opts || {});
  if (!req) return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0 };
  var limit = (typeof CONFIG !== "undefined" && typeof CONFIG.RAPID_LINKEDIN_MAX === "number")
    ? CONFIG.RAPID_LINKEDIN_MAX
    : 20;
  try {
    var resp = UrlFetchApp.fetch(req.url, {
      method: req.method,
      muteHttpExceptions: req.muteHttpExceptions,
      headers: req.headers,
      timeout: req.timeout
    });
    var httpStatus = resp.getResponseCode();
    if (httpStatus < 200 || httpStatus >= 300) {
      return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0, httpStatus: httpStatus };
    }
    var json = JSON.parse(resp.getContentText());
    var items = [];
    if (Array.isArray(json)) items = json;
    else if (json && Array.isArray(json.data)) items = json.data;
    else if (json && Array.isArray(json.jobs)) items = json.jobs;
    else if (json && Array.isArray(json.results)) items = json.results;
    else if (json && json.data && Array.isArray(json.data.jobs)) items = json.data.jobs;
    var out = [];
    for (var i = 0; i < items.length && out.length < limit; i++) {
      var job = normalizeLinkedInJob_(items[i]);
      if (job) out.push(job);
    }
    var rawCount = items.length;
    var parsedCount = out.length;
    var rejectedCount = rawCount - parsedCount;
    if (typeof incrementRapidApiUsage_ === "function") incrementRapidApiUsage_();
    return { jobs: out, rawCount: rawCount, parsedCount: parsedCount, rejectedCount: rejectedCount };
  } catch (e) {
    return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0, error: e.message };
  }
}

/**
 * Fetch ATS active jobs (7d). Returns normalized job array; empty if key/host missing or request fails.
 * Applies CONFIG.RAPID_ATS_MAX cap.
 * Return shape: { jobs: Array, rawCount: number, parsedCount: number, rejectedCount: number }
 */
function fetchRapidATSActive7d_(opts) {
  if (typeof checkRapidApiQuota_ === "function" && !checkRapidApiQuota_().allowed) {
    return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0, quotaExceeded: true };
  }
  var req = buildRapidATSRequest_(opts || {});
  if (!req) return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0 };
  var limit = (typeof CONFIG !== "undefined" && typeof CONFIG.RAPID_ATS_MAX === "number")
    ? CONFIG.RAPID_ATS_MAX
    : 20;
  try {
    var resp = UrlFetchApp.fetch(req.url, {
      method: req.method,
      muteHttpExceptions: req.muteHttpExceptions,
      headers: req.headers,
      timeout: req.timeout
    });
    var httpStatus = resp.getResponseCode();
    if (httpStatus < 200 || httpStatus >= 300) {
      return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0, httpStatus: httpStatus };
    }
    var json = JSON.parse(resp.getContentText());
    var items = [];
    if (Array.isArray(json)) items = json;
    else if (json && Array.isArray(json.data)) items = json.data;
    else if (json && Array.isArray(json.jobs)) items = json.jobs;
    else if (json && Array.isArray(json.results)) items = json.results;
    else if (json && json.data && Array.isArray(json.data.jobs)) items = json.data.jobs;
    var out = [];
    for (var j = 0; j < items.length && out.length < limit; j++) {
      var job = normalizeATSJob_(items[j]);
      if (job) out.push(job);
    }
    var rawCount = items.length;
    var parsedCount = out.length;
    var rejectedCount = rawCount - parsedCount;
    if (typeof incrementRapidApiUsage_ === "function") incrementRapidApiUsage_();
    return { jobs: out, rawCount: rawCount, parsedCount: parsedCount, rejectedCount: rejectedCount };
  } catch (e) {
    return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0, error: e.message };
  }
}

/**
 * Fetch JSearch jobs (search endpoint). No quota check or increment.
 * opts: { query (required), country?, page?, num_pages? }
 * Return shape: { jobs: Array, rawCount, parsedCount, rejectedCount, httpStatus? }
 */
function fetchRapidJSearch_(opts) {
  var req = buildRapidJSearchRequest_(opts || {});
  if (!req) return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0 };
  var limit = (typeof CONFIG !== "undefined" && typeof CONFIG.RAPID_JSEARCH_MAX === "number")
    ? CONFIG.RAPID_JSEARCH_MAX
    : 20;
  try {
    var resp = UrlFetchApp.fetch(req.url, {
      method: req.method,
      muteHttpExceptions: req.muteHttpExceptions,
      headers: req.headers,
      timeout: req.timeout
    });
    var httpStatus = resp.getResponseCode();
    if (httpStatus < 200 || httpStatus >= 300) {
      return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0, httpStatus: httpStatus };
    }
    var json = JSON.parse(resp.getContentText());
    var items = [];
    if (json && Array.isArray(json.data)) items = json.data;
    else if (Array.isArray(json)) items = json;
    else if (json && Array.isArray(json.jobs)) items = json.jobs;
    else if (json && Array.isArray(json.results)) items = json.results;
    var out = [];
    for (var i = 0; i < items.length && out.length < limit; i++) {
      var job = normalizeJSearchJob_(items[i]);
      if (job) out.push(job);
    }
    var rawCount = items.length;
    var parsedCount = out.length;
    var rejectedCount = rawCount - parsedCount;
    return { jobs: out, rawCount: rawCount, parsedCount: parsedCount, rejectedCount: rejectedCount };
  } catch (e) {
    return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0, error: e.message };
  }
}

/**
 * Fetch JSearch job details by job_id. No quota check.
 * Returns normalized job or null.
 */
function fetchRapidJSearchJobDetails_(jobId, country) {
  var req = buildRapidJSearchJobDetailsRequest_(jobId, country);
  if (!req) return null;
  try {
    var resp = UrlFetchApp.fetch(req.url, {
      method: req.method,
      muteHttpExceptions: req.muteHttpExceptions,
      headers: req.headers,
      timeout: req.timeout
    });
    if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) return null;
    var json = JSON.parse(resp.getContentText());
    var raw = (json && json.data) ? json.data : (typeof json === "object" ? json : null);
    return raw ? normalizeJSearchJob_(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch JSearch estimated salary. No quota check.
 * Returns { min, max, currency } or null.
 */
function fetchRapidJSearchEstimatedSalary_(jobTitle, location) {
  var opts = { job_title: jobTitle, location: location || "United States" };
  var req = buildRapidJSearchEstimatedSalaryRequest_(opts);
  if (!req) return null;
  try {
    var resp = UrlFetchApp.fetch(req.url, {
      method: req.method,
      muteHttpExceptions: req.muteHttpExceptions,
      headers: req.headers,
      timeout: req.timeout
    });
    if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) return null;
    var json = JSON.parse(resp.getContentText());
    var data = (json && json.data) ? json.data : (Array.isArray(json) ? json : null);
    var first = Array.isArray(data) && data.length > 0 ? data[0] : (data && typeof data === "object" ? data : null);
    if (!first) return null;
    var min = first.minimum_salary != null ? Number(first.minimum_salary) : (first.min != null ? Number(first.min) : null);
    var max = first.maximum_salary != null ? Number(first.maximum_salary) : (first.max != null ? Number(first.max) : null);
    var currency = (first.salary_currency && String(first.salary_currency).trim()) || (first.currency && String(first.currency).trim()) || "USD";
    if (min == null && max == null) return null;
    return { min: min, max: max, currency: currency };
  } catch (e) {
    return null;
  }
}
