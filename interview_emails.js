/****************************************************
 * interview_emails.js
 * When a Tracker entry moves into an Interview stage (via web app
 * status update), send admin alert (Email #1) with link; Email #2 (draft)
 * is sent only when the link is clicked. No AI; deterministic from whyFit/GoodFit.
 ****************************************************/

/**
 * Return the admin audit email address for interview emails. Uses CONFIG.ADMIN_AUDIT_EMAIL;
 * if missing, falls back to Session.getEffectiveUser().getEmail() and logs WARN.
 */
function getAdminAuditEmail_() {
  var addr = (typeof CONFIG !== "undefined" && CONFIG.ADMIN_AUDIT_EMAIL && String(CONFIG.ADMIN_AUDIT_EMAIL).trim())
    ? String(CONFIG.ADMIN_AUDIT_EMAIL).trim()
    : "";
  if (addr) return addr;
  try {
    var fallback = Session.getEffectiveUser().getEmail();
    if (fallback) {
      logEvent_({
        timestamp: Date.now(),
        profileId: "",
        action: "admin",
        source: "interview_email_alert",
        details: { level: "WARN", message: "ADMIN_AUDIT_EMAIL missing; using Session.getEffectiveUser()", meta: { toEmail: fallback }, version: Sygnalist_VERSION }
      });
      return fallback;
    }
  } catch (e) {}
  return "sygnalist.app@gmail.com"; // last-resort default
}

/**
 * Escape HTML special characters so dynamic content does not break markup.
 */
function escapeHtml_(s) {
  if (s == null || s === "") return "";
  var str = String(s);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Returns true if status is an Interview stage (tolerant of case/whitespace).
 */
function isInterviewStatus_(status) {
  var s = String(status || "").trim().toLowerCase();
  if (!s) return false;
  if (s.indexOf("interview") === 0) return true;
  if (s === "final interview" || s === "final round") return true;
  return false;
}

/**
 * Get admin email recipients. Only profiles with isAdmin=TRUE in Admin_Profiles.
 * Never uses CONFIG or Session fallback.
 */
function getAdminRecipients_() {
  var profiles = loadProfiles_();
  if (!profiles || !profiles.length) return [];
  return profiles
    .filter(function (p) { return p.isAdmin === true; })
    .map(function (p) { return String(p.email || "").trim(); })
    .filter(function (e) { return e.length > 0; });
}

/**
 * Count tracker rows for profile where status is Applied or beyond.
 */
function getAppliedCountForProfile_(profileId) {
  try {
    var rows = readEngineSheetForProfile_("Engine_Tracker", profileId);
    if (!rows || !rows.length) return "unknown";
    var count = 0;
    var statusesAtOrAfterApplied = ["Applied", "Interview 1", "Interview 2", "Final Round", "Offer 🎉"];
    for (var i = 0; i < rows.length; i++) {
      var o = rows[i];
      var c = (o && o._canon) || {};
      var s = String(o.status ?? c.status ?? "").trim();
      if (!s) continue;
      var lower = s.toLowerCase();
      var match = statusesAtOrAfterApplied.indexOf(s) !== -1 ||
        lower.indexOf("applied") === 0 ||
        lower.indexOf("interview") === 0 ||
        lower.indexOf("offer") !== -1;
      if (match) count++;
    }
    return count;
  } catch (e) {
    return "unknown";
  }
}

/**
 * Days using Sygnalist: no profile createdAt in repo; use "unknown".
 */
function getDaysUsingSygnalist_(profileId) {
  return "unknown";
}

/**
 * Count fetch actions for profile in Logs (total; sheet has no epoch for "before" cutoff).
 */
function getFetchCountForProfile_(profileId) {
  try {
    var sheet = assertSheetExists_("📓 Logs");
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;
    var values = sheet.getRange(2, 1, lastRow, 7).getValues();
    var pid = String(profileId || "").trim();
    var count = 0;
    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      var colProfile = row[2]; // column C, 0-based index 2
      var colAction = row[3];  // column D
      if (String(colProfile || "").trim() !== pid) continue;
      var action = String(colAction || "").toLowerCase();
      if (action.indexOf("fetch") !== -1) count++;
    }
    return count;
  } catch (e) {
    return "unknown";
  }
}

/**
 * Parse whyFit/goodFit into bullets (strip leading -, •, *, numbering).
 */
function parseBullets_(text) {
  if (!text || !String(text).trim()) return [];
  var lines = String(text).split(/\n/);
  var bullets = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^[\s\-•*\d.)]+/, "").trim();
    if (line) bullets.push(line);
  }
  return bullets;
}

