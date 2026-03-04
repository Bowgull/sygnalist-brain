/**
 * gmail_ingest.js
 * Ingest job links from Gmail newsletters. Newsletter-agnostic URL extraction.
 * Admin-only trigger; no CRON, onEdit, or onOpen.
 */

var GMAIL_INGEST_BATCH_CAP = 25;

var SOURCE_DOMAIN_MAP = {
  "linkedin.com": "LinkedIn",
  "indeed.com": "Indeed",
  "greenhouse.io": "Greenhouse",
  "lever.co": "Lever",
  "workday.com": "Workday",
  "ashbyhq.com": "Ashby",
  "breezy.hr": "Breezy",
  "jobvite.com": "Jobvite",
  "icims.com": "iCIMS",
  "smartrecruiters.com": "SmartRecruiters",
  "myworkdayjobs.com": "Workday",
  "jobs.lever.co": "Lever",
  "boards.greenhouse.io": "Greenhouse"
};

var EXCLUDED_URL_PATTERNS = [
  /unsubscribe/i, /privacy/i, /terms/i, /settings/i, /preferences/i,
  /app\.apple\.com/i, /play\.google\.com/i, /mailto:/i, /tel:/i,
  /facebook\.com/i, /twitter\.com/i, /linkedin\.com\/(company|in)\//i,
  /youtube\.com/i, /instagram\.com/i, /tiktok\.com/i,
  /\/settings\//i, /\/unsubscribe\//i, /\/privacy\//i, /\/terms\//i
];

/** Anchor text suggesting list/settings/footer links — ingest as OUTLIER for review. */
var OUTLIER_ANCHOR_PATTERNS = [
  /^(view all|manage|similar jobs|unsubscribe|manage\s*(my\s*)?alerts|email preferences)/i,
  /see\s+(all|more)\s+(jobs|positions)/i,
  /view\s+all\s+similar/i,
  /^(apply\s+now|click\s+here|learn\s+more|read\s+more|sign\s+up|get\s+started)$/i
];

/** Title text suggesting non-job pages (support, feedback, forms) — route to Outliers. */
var OUTLIER_TITLE_PATTERNS = [
  /^unknown\s*title$/i,
  /report\s+(a\s+)?problem/i,
  /modify\s+(this\s+)?alert/i,
  /^(feedback|support|contact\s+us|help|faq)$/i,
  /^(sign\s+in|log\s+in|create\s+account|register)$/i,
  /^(privacy|terms\s+of\s+use|cookie\s+policy|manage\s+preferences)$/i,
  /^(unsubscribe|email\s+preferences|manage\s+your\s+alerts)$/i,
  /provide\s+feedback/i,
  /report\s+or\s+provide/i
];

