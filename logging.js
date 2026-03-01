/****************************************************
 * logging.js
 * Core logging to 📓 Logs sheet
 * 
 * Logs are visually styled with emojis and colors.
 * For export to separate sheet, see: logs_export.js
 ****************************************************/

function logEvent_(event) {
  try {
    if (String(event.source || "").toLowerCase() === "debug" && !(typeof CONFIG !== "undefined" && CONFIG.LOG_DEBUG)) {
      return;
    }
    const sheet = assertSheetExists_("📓 Logs");
    ensureLogHeaders_(sheet);
    const action = String(event.action || "").toLowerCase();
    const details = event.details || {};
    const level = String(details.level || "").toUpperCase();
    const style = getLogStyle_(action, level);
    const timestamp = new Date(event.timestamp || Date.now());
    const tz = Session.getScriptTimeZone();
    const timeStr = Utilities.formatDate(timestamp, tz, "MMM d, h:mm a");
    const detailsStr = formatLogDetailsInline_(details);
    const levelStr = level || "INFO";
    const row = [
      style.emoji,
      timeStr,
      event.profileId || "—",
      event.action || "—",
      event.source || "—",
      detailsStr,
      levelStr
    ];
    sheet.appendRow(row);
  } catch (e) {
    // Logs must not break callers; swallow write failures
  }
}

function ensureLogHeaders_(sheet) {
  const headers = ["📊", "🕐 Time", "👤 Profile", "⚡ Action", "📡 Source", "📝 Details", "Level"];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 7).setValues([headers]);
    return;
  }
  var r1 = sheet.getRange(1, 1, 1, 7).getValues()[0];
  var looksLikeHeader = (r1[0] === "📊" || (r1[1] && String(r1[1]).indexOf("Time") >= 0) || (r1[2] && String(r1[2]).indexOf("Profile") >= 0));
  if (!looksLikeHeader) {
    sheet.getRange(1, 1, 1, 7).setValues([headers]);
  }
}

function getLogStyle_(action, level) {
  // Error states
  if (level === "ERROR" || action === "error") {
    return { emoji: "❌", bgColor: "#f8d7da" }; // Light red
  }
  
  // Warning states
  if (level === "WARN") {
    return { emoji: "⚠️", bgColor: "#fff3cd" }; // Light yellow
  }
  
  // Promote action
  if (action === "promote") {
    return { emoji: "⭐", bgColor: "#fef3c7" }; // Light gold
  }
  
  // Admin action
  if (action === "admin") {
    return { emoji: "🔧", bgColor: "#e9d5ff" }; // Light purple
  }
  
  // Fetch success
  if (action === "fetch") {
    return { emoji: "📡", bgColor: "#d4edda" }; // Light green
  }
  
  // Enrich success
  if (action === "enrich") {
    return { emoji: "✨", bgColor: "#d1fae5" }; // Light teal
  }
  
  // Default / Info
  return { emoji: "ℹ️", bgColor: "#e9ecef" }; // Light gray
}

function formatLogDetailsInline_(details) {
  var msg = details.message || "";
  var meta = details.meta || {};

  if (msg) {
    var extras = [];
    // Legacy / generic
    if (meta.count !== undefined) extras.push("count: " + meta.count);
    if (meta.source) extras.push("source: " + meta.source);
    if (meta.profileId) extras.push("profile: " + meta.profileId);
    if (meta.batchId) extras.push("batch: " + meta.batchId);
    // Receipt / pipeline (high-value, compact)
    if (meta.written !== undefined) extras.push("written: " + meta.written);
    if (meta.rawFetched !== undefined) extras.push("rawFetched: " + meta.rawFetched);
    if (meta.totalFetchedBeforeDedupe !== undefined) extras.push("rawFetched: " + meta.totalFetchedBeforeDedupe);
    if (meta.rawFetchedMain !== undefined) extras.push("rawMain: " + meta.rawFetchedMain);
    if (meta.rawFetchedRapid !== undefined) extras.push("rawRapid: " + meta.rawFetchedRapid);
    if (meta.afterDedupe !== undefined) extras.push("afterDedupe: " + meta.afterDedupe);
    if (meta.eligibleAfterHardFilters !== undefined) extras.push("eligible: " + meta.eligibleAfterHardFilters);
    if (meta.eligible !== undefined && meta.eligibleAfterHardFilters === undefined) extras.push("eligible: " + meta.eligible);
    if (meta.candidates !== undefined) extras.push("candidates: " + meta.candidates);
    if (meta.candidatesSelected !== undefined && meta.candidates === undefined) extras.push("candidates: " + meta.candidatesSelected);
    if (meta.enriched !== undefined) extras.push("enriched: " + meta.enriched);
    if (meta.enrichPhaseMs !== undefined) extras.push("enrichMs: " + meta.enrichPhaseMs);
    if (meta.fetchPhaseMs !== undefined) extras.push("fetchMs: " + meta.fetchPhaseMs);
    if (meta.durationMs !== undefined) extras.push("durationMs: " + meta.durationMs);
    // RapidAPI
    if (meta.rapidDecision) extras.push("rapid: " + meta.rapidDecision);
    if (meta.rapidReason) extras.push("rapidReason: " + String(meta.rapidReason).slice(0, 24));
    if (meta.rapidStatus) extras.push("rapidStatus: " + meta.rapidStatus);
    if (meta.rapidRawCount !== undefined) extras.push("rapidRaw: " + meta.rapidRawCount);
    if (meta.rapidParsedCount !== undefined) extras.push("rapidParsed: " + meta.rapidParsedCount);
    if (meta.rapidRejectedCount !== undefined) extras.push("rapidRejected: " + meta.rapidRejectedCount);
    if (meta.rapidAdded !== undefined) extras.push("rapidAdded: " + meta.rapidAdded);
    if (meta.rapidLinkedInCount !== undefined) extras.push("rapidLI: " + meta.rapidLinkedInCount);
    if (meta.rapidATSCount !== undefined) extras.push("rapidATS: " + meta.rapidATSCount);
    if (meta.httpStatus !== undefined) extras.push("httpStatus: " + meta.httpStatus);
    if (meta.dropTop) extras.push("dropTop: " + meta.dropTop);

    if (extras.length > 0) {
      return msg + " (" + extras.join(", ") + ")";
    }
    return msg;
  }

  // Fallback: stringify meta
  if (Object.keys(meta).length > 0) {
    return Object.keys(meta)
      .map(function(k) { return k + ": " + String(meta[k]).slice(0, 50); })
      .join(", ");
  }

  return "—";
}
