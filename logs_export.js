/****************************************************
 * logs_export.js
 * Logs Export (Pretty Ops View)
 * 
 * Exports 📓 Logs to a separate Google Sheet with:
 * - Color-coded rows by outcome
 * - Emoji result column
 * - Human-readable details
 * - Proper column widths and row heights
 * 
 * Menu: 📤 Export Logs (Pretty)
 ****************************************************/

function exportLogsToPrettySheet_() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    // Check if we have a configured ID
    let targetId = CONFIG.LOGS_EXPORT_SPREADSHEET_ID || "";
    let isNewSheet = false;
    
    if (!targetId) {
      // Create a new spreadsheet automatically
      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm");
      const newSs = SpreadsheetApp.create("Sygnalist Logs Export — " + timestamp);
      targetId = newSs.getId();
      isNewSheet = true;
    }
    
    const exported = exportLogsToSheet_(targetId);
    
    const message = isNewSheet
      ? `Created new sheet and exported ${exported.rowCount} log entries.\n\n📄 ${exported.sheetUrl}`
      : `Exported ${exported.rowCount} log entries to:\n${exported.sheetUrl}`;
    
    ui.alert("✅ Logs Exported", message, ui.ButtonSet.OK);
    
  } catch (e) {
    ui.alert("❌ Export Failed", String(e.message || e), ui.ButtonSet.OK);
  }
}

function exportLogsToSheet_(targetSpreadsheetId) {
  // Read source logs
  const sourceSs = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = sourceSs.getSheetByName("📓 Logs");
  
  if (!sourceSheet) {
    throw new Error("📓 Logs sheet not found in Engine.");
  }
  
  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) {
    throw new Error("No log entries to export.");
  }
  
  const sourceData = sourceSheet.getRange(1, 1, lastRow, 5).getValues();
  const sourceHeaders = sourceData[0];
  const sourceRows = sourceData.slice(1);
  
  // Open target spreadsheet
  const targetSs = SpreadsheetApp.openById(targetSpreadsheetId);
  let targetSheet = targetSs.getSheetByName("Logs Export");
  
  if (!targetSheet) {
    targetSheet = targetSs.insertSheet("Logs Export");
  } else {
    // Clear existing content
    targetSheet.clear();
  }
  
  // Delete default "Sheet1" if it exists and we just created this spreadsheet
  const defaultSheet = targetSs.getSheetByName("Sheet1");
  if (defaultSheet && targetSs.getSheets().length > 1) {
    targetSs.deleteSheet(defaultSheet);
  }
  
  // Set up headers
  const exportHeaders = [
    "🕐 Time",
    "👤 Profile", 
    "⚡ Action",
    "📡 Source",
    "📊 Result",
    "📝 Details",
    "🔗 Batch"
  ];
  
  targetSheet.getRange(1, 1, 1, exportHeaders.length).setValues([exportHeaders]);
  
  // Format header row
  const headerRange = targetSheet.getRange(1, 1, 1, exportHeaders.length);
  headerRange.setBackground("#1f2937");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setVerticalAlignment("middle");
  
  // Process and write data rows
  const exportRows = [];
  const rowColors = [];
  
  for (let i = 0; i < sourceRows.length; i++) {
    const row = sourceRows[i];
    const timestamp = row[0];
    const profileId = row[1];
    const action = row[2];
    const source = row[3];
    const detailsRaw = row[4];
    
    // Parse details JSON
    let details = {};
    try {
      details = JSON.parse(detailsRaw || "{}");
    } catch (e) {
      details = { message: String(detailsRaw || "") };
    }
    
    // Determine result emoji and color
    const { emoji, bgColor } = getLogResultStyle_(action, details);
    
    // Format timestamp
    const timeStr = formatLogTimestamp_(timestamp);
    
    // Format details as human-readable
    const detailsStr = formatLogDetails_(action, details);
    
    // Extract batchId
    const batchId = details.batchId || (details.meta && details.meta.batchId) || "—";
    
    exportRows.push([
      timeStr,
      profileId || "—",
      action || "—",
      source || "—",
      emoji,
      detailsStr,
      batchId
    ]);
    
    rowColors.push(bgColor);
  }
  
  if (exportRows.length > 0) {
    // Write data
    targetSheet.getRange(2, 1, exportRows.length, exportHeaders.length).setValues(exportRows);
    
    // Apply row colors
    for (let i = 0; i < rowColors.length; i++) {
      targetSheet.getRange(i + 2, 1, 1, exportHeaders.length).setBackground(rowColors[i]);
    }
    
    // Set column widths
    targetSheet.setColumnWidth(1, 140); // Time
    targetSheet.setColumnWidth(2, 120); // Profile
    targetSheet.setColumnWidth(3, 100); // Action
    targetSheet.setColumnWidth(4, 100); // Source
    targetSheet.setColumnWidth(5, 80);  // Result
    targetSheet.setColumnWidth(6, 350); // Details
    targetSheet.setColumnWidth(7, 120); // Batch
    
    // Set row heights (header + data)
    targetSheet.setRowHeight(1, 32);
    for (let i = 0; i < exportRows.length; i++) {
      targetSheet.setRowHeight(i + 2, 30);
    }
    
    // Text wrap on Details column
    targetSheet.getRange(2, 6, exportRows.length, 1).setWrap(true);
    
    // Vertical align all data
    targetSheet.getRange(2, 1, exportRows.length, exportHeaders.length).setVerticalAlignment("middle");
  }
  
  // Freeze header row and Time column
  targetSheet.setFrozenRows(1);
  targetSheet.setFrozenColumns(1);
  
  return {
    rowCount: exportRows.length,
    sheetUrl: targetSs.getUrl()
  };
}

