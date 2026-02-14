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
 * Menu: 📤 Export Logs (single entry; CSV or Pretty)
 ****************************************************/

/**
 * Single menu entry: prompt for CSV or Pretty, then run the chosen export and log.
 */
function exportLogsWithChoice_() {
  var ui = SpreadsheetApp.getUi();
  var choice = ui.prompt("Export Logs", "Enter 1 for CSV (date range + filters) or 2 for Pretty table:", ui.ButtonSet.OK_CANCEL);
  if (choice.getSelectedButton() !== ui.Button.OK) return;
  var v = String(choice.getResponseText() || "").trim();
  if (v === "1") {
    logEvent_({
      timestamp: Date.now(),
      profileId: null,
      action: "admin",
      source: "logs_export",
      details: { level: "INFO", message: "Logs exported (CSV)", version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "" }
    });
    exportLogsToCsv_();
  } else if (v === "2") {
    logEvent_({
      timestamp: Date.now(),
      profileId: null,
      action: "admin",
      source: "logs_export",
      details: { level: "INFO", message: "Logs exported (Pretty)", version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : "" }
    });
    exportLogsToPrettySheet_();
  } else {
    ui.alert("Enter 1 or 2.");
  }
}

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
  
  const sourceData = sourceSheet.getRange(1, 1, lastRow, 7).getValues();
  const sourceHeaders = sourceData[0];
  const sourceRows = sourceData.slice(1);
  
  // Open target spreadsheet
  const targetSs = SpreadsheetApp.openById(targetSpreadsheetId);
  let targetSheet = targetSs.getSheetByName("Logs Export");
  
  if (!targetSheet) {
    targetSheet = targetSs.insertSheet("Logs Export");
  } else {
    targetSs.deleteSheet(targetSheet);
    targetSheet = targetSs.insertSheet("Logs Export");
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
    "🔗 Batch",
    "Level"
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
    // Source 📓 Logs: col1=emoji, col2=time, col3=profile, col4=action, col5=source, col6=details, col7=level
    const timestamp = row[1];
    const profileId = row[2];
    const action = row[3];
    const source = row[4];
    const detailsRaw = row[5];
    const level = row[6];

    let details = {};
    try {
      details = JSON.parse(detailsRaw || "{}");
    } catch (e) {
      details = { message: String(detailsRaw || "") };
    }
    if (level !== undefined && level !== null && level !== "") details.level = String(level);

    const { emoji, bgColor } = getLogResultStyle_(action, details);
    const timeStr = formatLogTimestamp_(timestamp);
    const detailsStr = formatLogDetails_(action, details);
    const batchId = details.batchId || (details.meta && details.meta.batchId) || "—";

    exportRows.push([
      timeStr,
      profileId || "—",
      action || "—",
      source || "—",
      emoji,
      detailsStr,
      batchId,
      details.level || "INFO"
    ]);
    rowColors.push(bgColor);
  }
  
  if (exportRows.length > 0) {
    targetSheet.getRange(2, 1, exportRows.length, exportHeaders.length).setValues(exportRows);

    for (let i = 0; i < rowColors.length; i++) {
      targetSheet.getRange(i + 2, 1, i + 2, exportHeaders.length).setBackground(rowColors[i]);
    }

    targetSheet.setColumnWidth(1, 140);
    targetSheet.setColumnWidth(2, 120);
    targetSheet.setColumnWidth(3, 100);
    targetSheet.setColumnWidth(4, 100);
    targetSheet.setColumnWidth(5, 80);
    targetSheet.setColumnWidth(6, 350);
    targetSheet.setColumnWidth(7, 120);
    targetSheet.setColumnWidth(8, 60);  // Level

    targetSheet.setRowHeight(1, 32);
    for (let i = 0; i < exportRows.length; i++) {
      targetSheet.setRowHeight(i + 2, 30);
    }

    targetSheet.getRange(2, 6, exportRows.length, 1).setWrap(true);
    targetSheet.getRange(2, 1, exportRows.length, exportHeaders.length).setVerticalAlignment("middle");

    applyExportLogsConditionalFormat_(targetSheet, exportRows.length);
  }
  
  // Freeze header row and Time column
  targetSheet.setFrozenRows(1);
  targetSheet.setFrozenColumns(1);
  
  return {
    rowCount: exportRows.length,
    sheetUrl: targetSs.getUrl()
  };
}

/**
 * Apply conditional format to export sheet: Level (col H) then Action (col D).
 * Export data starts at row 2; cols 1-8 = Time, Profile, Action, Source, Result, Details, Batch, Level.
 */
