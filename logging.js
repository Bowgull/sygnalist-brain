/****************************************************
 * logging.js
 * Core logging to 📓 Logs sheet
 * 
 * Logs are visually styled with emojis and colors.
 * For export to separate sheet, see: logs_export.js
 ****************************************************/

function logEvent_(event) {
  try {
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
    if (meta.count !== undefined) extras.push("count: " + meta.count);
    if (meta.source) extras.push("source: " + meta.source);
    if (meta.profileId) extras.push("profile: " + meta.profileId);
    if (meta.batchId) extras.push("batch: " + meta.batchId);
    
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