var LEVERAGE_WORDS = ["led", "owned", "built", "shipped", "reduced", "improved", "delivered", "managed", "created", "launched", "designed", "implemented"];

/**
 * Select 2-3 bullets that look concrete (action/evidence); else first 2-3.
 */
function selectLeverageBullets_(bullets) {
  if (!bullets || !bullets.length) return [];
  var scored = [];
  for (var i = 0; i < bullets.length; i++) {
    var b = bullets[i];
    var lower = b.toLowerCase();
    var score = 0;
    for (var w = 0; w < LEVERAGE_WORDS.length; w++) {
      if (lower.indexOf(LEVERAGE_WORDS[w]) !== -1) score++;
    }
    if (/\d+/.test(b)) score++;
    scored.push({ text: b, score: score, idx: i });
  }
  scored.sort(function (a, b) { return (b.score - a.score) || (a.idx - b.idx); });
  var out = [];
  var max = Math.min(3, bullets.length);
  for (var j = 0; j < max && j < scored.length; j++) {
    out.push(scored[j].text);
  }
  return out;
}

/**
 * Select up to 2 bullets that look like risk/gap/test topics (for Email #2 draft).
 */
function selectRiskBullets_(bullets) {
  if (!bullets || !bullets.length) return [];
  var riskWords = ["gap", "risk", "they'll care", "they will care", "unclear", "missing", "lighter", "profile signal missing"];
  var out = [];
  for (var i = 0; i < bullets.length && out.length < 2; i++) {
    var lb = bullets[i].toLowerCase();
    for (var w = 0; w < riskWords.length; w++) {
      if (lb.indexOf(riskWords[w]) !== -1) {
        out.push(bullets[i].length > 120 ? bullets[i].substring(0, 117) + "..." : bullets[i]);
        break;
      }
    }
  }
  return out;
}

/**
 * Build 3 mock interview questions from bullets (deterministic, no AI).
 */
function buildMockQuestions_(bullets) {
  if (!bullets || bullets.length === 0) {
    return [
      "Walk me through a time you delivered a strong result. What was your role and what changed?",
      "Tell me about a time you owned an important responsibility. How did you approach it and what was the outcome?",
      "If you started tomorrow, what would your first 2–3 steps be to make progress?"
    ];
  }
  var b0 = bullets[0];
  var b1 = bullets.length > 1 ? bullets[1] : b0;
  var phrase0 = b0.split(/[,.]/)[0].trim();
  if (phrase0.length > 60) phrase0 = phrase0.substring(0, 57) + "...";
  var phrase1 = b1.split(/[,.]/)[0].trim();
  if (phrase1.length > 50) phrase1 = phrase1.substring(0, 47) + "...";
  var q1 = "Walk me through a time you " + phrase0.toLowerCase().replace(/^you\s+/, "") + ". What was your role and what changed because of it?";
  var q2 = "Tell me about a time you owned a key responsibility. How did you approach it and what was the outcome?";
  var riskBullet = null;
  for (var i = 0; i < bullets.length; i++) {
    var lb = bullets[i].toLowerCase();
    if (lb.indexOf("gap") !== -1 || lb.indexOf("risk") !== -1 || lb.indexOf("lighter") !== -1 || lb.indexOf("they'll care") !== -1 || lb.indexOf("they will care") !== -1) {
      riskBullet = bullets[i];
      break;
    }
  }
  var q3;
  if (riskBullet) {
    var area = riskBullet.split(/[,.]/)[0].trim();
    if (area.length > 40) area = area.substring(0, 37) + "...";
    q3 = "They're likely to test " + area + ". How would you handle it if it comes up?";
  } else {
    q3 = "If you started tomorrow, what would your first 2–3 steps be to make progress on " + (phrase1.length > 35 ? phrase1.substring(0, 32) + "..." : phrase1) + "?";
  }
  return [q1, q2, q3];
}

/**
 * Main: called when a tracker entry transitions into an Interview stage.
 * Sends Email #1 (admin alert with link) only. Email #2 is sent when the link is clicked.
 * profileId, trackerKey (url or company||title), context: { oldStatus, newStatus, transitionedAtMs }, opts: optional { row, appliedCount } from save path to avoid re-reading Engine_Tracker.
 */
