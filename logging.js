/****************************************************
 * logging.js
 * Core logging to 📓 Logs sheet
 * 
 * Logs are visually styled with emojis and colors.
 * For export to separate sheet, see: logs_export.js
 ****************************************************/

function logEvent_(event) {
  const sheet = assertSheetExists_("📓 Logs");
  
  // Ensure headers exist
  ensureLogHeaders_(sheet);
  
  const action = String(event.action || "").toLowerCase();
  const details = event.details || {};
  const level = String(details.level || "").toUpperCase();
  
  // Get emoji and color for this log type
  const style = getLogStyle_(action, level);
  
  // Format timestamp nicely
  const timestamp = new Date(event.timestamp || Date.now());
  const tz = Session.getScriptTimeZone();
  const timeStr = Utilities.formatDate(timestamp, tz, "MMM d, h:mm a");
  
  // Format details as readable text (not raw JSON)
  const detailsStr = formatLogDetailsInline_(details);
  
  const row = [
    style.emoji,
    timeStr,
    event.profileId || "—",
    event.action || "—",
    event.source || "—",
    detailsStr
  ];

  sheet.appendRow(row);
  
  // Apply row color
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, 6).setBackground(style.bgColor);
}

function ensureLogHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    const headers = ["📊", "🕐 Time", "👤 Profile", "⚡ Action", "📡 Source", "📝 Details"];
    sheet.appendRow(headers);
    
    // Style header row
    const headerRange = sheet.getRange(1, 1, 1, 6);
    headerRange.setBackground("#1f2937");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    
    // Set column widths
    sheet.setColumnWidth(1, 40);   // Emoji
    sheet.setColumnWidth(2, 130);  // Time
    sheet.setColumnWidth(3, 100);  // Profile
    sheet.setColumnWidth(4, 80);   // Action
    sheet.setColumnWidth(5, 100);  // Source
    sheet.setColumnWidth(6, 400);  // Details
    
    // Freeze header
    sheet.setFrozenRows(1);
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
