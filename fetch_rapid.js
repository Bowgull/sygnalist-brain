/****************************************************
 * fetch_rapid.js
 * RapidAPI LinkedIn + ATS providers (secondary fallback only).
 * Credentials: Script Properties RAPIDAPI_KEY, RAPIDAPI_HOST_LINKEDIN, RAPIDAPI_HOST_ATS.
 * Only called from fetch_enriched when jobs.length < RAPID_GATE_MIN_CANDIDATES.
 ****************************************************/

function getRapidApiKey_() {
  return PropertiesService.getScriptProperties().getProperty("RAPIDAPI_KEY") || null;
}

function getRapidHost_(which) {
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
 * Build UrlFetchApp request for LinkedIn active jobs (last 1h).
 * opts: { limit, offset }
 */
function buildRapidLinkedInRequest_(opts) {
  var key = getRapidApiKey_();
  var host = getRapidHost_("LINKEDIN");
  if (!key || !host) return null;
  var limit = (opts && typeof opts.limit === "number") ? Math.min(100, Math.max(1, opts.limit)) : 20;
  var offset = (opts && typeof opts.offset === "number") ? Math.max(0, opts.offset) : 0;
  var url = "https://" + host + "/active-jb-1h?limit=" + limit + "&offset=" + offset + "&description_type=text";
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
 * Build UrlFetchApp request for ATS active/expired jobs.
 */
function buildRapidATSRequest_() {
  var key = getRapidApiKey_();
  var host = getRapidHost_("ATS");
  if (!key || !host) return null;
  var url = "https://" + host + "/active-ats-expired";
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
 * Normalize a single LinkedIn API item to internal job shape.
 */
function normalizeLinkedInJob_(raw) {
  if (!raw || typeof raw !== "object") return null;
  var title = String(raw.title || raw.job_title || raw.name || "").trim();
  var company = String(raw.company_name || raw.company || raw.employer || "").trim();
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
 * Fetch LinkedIn active jobs (1h). Returns normalized job array; empty if key/host missing or request fails.
 * Applies CONFIG.RAPID_LINKEDIN_MAX cap.
 * Return shape: { jobs: Array, rawCount: number, parsedCount: number, rejectedCount: number }
 * for logging; callers should use .jobs for the array.
 */
function fetchRapidLinkedInActive1h_(opts) {
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
 * Fetch ATS active/expired jobs. Returns normalized job array; empty if key/host missing or request fails.
 * Applies CONFIG.RAPID_ATS_MAX cap.
 * Return shape: { jobs: Array, rawCount: number, parsedCount: number, rejectedCount: number }
 */
function fetchRapidATSActiveExpired_() {
  if (typeof checkRapidApiQuota_ === "function" && !checkRapidApiQuota_().allowed) {
    return { jobs: [], rawCount: 0, parsedCount: 0, rejectedCount: 0, quotaExceeded: true };
  }
  var req = buildRapidATSRequest_();
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