function onMovedToInterview_(profileId, trackerKey, context, opts) {
  var oldStatus = context.oldStatus || "";
  var newStatus = context.newStatus || "";
  var transitionedAtMs = context.transitionedAtMs || Date.now();
  var logMeta = { profileId: profileId, trackerKey: String(trackerKey).substring(0, 80), oldStatus: oldStatus, newStatus: newStatus, transitionedAtMs: transitionedAtMs };
  var appliedCount = "unknown";
  var daysUsingSygnalist = "unknown";
  var fetchCountBeforeThisInterview = "unknown";

  try {
    var profile = getProfileByIdOrThrow_(profileId);
    var row = (opts && opts.row) ? opts.row : getTrackerRowByKey_(profileId, trackerKey);
    if (!row) {
      logEvent_({
        timestamp: Date.now(),
        profileId: profileId,
        action: "admin",
        source: "interview_email_alert",
        details: { level: "WARN", message: "Tracker row not found for interview email", meta: logMeta, version: Sygnalist_VERSION }
      });
      return;
    }

    var canonicalKey = (row.url && String(row.url).trim()) ? String(row.url).trim() : (String(row.company || "").trim().toLowerCase() + "||" + String(row.title || "").trim().toLowerCase());
    var cacheKey = "interview_email_sent:" + profileId + ":" + canonicalKey;
    try {
      var cache = CacheService.getScriptCache();
      if (cache.get(cacheKey)) return;
    } catch (cacheErr) { /* proceed to send if cache unavailable */ }

    var company = String(row.company || "").trim() || "—";
    var title = String(row.title || "").trim() || "—";
    var displayName = String(profile.displayName || profileId).trim() || profileId;
    var clientEmail = String(profile.email || "").trim() || "";

    if (opts && opts.appliedCount !== undefined) {
      appliedCount = opts.appliedCount;
    } else {
      appliedCount = getAppliedCountForProfile_(profileId);
    }
    daysUsingSygnalist = getDaysUsingSygnalist_(profileId);
    // Defer Logs read: use "unknown" on save path for faster Email #1
    logMeta.fetchCountFallback = true;

    var baseUrl = (typeof CONFIG !== "undefined" && CONFIG.WEB_APP_URL)
      ? String(CONFIG.WEB_APP_URL).split("?")[0]
      : "";
    var draftLink = baseUrl + "?mode=genInterviewDraft&profileId=" + encodeURIComponent(profileId) + "&trackerKey=" + encodeURIComponent(trackerKey);

    var toEmail = getAdminAuditEmail_();
    var subject1 = "Sygnal: Interview moved — " + company + " / " + title;
    var body1 =
      "Client: " + displayName + "\n" +
      "Client email: " + clientEmail + "\n" +
      "Role: " + title + " at " + company + "\n" +
      "Applied count: " + appliedCount + "\n" +
      "Days using Sygnalist: " + daysUsingSygnalist + "\n" +
      "Fetches before this interview: " + fetchCountBeforeThisInterview + "\n" +
      "\n" +
      "Generate draft: " + draftLink + "\n";

    MailApp.sendEmail(toEmail, subject1, body1, { name: "Sygnalist" });
    try { CacheService.getScriptCache().put(cacheKey, "1", 120); } catch (putErr) { /* ignore */ }
  } catch (e) {
    logEvent_({
      timestamp: Date.now(),
      profileId: profileId,
      action: "admin",
      source: "interview_email_alert",
      details: {
        level: "ERROR",
        message: "Interview email failed: " + (e && e.message ? e.message : String(e)),
        meta: Object.assign({}, logMeta, { appliedCount: appliedCount, daysUsingSygnalist: daysUsingSygnalist, fetchCountBeforeThisInterview: fetchCountBeforeThisInterview, toEmail: getAdminAuditEmail_() }),
        version: Sygnalist_VERSION
      }
    });
    return; // do not rethrow so tracker update still succeeds
  }

  var toEmail = getAdminAuditEmail_();
  logEvent_({
    timestamp: Date.now(),
    profileId: profileId,
    action: "admin",
    source: "interview_email_alert",
    details: {
      level: "INFO",
      message: "Interview alert sent",
      meta: Object.assign({}, logMeta, { appliedCount: appliedCount, daysUsingSygnalist: daysUsingSygnalist, fetchCountBeforeThisInterview: fetchCountBeforeThisInterview, toEmail: toEmail }),
      version: Sygnalist_VERSION
    }
  });
}

/**
 * Build Email #2 plain body and htmlBody from profile + tracker row. No send.
 * Applies trimStart guard to plain body. Returns { body2, body2Html }.
 */