/****************************************************
 * Helpers for log formatting
 ****************************************************/

function getLogResultStyle_(action, details) {
  const level = String(details.level || "").toUpperCase();
  const actionLower = String(action || "").toLowerCase();
  
  // Error states
  if (level === "ERROR" || actionLower === "error") {
    return { emoji: "❌", bgColor: "#f8d7da" }; // Light red
  }
  
  // Warning states
  if (level === "WARN") {
    return { emoji: "⚠️", bgColor: "#fff3cd" }; // Light yellow
  }
  
  // Promote action
  if (actionLower === "promote") {
    return { emoji: "⭐", bgColor: "#fef3c7" }; // Light gold
  }
  
  // Admin action
  if (actionLower === "admin") {
    return { emoji: "🔧", bgColor: "#e9d5ff" }; // Light purple
  }
  
  // Fetch / Enrich success
  if (actionLower === "fetch" || actionLower === "enrich") {
    return { emoji: "✅", bgColor: "#d4edda" }; // Light green
  }
  
  // Default / Info
  return { emoji: "ℹ️", bgColor: "#e9ecef" }; // Light gray
}

function formatLogTimestamp_(timestamp) {
  if (!timestamp) return "—";
  
  const d = (timestamp instanceof Date) ? timestamp : new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);
  
  const tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, "MMM d, h:mm a");
}

function formatLogDetails_(action, details) {
  const msg = details.message || "";
  const meta = details.meta || {};
  
  // If there's a clear message, use it
  if (msg) {
    // Append useful meta if present
    const extras = [];
    if (meta.count !== undefined) extras.push("count: " + meta.count);
    if (meta.source) extras.push("source: " + meta.source);
    if (meta.url) extras.push("url: " + truncateStr_(meta.url, 50));
    if (meta.profileId) extras.push("profile: " + meta.profileId);
    
    if (extras.length > 0) {
      return msg + " (" + extras.join(", ") + ")";
    }
    return msg;
  }
  
  // Fallback: stringify meta if no message
  if (Object.keys(meta).length > 0) {
    return Object.keys(meta)
      .map(function(k) { return k + ": " + truncateStr_(String(meta[k]), 40); })
      .join(", ");
  }
  
  return "—";
}

function truncateStr_(str, maxLen) {
  var s = String(str || "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}