function applyExportLogsConditionalFormat_(sheet, dataEndRow) {
  if (dataEndRow < 1) return;
  var dataRange = sheet.getRange(2, 1, dataEndRow, 8);
  var rules = sheet.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$H2="ERROR"')
    .setBackground("#f8d7da")
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$H2="WARN"')
    .setBackground("#fff3cd")
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=LOWER($D2)="error"')
    .setBackground("#f8d7da")
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR(REGEXMATCH(LOWER($D2),"fetch"),REGEXMATCH(LOWER($D2),"fetch_enriched"))')
    .setBackground("#d4edda")
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=REGEXMATCH(LOWER($D2),"enrich")')
    .setBackground("#d1fae5")
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=LOWER($D2)="promote"')
    .setBackground("#fef3c7")
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=LOWER($D2)="admin"')
    .setBackground("#e9d5ff")
    .setRanges([dataRange])
    .build());
  sheet.setConditionalFormatRules(rules);
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

/**
 * Export 📓 Logs to CSV with date range (required) and optional level/profileId filter.
 * Menu: Export Logs (CSV)
 */
function exportLogsToCsv_() {
  var ui = SpreadsheetApp.getUi();
  var startRes = ui.prompt("Export Logs (CSV)", "Start date (YYYY-MM-DD), required:", ui.ButtonSet.OK_CANCEL);
  if (startRes.getSelectedButton() !== ui.Button.OK) return;
  var startStr = String(startRes.getResponseText() || "").trim();
  if (!startStr) {
    ui.alert("Start date is required.");
    return;
  }
  var endRes = ui.prompt("Export Logs (CSV)", "End date (YYYY-MM-DD), required:", ui.ButtonSet.OK_CANCEL);
  if (endRes.getSelectedButton() !== ui.Button.OK) return;
  var endStr = String(endRes.getResponseText() || "").trim();
  if (!endStr) {
    ui.alert("End date is required.");
    return;
  }
  var levelRes = ui.prompt("Export Logs (CSV)", "Filter by level (INFO, WARN, ERROR) or leave blank for all:", ui.ButtonSet.OK_CANCEL);
  var levelFilter = (levelRes.getSelectedButton() === ui.Button.OK && levelRes.getResponseText()) ? String(levelRes.getResponseText()).trim().toUpperCase() : "";
  var profileRes = ui.prompt("Export Logs (CSV)", "Filter by profileId (or leave blank for all):", ui.ButtonSet.OK_CANCEL);
  var profileFilter = (profileRes.getSelectedButton() === ui.Button.OK && profileRes.getResponseText()) ? String(profileRes.getResponseText()).trim() : "";

  var tz = Session.getScriptTimeZone();
  var startDate;
  var endDate;
  try {
    startDate = Utilities.parseDate(startStr, tz, "yyyy-MM-dd");
    endDate = Utilities.parseDate(endStr, tz, "yyyy-MM-dd");
  } catch (e) {
    ui.alert("Invalid date format. Use YYYY-MM-DD.");
    return;
  }
  var startTs = startDate.getTime();
  var endTs = endDate.getTime() + 24 * 60 * 60 * 1000 - 1;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("📓 Logs");
  if (!sh) {
    ui.alert("📓 Logs sheet not found.");
    return;
  }
  var lastRow = sh.getLastRow();
  if (lastRow < 2) {
    ui.alert("No log entries to export.");
    return;
  }
  // Logs: row 1 = headers, row 2+ = data
  var data = sh.getRange(2, 1, lastRow, 7).getValues();
  var headers = ["Emoji", "Time", "Profile", "Action", "Source", "Details", "Level"];
  var rows = [];
  var year = new Date().getFullYear();
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var timeStr = String(row[1] || "");
    var profileId = String(row[2] || "").trim();
    var action = String(row[3] || "").toLowerCase();
    var detailsStr = String(row[5] || "");
    var rowDate;
    try {
      rowDate = Utilities.parseDate(timeStr + " " + year, tz, "MMM d, h:mm a yyyy");
    } catch (e) {
      rowDate = new Date(0);
    }
    var ts = rowDate.getTime();
    if (ts < startTs || ts > endTs) continue;
    if (profileFilter && profileId !== profileFilter) continue;
    if (levelFilter) {
      if (levelFilter === "ERROR" && action !== "error" && detailsStr.indexOf("ERROR") === -1) continue;
      if (levelFilter === "WARN" && detailsStr.indexOf("WARN") === -1) continue;
      if (levelFilter === "INFO" && (action === "error" || detailsStr.indexOf("ERROR") !== -1)) continue;
    }
    rows.push(row);
  }

  function csvEscape(val) {
    var s = String(val == null ? "" : val);
    if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
  var csvLines = [headers.map(csvEscape).join(",")];
  for (var i = 0; i < rows.length; i++) {
    csvLines.push(rows[i].map(csvEscape).join(","));
  }
  var csv = csvLines.join("\n");

  var name = "Sygnalist_Logs_" + startStr + "_to_" + endStr + ".csv";
  var blob = Utilities.newBlob(csv, "text/csv", name);
  var file = DriveApp.getRootFolder().createFile(blob);
  ui.alert("✅ CSV exported (" + rows.length + " rows).\n\n" + file.getUrl());
}

// Note: truncateStr_() is now in core_utils.js