function buildEmail2BodyFromRow_(profile, row) {
  var clientName = String(profile.displayName || profile.profileId || "").trim() || (profile.profileId || "");
  var role = String(row.title || "").trim() || "—";
  var company = String(row.company || "").trim() || "—";
  var fitSource = String(row.goodFit || "").trim() || String(row.whyFit || "").trim() || "Review Tracker for this role.";
  var bullets = parseBullets_(fitSource);
  var leverageBullets = selectLeverageBullets_(bullets);
  if (leverageBullets.length === 0) leverageBullets = ["Review whyFit/GoodFit in Tracker for this role."];
  var riskBullets = selectRiskBullets_(bullets);
  var questions = buildMockQuestions_(leverageBullets);
  var leverageLine1 = leverageBullets[0] || "";
  var leverageLine2 = leverageBullets[1] || "";
  var leverageLine3 = leverageBullets[2] || "";
  var riskLine1 = riskBullets[0] || "";
  var riskLine2 = riskBullets[1] || "";
  var q1 = questions[0] || "";
  var q2 = questions[1] || "";
  var q3 = questions[2] || "";
  var riskBlock = (riskLine1 || riskLine2)
    ? "\nSome more topics likely to be covered based on what I can find on the job:\n" + (riskLine1 ? riskLine1 + "\n\n" : "") + (riskLine2 ? riskLine2 + "\n" : "") + "\n"
    : "\n";
  var body2 =
    "Hey " + clientName + " —\n\n" +
    "Just saw you moved " + role + " at " + company + " to Interview! Love to see it.\n" +
    "That's a real sygnal. 📡\n\n" +
    "Here's what they'll probably poke at:\n" +
    (leverageLine1 ? "• " + leverageLine1 + "\n\n" : "") +
    (leverageLine2 ? "• " + leverageLine2 + "\n\n" : "") +
    (leverageLine3 ? "• " + leverageLine3 + "\n\n" : "") +
    riskBlock +
    "Next step, let's cook 👨🏾‍🍳 Get your answers down for these and we'll run a mock.\n\n" +
    (q1 ? "• " + q1 + "\n\n" : "") +
    (q2 ? "• " + q2 + "\n\n" : "") +
    (q3 ? "• " + q3 + "\n\n" : "") +
    "I don't want you walking in there freestyling and nervous. We set you up for success 💪🏾👑\n\n" +
    "Reply with times you're free and we'll lock in a mock 🔒📝\n\n" +
    "We'll run it like the real thing so you're calm instead of guessing.\n\n" +
    "That's wasn't luck friend, you did this. Major win 🚨 🔔\n\n" +
    "Josh";
  body2 = body2.split("\n").map(function (line) { return line.trimStart(); }).join("\n");
  var ulStyle = "list-style-position: outside; padding-left: 1.5em; margin: 0.5em 0 1em 0;";
  var liStyle = "margin-bottom: 0.6em;";
  var body2Html =
    "<p>Hey " + escapeHtml_(clientName) + " —</p>" +
    "<p>Just saw you moved " + escapeHtml_(role) + " at " + escapeHtml_(company) + " to Interview! Love to see it.</p>" +
    "<p>That's a real sygnal. 📡</p>" +
    "<p><strong>Here's what they'll probably poke at:</strong></p>" +
    "<ul style=\"" + ulStyle + "\">" +
    (leverageLine1 ? "<li style=\"" + liStyle + "\">" + escapeHtml_(leverageLine1) + "</li>" : "") +
    (leverageLine2 ? "<li style=\"" + liStyle + "\">" + escapeHtml_(leverageLine2) + "</li>" : "") +
    (leverageLine3 ? "<li style=\"" + liStyle + "\">" + escapeHtml_(leverageLine3) + "</li>" : "") +
    "</ul>" +
    (riskLine1 || riskLine2
      ? "<p><strong>Some more topics likely to be covered based on what I can find on the job:</strong></p><ul style=\"" + ulStyle + "\">" +
        (riskLine1 ? "<li style=\"" + liStyle + "\">" + escapeHtml_(riskLine1) + "</li>" : "") +
        (riskLine2 ? "<li style=\"" + liStyle + "\">" + escapeHtml_(riskLine2) + "</li>" : "") +
        "</ul>"
      : "") +
    "<p>Next step, let's cook 👨🏾‍🍳 Get your answers down for these and we'll run a mock.</p>" +
    "<ol style=\"" + ulStyle + "\">" +
    "<li style=\"" + liStyle + "\">" + escapeHtml_(q1) + "</li>" +
    "<li style=\"" + liStyle + "\">" + escapeHtml_(q2) + "</li>" +
    "<li style=\"" + liStyle + "\">" + escapeHtml_(q3) + "</li>" +
    "</ol>" +
    "<div style=\"margin-top: 1.5em;\">" +
    "<p>I don't want you walking in there freestyling and nervous. We set you up for success 💪🏾👑</p>" +
    "<p><strong>Reply with times you're free and we'll lock in a mock 🔒📝</strong></p>" +
    "<p>We'll run it like the real thing so you're calm instead of guessing.</p>" +
    "<p>That's wasn't luck friend, you did this. Major win 🚨 🔔</p>" +
    "</div>" +
    "<p>Josh</p>";
  return { body2: body2, body2Html: body2Html };
}