function ingestJobsFromGmail_() {
  ensureJobsInboxSheet_();
  var existingUrls = getExistingNormalizedUrlsForIngest_();

  var out = {
    messages_scanned: 0,
    messages_labeled_ingested: 0,
    jobs_added: 0,
    jobs_skipped_duplicate: 0,
    messages_no_jobs_found: 0,
    errors: [],
    more_remaining: false,
    threads_found: 0
  };

  var query = "label:SYGN_INTAKE -label:SYGN_INGESTED newer_than:30d";
  var threads = GmailApp.search(query, 0, GMAIL_INGEST_BATCH_CAP + 1);
  out.threads_found = threads.length;
  if (threads.length > GMAIL_INGEST_BATCH_CAP) out.more_remaining = true;

  if (typeof logEvent_ === "function") {
    try {
      logEvent_({
        timestamp: Date.now(),
        profileId: "—",
        action: "admin",
        source: "gmail_ingest",
        details: { level: "INFO", message: "Gmail ingest started", meta: { threads_found: out.threads_found } }
      });
    } catch (logErr) { /* ignore */ }
  }

  var threadsToProcess = threads.slice(0, GMAIL_INGEST_BATCH_CAP);

  var ingestedLabel = GmailApp.getUserLabelByName("SYGN_INGESTED");
  if (!ingestedLabel) ingestedLabel = GmailApp.createLabel("SYGN_INGESTED");

  var intakeLabel = GmailApp.getUserLabelByName("SYGN_INTAKE");

  for (var t = 0; t < threadsToProcess.length; t++) {
    var thread = threadsToProcess[t];
    var msgs = thread.getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var msg = msgs[m];
      out.messages_scanned++;
      try {
        var extracted = extractJobLinksFromMessage_(msg);
        if (!extracted || extracted.length === 0) {
          out.messages_no_jobs_found++;
          continue;
        }

        var batchRows = [];
        var added = 0;
        var skipped = 0;
        var msgDate = (msg.getDate && typeof msg.getDate === "function") ? msg.getDate() : new Date();
        for (var i = 0; i < extracted.length; i++) {
          var job = extracted[i];
          var norm = normalizeUrlForJobsInbox_(job.url);
          if (!norm) { skipped++; continue; }
          if (existingUrls[norm]) {
            skipped++;
            out.jobs_skipped_duplicate++;
            continue;
          }

          var row = {
            job_id: "job_" + Utilities.getUuid().slice(0, 8),
            created_at: new Date(),
            email_received_at: msgDate instanceof Date ? msgDate : new Date(),
            title: job.title || "Unknown Title",
            source: job.source || inferSourceFromDomain_(job.url),
            url: job.url,
            enrichment_status: (job.isOutlier ? "OUTLIER" : "NEW"),
            missing_fields: "",
            role_id: "",
            promoted_at: "",
            notes: "",
            company: "",
            location: "",
            work_mode: "",
            job_family: "",
            description_snippet: "",
            job_summary: "",
            why_fit: ""
          };
          row.missing_fields = computeMissingFields_(row);

          batchRows.push(row);
          existingUrls[norm] = true;
          added++;
          out.jobs_added++;
        }

        if (batchRows.length > 0) {
          writeJobsInboxRows_(batchRows);
        }

        if (added > 0) {
          msg.addLabel(ingestedLabel);
          out.messages_labeled_ingested++;
        }
      } catch (err) {
        out.errors.push("Msg " + (out.messages_scanned) + ": " + (err.message || String(err)));
        if (typeof logEvent_ === "function") {
          try {
            logEvent_({
              timestamp: Date.now(),
              profileId: "—",
              action: "admin",
              source: "gmail_ingest",
              details: { level: "ERROR", message: "Gmail ingest error", meta: { message: err.message || String(err) } }
            });
          } catch (logErr) { /* ignore */ }
        }
      }
    }
    thread.addLabel(ingestedLabel);
    if (intakeLabel) thread.removeLabel(intakeLabel);
  }

  if (typeof logEvent_ === "function") {
    try {
      logEvent_({
        timestamp: Date.now(),
        profileId: "—",
        action: "admin",
        source: "gmail_ingest",
        details: {
          level: "INFO",
          message: "Gmail ingest completed",
          meta: {
            messages_scanned: out.messages_scanned,
            jobs_added: out.jobs_added,
            jobs_skipped_duplicate: out.jobs_skipped_duplicate,
            messages_no_jobs_found: out.messages_no_jobs_found,
            errors_count: (out.errors && out.errors.length) ? out.errors.length : 0
          }
        }
      });
    } catch (logErr) { /* ignore */ }
  }

  return out;
}