/**
 * Generate and send Email #2 (admin draft). Called when user clicks link in Email #1.
 * Uses GoodFit if present, else whyFit. No LLM; deterministic placeholders only.
 */
function generateAndSendInterviewDraftEmail_(profileId, trackerKey) {
  var usedSource = "whyfit";
  try {
    var profile = getProfileByIdOrThrow_(profileId);
    var row = getTrackerRowByKey_(profileId, trackerKey);
    if (!row) {
      logEvent_({
        timestamp: Date.now(),
        profileId: profileId,
        action: "admin",
        source: "interview_email_draft",
        details: { level: "WARN", message: "Tracker row not found for draft email", meta: { profileId: profileId, trackerKey: String(trackerKey).substring(0, 80) }, version: Sygnalist_VERSION }
      });
      throw new Error("Tracker row not found");
    }
    var goodFit = String(row.goodFit || "").trim();
    if (goodFit) usedSource = "goodfit";
    if (!goodFit && !String(row.whyFit || "").trim()) {
      logEvent_({
        timestamp: Date.now(),
        profileId: profileId,
        action: "admin",
        source: "interview_email_draft",
        details: { level: "WARN", message: "No whyFit/GoodFit for draft; using fallback", meta: { profileId: profileId, trackerKey: String(trackerKey).substring(0, 80) }, version: Sygnalist_VERSION }
      });
    }
    var bodies = buildEmail2BodyFromRow_(profile, row);
    var body2 = bodies.body2;
    var body2Html = bodies.body2Html;
    var clientName = String(profile.displayName || profileId).trim() || profileId;
    var toEmail = getAdminAuditEmail_();
    var subject2 = "DRAFT: Okayyy interview time 👀 — " + clientName;
    MailApp.sendEmail(toEmail, subject2, body2, { name: "Sygnalist", htmlBody: body2Html });

    logEvent_({
      timestamp: Date.now(),
      profileId: profileId,
      action: "admin",
      source: "interview_email_draft",
      details: { level: "INFO", message: "Interview draft sent", meta: { profileId: profileId, trackerKey: String(trackerKey).substring(0, 80), usedSource: usedSource, toEmail: toEmail }, version: Sygnalist_VERSION }
    });
  } catch (e) {
    logEvent_({
      timestamp: Date.now(),
      profileId: profileId,
      action: "admin",
      source: "interview_email_draft",
      details: { level: "ERROR", message: "Draft email failed: " + (e && e.message ? e.message : String(e)), meta: { profileId: profileId, trackerKey: String(trackerKey).substring(0, 80), usedSource: usedSource, toEmail: getAdminAuditEmail_() }, version: Sygnalist_VERSION }
    });
    throw e;
  }
}

/**
 * Manual admin-only dev check: build Email #2 body/htmlBody for one tracker row and log format validation.
 * Does not send. Call from Apps Script editor or one-off admin button.
 * Logs: whether any plain-body line starts with whitespace; whether htmlBody contains blockquote, pre, or &nbsp;.
 */
function devCheckEmail2Format_(profileId, trackerKey) {
  var profile = getProfileByIdOrThrow_(profileId);
  var row = getTrackerRowByKey_(profileId, trackerKey);
  if (!row) {
    Logger.log("devCheckEmail2Format_: tracker row not found for profileId=" + profileId + " trackerKey=" + trackerKey);
    return;
  }
  var bodies = buildEmail2BodyFromRow_(profile, row);
  var body2 = bodies.body2;
  var html = bodies.body2Html;
  var hasLeadingWhitespace = body2.split("\n").some(function (line) { return line.length > 0 && line !== line.trimStart(); });
  var hasBlockquote = html.indexOf("<blockquote") !== -1;
  var hasPre = html.indexOf("<pre") !== -1;
  var hasNbsp = html.indexOf("&nbsp;") !== -1;
  Logger.log("devCheckEmail2Format_ plain body: any line starts with whitespace? " + hasLeadingWhitespace);
  Logger.log("devCheckEmail2Format_ htmlBody contains <blockquote>? " + hasBlockquote + ", <pre>? " + hasPre + ", &nbsp;? " + hasNbsp);
}