function extractJobLinksFromMessage_(msg) {
  var jobs = [];
  var seen = {};

  var subject = msg.getSubject() || "";
  if (/SYGN_INTAKE\s*\|/i.test(subject)) {
    var subjMatch = subject.match(/SYGN_INTAKE\s*\|\s*([^|]*)\|\s*(https?:\/\/[^\s|]+)/i);
    if (subjMatch) {
      var url = String(subjMatch[2] || "").trim();
      var title = String(subjMatch[1] || "").trim() || "Unknown Title";
      if (url && !isExcludedUrl_(url)) {
        var norm = normalizeUrlForJobsInbox_(url);
        if (norm) {
          seen[norm] = true;
          var isOutlier = isOutlierUrl_(url) || isOutlierTitle_(title);
          jobs.push({ url: url, title: title, source: inferSourceFromDomain_(url), isOutlier: !!isOutlier });
        }
      }
    }
  }

  var plain = "";
  var html = "";
  try { plain = msg.getPlainBody() || ""; } catch (e) { /* use "" */ }
  try { html = msg.getBody() || ""; } catch (e) { /* use "" */ }
  var combined = (html || "") + "\n" + (plain || "");
  if (combined.length > 250000) combined = combined.slice(0, 250000);

  var hrefRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var match;
  while ((match = hrefRegex.exec(combined)) !== null) {
    var url = String(match[1] || "").trim();
    var anchorText = String((match[2] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).trim();
    if (!url || url.indexOf("http") !== 0) continue;
    if (isExcludedUrl_(url)) continue;

    var norm = normalizeUrlForJobsInbox_(url);
    if (!norm || seen[norm]) continue;
    seen[norm] = true;

    var title = anchorText || getNearbyText_(combined, match.index) || "Unknown Title";
    var isOutlier = isOutlierAnchor_(anchorText) || isOutlierUrl_(url) || isOutlierTitle_(title);
    jobs.push({
      url: url,
      title: title,
      source: inferSourceFromDomain_(url),
      isOutlier: !!isOutlier
    });
  }

  if (jobs.length === 0) {
    var urlRegex = /https?:\/\/[^\s<>"'\])]+/g;
    var uMatch;
    while ((uMatch = urlRegex.exec(combined)) !== null) {
      var u = String(uMatch[0] || "").trim();
      if (!u || isExcludedUrl_(u)) continue;
      var n = normalizeUrlForJobsInbox_(u);
      if (!n || seen[n]) continue;
      seen[n] = true;
      var title = getNearbyText_(combined, uMatch.index) || "Unknown Title";
      var isOutlier = isOutlierUrl_(u) || isOutlierTitle_(title);
      jobs.push({
        url: u,
        title: title,
        source: inferSourceFromDomain_(u),
        isOutlier: !!isOutlier
      });
    }
  }

  return jobs;
}

function isExcludedUrl_(url) {
  var u = String(url || "").toLowerCase();
  for (var i = 0; i < EXCLUDED_URL_PATTERNS.length; i++) {
    if (EXCLUDED_URL_PATTERNS[i].test(u)) return true;
  }
  return false;
}

/** Returns true if anchor text suggests list/settings/footer link — route to Outliers. */
function isOutlierAnchor_(anchorText) {
  if (!anchorText || typeof anchorText !== "string") return false;
  var a = String(anchorText).trim();
  if (!a) return false;
  for (var i = 0; i < OUTLIER_ANCHOR_PATTERNS.length; i++) {
    if (OUTLIER_ANCHOR_PATTERNS[i].test(a)) return true;
  }
  return false;
}

/** Returns true if title suggests non-job page (support, feedback, form) — route to Outliers. */
function isOutlierTitle_(title) {
  if (title == null) return true;
  var t = String(title).trim();
  if (!t) return true;
  var lower = t.toLowerCase();
  for (var i = 0; i < OUTLIER_TITLE_PATTERNS.length; i++) {
    if (OUTLIER_TITLE_PATTERNS[i].test(lower)) return true;
  }
  return false;
}

/** Returns true if URL looks like search/list/support page — route to Outliers. Conservative. */
function isOutlierUrl_(url) {
  if (!url || typeof url !== "string") return false;
  var u = String(url || "").toLowerCase();
  if (/\/search\b/i.test(u)) return true;
  if (/\/list\b/i.test(u)) return true;
  if (/\/alerts\b/i.test(u)) return true;
  if (/\/jobs\s*$/i.test(u)) return true;
  if (/\/positions\s*$/i.test(u)) return true;
  if (/\/(support|feedback|report|contact|help|faq)(\/|$|\?)/i.test(u)) return true;
  return false;
}

function getNearbyText_(html, startIndex) {
  if (!html || startIndex < 0) return "";
  var before = html.slice(Math.max(0, startIndex - 200), startIndex);
  var after = html.slice(startIndex, Math.min(html.length, startIndex + 200));
  var chunk = before + after;
  chunk = chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  var lines = chunk.split(/\s{2,}|\n/);
  var best = "";
  for (var i = 0; i < lines.length; i++) {
    var line = String(lines[i] || "").trim();
    if (line.length < 10 || line.length > 120) continue;
    if (/^https?:\/\//i.test(line) || /\b(\.com|\.org|\.net)\b/i.test(line)) continue;
    if (isOutlierAnchor_(line)) continue;
    if (/^(apply|view|see|click|learn|read|sign|get)\s+/i.test(line) && line.length < 25) continue;
    if (!best || line.length > best.length) best = line;
  }
  return best;
}

function inferSourceFromDomain_(url) {
  try {
    var u = String(url || "").toLowerCase();
    if (u.indexOf("http") !== 0) return "";
    var domain = u.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
    for (var d in SOURCE_DOMAIN_MAP) {
      if (domain.indexOf(d) !== -1) return SOURCE_DOMAIN_MAP[d];
    }
  } catch (e) {}
  return "";
}
