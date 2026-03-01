/**
 * sheet_format.js
 * Ops control panel visual system: freeze headers, filters, column widths, wrap, conditional format.
 * Uses light theme from sheet_theme.js when available.
 */

/**
 * Idempotent format for 📊 Admin_Analytics: theme row 1, KPI block styling.
 * Call after refreshAdminAnalytics_() has written all content.
 */
function formatAdminAnalytics_(sh) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  if (lastRow < 1) return;

  sh.setFrozenRows(1);
  var rh = (typeof ROW_HEIGHT_HEADER !== "undefined") ? ROW_HEIGHT_HEADER : 26;
  var rd = (typeof ROW_HEIGHT_DEFAULT !== "undefined") ? ROW_HEIGHT_DEFAULT : 22;
  var bgDark = (typeof BACKGROUND_DARK !== "undefined") ? BACKGROUND_DARK : "#e8eaed";
  var headerText = (typeof HEADER_TEXT !== "undefined") ? HEADER_TEXT : "#202124";
  sh.getRange(1, 1, 1, 8).setFontSize(18).setFontWeight("bold").setFontColor(headerText).setBackground(bgDark);
  sh.setRowHeight(1, rh + 2);
  sh.setColumnWidth(1, 140);
  sh.setColumnWidth(2, 120);
  if (lastRow >= 2) {
    var blockEnd = Math.min(35, lastRow);
    sh.getRange(2, 1, blockEnd, 8).setFontSize(12);
    for (var r = 2; r <= blockEnd; r++) sh.setRowHeight(r, rd);
  }
}

/**
 * Apply ops-style format to 📓 Logs sheet: theme header, filter on data, wrap details.
 * Structure: row 1 = headers (matches logging.js), row 2+ = data.
 */
function formatLogSheet_(sheet) {
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return;

  var headerBg = (typeof HEADER_BG !== "undefined") ? HEADER_BG : "#e8eaed";
  var headerText = (typeof HEADER_TEXT !== "undefined") ? HEADER_TEXT : "#202124";
  var panelDark = (typeof PANEL_DARK !== "undefined") ? PANEL_DARK : "#f1f3f4";
  var mutedText = (typeof MUTED_TEXT !== "undefined") ? MUTED_TEXT : "#5f6368";
  var rh = (typeof ROW_HEIGHT_HEADER !== "undefined") ? ROW_HEIGHT_HEADER : 26;
  var rd = (typeof ROW_HEIGHT_DEFAULT !== "undefined") ? ROW_HEIGHT_DEFAULT : 22;

  var numCols = 7;
  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 130);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 400);
  sheet.setColumnWidth(7, 60);

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, numCols).setBackground(headerBg).setFontColor(headerText).setFontWeight("bold").setFontSize(12);
  sheet.setRowHeight(1, rh);

  if (lastRow >= 2) {
    var dataRange = sheet.getRange(1, 1, lastRow, numCols);
    if (!sheet.getFilter()) dataRange.createFilter();
    sheet.getRange(2, 6, lastRow, 6).setWrap(true);
    sheet.getRange(2, 1, lastRow, numCols).setFontSize(12);
    sheet.getRange(2, 1, lastRow, 1).setFontSize(16);
    var numDataRows = Math.max(0, lastRow - 1);
    if (numDataRows > 0) sheet.setRowHeights(2, numDataRows, rd);
    applyLogsConditionalFormat_(sheet, lastRow);
  }
  // Derived columns H–K: style header row (row 1) as system-derived
  if (lastRow >= 1) {
    sheet.getRange(1, 8, 1, 11).setBackground(panelDark).setFontColor(mutedText).setFontSize(11);
  }
}

/**
 * Apply conditional format rules to 📓 Logs data: by level (G) then by action (D).
 * Idempotent: replaces only rules for this sheet's data range (cols A–G rows 3+). Uses theme colors.
 */
function applyLogsConditionalFormat_(sheet, lastRow) {
  if (lastRow < 3) return;
  var dataRange = sheet.getRange(3, 1, lastRow, 7);
  var errRed = (typeof ERROR_RED !== "undefined") ? ERROR_RED : "#f8d7da";
  var warnAmber = (typeof WARNING_AMBER !== "undefined") ? WARNING_AMBER : "#fff3cd";
  var accentTeal = (typeof ACCENT_TEAL !== "undefined") ? ACCENT_TEAL : "#14b8a6";
  var accentPurple = (typeof ACCENT_PURPLE !== "undefined") ? ACCENT_PURPLE : "#e9d5ff";

  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$G2="ERROR"')
    .setBackground(errRed)
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$G3="WARN"')
    .setBackground(warnAmber)
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=LOWER($D2)="error"')
    .setBackground(errRed)
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR(REGEXMATCH(LOWER($D3),"fetch"),REGEXMATCH(LOWER($D3),"fetch_enriched"))')
    .setBackground(accentTeal)
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=REGEXMATCH(LOWER($D2),"enrich")')
    .setBackground(accentTeal)
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=LOWER($D3)="promote"')
    .setBackground(warnAmber)
    .setRanges([dataRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=LOWER($D2)="admin"')
    .setBackground(accentPurple)
    .setRanges([dataRange])
    .build());

  var existing = sheet.getConditionalFormatRules();
  var other = existing.filter(function (rule) {
    var ranges = rule.getRanges();
    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      if (r.getSheet().getSheetId() === sheet.getSheetId() && r.getRow() >= 2 && r.getLastColumn() <= 7) return false;
    }
    return true;
  });
  sheet.setConditionalFormatRules(other.concat(rules));
}

/**
 * Single entry point for full 📓 Logs presentation: format, conditional format, optional filter views and derived columns.
 * Call from menu or script editor. Does not change logging write path.
 */
function formatLogsSheet() {
  var sheet;
  try {
    sheet = assertSheetExists_("📓 Logs");
  } catch (e) {
    return;
  }
  formatLogSheet_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    createLogsFilterViews_(sheet);
    setupLogsDerivedColumns_(sheet);
  }
}

/**
 * Create preset filter views on 📓 Logs (Errors, Fetch only, Admin) via Sheets API.
 * Run once; skips if sheet already has filter views. Requires Sheets API (Advanced Service) enabled.
 */
function createLogsFilterViews_(sheet) {
  try {
    if (typeof Sheets === "undefined") return;
    var ss = sheet.getParent();
    var spreadsheetId = ss.getId();
    var sheetId = sheet.getSheetId();
    var range = {
      sheetId: sheetId,
      startRowIndex: 0,
      endRowIndex: 10000,
      startColumnIndex: 0,
      endColumnIndex: 7
    };
    var existing = Sheets.Spreadsheets.get(spreadsheetId, { fields: "sheets(properties(sheetId,title),filterViews(title))" });
    var logSheet = (existing.sheets || []).filter(function(s) { return (s.properties && s.properties.title === "📓 Logs"); })[0];
    if (logSheet && logSheet.filterViews && logSheet.filterViews.length >= 3) return;

    var requests = [
      {
        addFilterView: {
          filter: {
            title: "Errors",
            range: range,
            criteria: {
              "6": { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "ERROR" }] } }
            }
          }
        }
      },
      {
        addFilterView: {
          filter: {
            title: "Fetch only",
            range: range,
            criteria: {
              "3": { condition: { type: "TEXT_CONTAINS", values: [{ userEnteredValue: "fetch" }] } }
            }
          }
        }
      },
      {
        addFilterView: {
          filter: {
            title: "Admin",
            range: range,
            criteria: {
              "3": { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "admin" }] } }
            }
          }
        }
      }
    ];
    Sheets.Spreadsheets.batchUpdate({ requests: requests }, spreadsheetId);
  } catch (e) {
    // Sheets API may not be enabled or quota; no impact on formatting
  }
}

/**
 * Add or refresh derived columns (H–K) on 📓 Logs: message, batchId, count, source_details from Details (F).
 * Idempotent: sets headers in row 1 (cols H–K) and formulas for rows 2..lastRow. New log rows get formulas on next format run.
 */
function setupLogsDerivedColumns_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var headers = ["message", "batchId", "count", "source_details"];
  sheet.getRange(1, 8, 1, 11).setValues([headers]);
  sheet.getRange(2, 8).setFormula('=IFERROR(REGEXEXTRACT(F2,"^([^(]+)"), F2)');
  sheet.getRange(2, 9).setFormula('=IFERROR(REGEXEXTRACT(F2,"batch: ([^,\\)]+)"), "")');
  sheet.getRange(2, 10).setFormula('=IFERROR(REGEXEXTRACT(F2,"count: (\\d+)"), "")');
  sheet.getRange(2, 11).setFormula('=IFERROR(REGEXEXTRACT(F2,"source: ([^,\\)]+)"), "")');
  if (lastRow >= 3) {
    sheet.getRange(2, 8, 2, 11).copyTo(sheet.getRange(3, 8, lastRow, 11), SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);
  }
}

/**
 * Set data validation dropdowns on 📓 Logs row 1 (C, D, E, G) from unique values in data.
 */
function setLogFilterDropdowns_(sheet, lastRow) {
  if (lastRow < 3) return;
  var cols = [3, 4, 5, 7]; // Profile, Action, Source, Level
  for (var c = 0; c < cols.length; c++) {
    var col = cols[c];
    var values = sheet.getRange(3, col, lastRow, col).getValues();
    var uniq = {};
    for (var i = 0; i < values.length; i++) {
      var v = String(values[i][0] || "").trim();
      if (v) uniq[v] = true;
    }
    var list = ["All"].concat(Object.keys(uniq).sort());
    var validation = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
    sheet.getRange(1, col).setDataValidation(validation);
  }
}

/**
 * Apply filter on 📓 Logs based on row 1 dropdown values (Profile, Action, Source, Level).
 * Call from onEdit when row 1 is edited.
 */
function applyLogsFilterFromRow1_(sheet) {
  if (!sheet || sheet.getName() !== "📓 Logs") return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return;
  var filter = sheet.getFilter();
  if (!filter) {
    filter = sheet.getRange(2, 1, lastRow, 7).createFilter();
  }
  var c1 = String(sheet.getRange(1, 3).getValue() || "").trim();
  var d1 = String(sheet.getRange(1, 4).getValue() || "").trim();
  var e1 = String(sheet.getRange(1, 5).getValue() || "").trim();
  var g1 = String(sheet.getRange(1, 7).getValue() || "").trim();
  function clearOrSet(colIndex, val) {
    if (!val || val === "All") {
      try { filter.removeColumnFilterCriteria(colIndex); } catch (err) { /* ignore */ }
    } else {
      filter.setColumnFilterCriteria(colIndex, SpreadsheetApp.newFilterCriteria().whenTextEqualTo(val).build());
    }
  }
  clearOrSet(3, c1);
  clearOrSet(4, d1);
  clearOrSet(5, e1);
  clearOrSet(7, g1);
}

/**
 * Apply ops-style format to Engine_Inbox: theme header, widths (company/title/url), wrap, tier conditional format.
 * Column order must not change (Admin_Analytics uses B,C,G,J).
 */
function formatEngineInboxSheet_(sh) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  var headerBg = (typeof HEADER_BG !== "undefined") ? HEADER_BG : "#e8eaed";
  var headerText = (typeof HEADER_TEXT !== "undefined") ? HEADER_TEXT : "#202124";
  var accentGreen = (typeof ACCENT_GREEN !== "undefined") ? ACCENT_GREEN : "#e6f4ea";
  var errRed = (typeof ERROR_RED !== "undefined") ? ERROR_RED : "#fce8e6";

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setBackground(headerBg).setFontColor(headerText).setFontWeight("bold");
  if (typeof ROW_HEIGHT_HEADER !== "undefined") sh.setRowHeight(1, ROW_HEIGHT_HEADER);
  var cols = Math.max(sh.getLastColumn(), 16);
  sh.setColumnWidth(4, 140);   // company
  sh.setColumnWidth(5, 180);   // title
  sh.setColumnWidth(6, 260);   // url
  sh.setColumnWidth(3, 36);    // tier (narrow)
  sh.setColumnWidth(12, 220);
  sh.setColumnWidth(13, 220);
  if (lastRow >= 2) {
    if (!sh.getFilter()) sh.getRange(1, 1, lastRow, cols).createFilter();
    sh.getRange(2, 12, lastRow, 13).setWrap(true);
    var dataRange = sh.getRange(2, 1, lastRow, cols);
    var rules = [
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="S"').setBackground(accentGreen).setRanges([dataRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="F"').setBackground(errRed).setRanges([dataRange]).build()
    ];
    sh.setConditionalFormatRules(rules);
  }
}

/**
 * Apply ops-style format to Engine_Tracker: theme header, widths, wrap, status conditional format.
 * Column order must not change (Admin_Analytics uses A,H,K).
 */
function formatEngineTrackerSheet_(sh) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  var headerBg = (typeof HEADER_BG !== "undefined") ? HEADER_BG : "#e8eaed";
  var headerText = (typeof HEADER_TEXT !== "undefined") ? HEADER_TEXT : "#202124";
  var accentPurple = (typeof ACCENT_PURPLE !== "undefined") ? ACCENT_PURPLE : "#f3e8ff";
  var accentGreen = (typeof ACCENT_GREEN !== "undefined") ? ACCENT_GREEN : "#e6f4ea";

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setBackground(headerBg).setFontColor(headerText).setFontWeight("bold");
  if (typeof ROW_HEIGHT_HEADER !== "undefined") sh.setRowHeight(1, ROW_HEIGHT_HEADER);
  var cols = Math.max(sh.getLastColumn(), 18);
  sh.setColumnWidth(3, 140);   // company
  sh.setColumnWidth(4, 180);   // title
  sh.setColumnWidth(5, 260);   // url
  sh.setColumnWidth(13, 180);
  sh.setColumnWidth(14, 180);
  sh.setColumnWidth(18, 200);  // notes
  if (lastRow >= 2) {
    if (!sh.getFilter()) sh.getRange(1, 1, lastRow, cols).createFilter();
    sh.getRange(2, 13, lastRow, 14).setWrap(true);
    sh.getRange(2, 18, lastRow, 18).setWrap(true);
    var dataRange = sh.getRange(2, 1, lastRow, cols);
    var rules = [
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=REGEXMATCH(LOWER($H2),"interview")').setBackground(accentPurple).setRanges([dataRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=REGEXMATCH(LOWER($H2),"offer|hired")').setBackground(accentGreen).setRanges([dataRange]).build()
    ];
    sh.setConditionalFormatRules(rules);
  }
}

/**
 * Apply ops-style format to Admin_Profiles: theme header, column-group backgrounds, system columns muted, validation unchanged.
 */
function formatAdminProfilesSheet_() {
  var sh;
  try {
    sh = assertSheetExists_("Admin_Profiles");
  } catch (e) {
    return;
  }
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;

  var headerBg = (typeof HEADER_BG !== "undefined") ? HEADER_BG : "#e8eaed";
  var headerText = (typeof HEADER_TEXT !== "undefined") ? HEADER_TEXT : "#202124";
  var panelDark = (typeof PANEL_DARK !== "undefined") ? PANEL_DARK : "#f1f3f4";
  var mutedText = (typeof MUTED_TEXT !== "undefined") ? MUTED_TEXT : "#5f6368";
  var errRed = (typeof ERROR_RED !== "undefined") ? ERROR_RED : "#fce8e6";
  var accentPurple = (typeof ACCENT_PURPLE !== "undefined") ? ACCENT_PURPLE : "#f3e8ff";
  var warnAmber = (typeof WARNING_AMBER !== "undefined") ? WARNING_AMBER : "#fef7e0";
  var rh = (typeof ROW_HEIGHT_HEADER !== "undefined") ? ROW_HEIGHT_HEADER : 26;
  var rd = (typeof ROW_HEIGHT_DEFAULT !== "undefined") ? ROW_HEIGHT_DEFAULT : 22;

  sh.setFrozenRows(1);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || "").trim(); });
  var statusCol = headers.indexOf("status") + 1;
  var isAdminCol = headers.indexOf("isAdmin") + 1;
  var profileIdCol = headers.indexOf("profileId") + 1;
  var displayNameCol = headers.indexOf("displayName") + 1;
  var statusReasonCol = headers.indexOf("statusReason") + 1;
  var idxRoleTracks = headers.indexOf("roleTracksJSON");
  var idxLaneControls = headers.indexOf("laneControlsJSON");
  var idxPortal = headers.indexOf("portalSpreadsheetId");
  var idxWebApp = headers.indexOf("webAppUrl");
  var idxLastFetch = headers.indexOf("last_fetch_at");

  sh.getRange(1, 1, 1, lastCol).setFontSize(12).setFontWeight("bold").setBackground(headerBg).setFontColor(headerText);
  sh.setRowHeight(1, rh);
  if (profileIdCol > 0) sh.setColumnWidth(profileIdCol, 100);
  if (displayNameCol > 0) sh.setColumnWidth(displayNameCol, 140);
  if (statusCol > 0) sh.setColumnWidth(statusCol, 120);
  if (statusReasonCol > 0) sh.setColumnWidth(statusReasonCol, 180);
  if (isAdminCol > 0) sh.setColumnWidth(isAdminCol, 72);
  sh.getRange(2, 1, lastRow, lastCol).setFontSize(11);
  for (var r = 2; r <= lastRow; r++) sh.setRowHeight(r, rd);

  // Banding: alternate row background
  for (var r = 2; r <= lastRow; r++) {
    if ((r - 2) % 2 === 1) sh.getRange(r, 1, r, lastCol).setBackground("#f8f9fa");
  }
  // System / "do not touch" columns: muted background and text (overrides banding)
  if (idxRoleTracks >= 0) sh.getRange(2, idxRoleTracks + 1, lastRow, idxRoleTracks + 1).setBackground(panelDark).setFontColor(mutedText);
  if (idxLaneControls >= 0) sh.getRange(2, idxLaneControls + 1, lastRow, idxLaneControls + 1).setBackground(panelDark).setFontColor(mutedText);
  if (idxPortal >= 0) sh.getRange(2, idxPortal + 1, lastRow, idxPortal + 1).setBackground(panelDark).setFontColor(mutedText);
  if (idxWebApp >= 0) sh.getRange(2, idxWebApp + 1, lastRow, idxWebApp + 1).setBackground(panelDark).setFontColor(mutedText);
  if (idxLastFetch >= 0) sh.getRange(2, idxLastFetch + 1, lastRow, idxLastFetch + 1).setBackground(panelDark).setFontColor(mutedText);

  var rules = [];
  if (statusCol > 0) {
    var statusRange = sh.getRange(2, statusCol, lastRow, statusCol);
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("inactive_soft_locked")
      .setBackground(errRed)
      .setRanges([statusRange])
      .build());
    var fullDataRange = sh.getRange(2, 1, lastRow, lastCol);
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied("=$" + String.fromCharCode(64 + statusCol) + "2=\"inactive_soft_locked\"")
      .setBackground("#f8f9fa")
      .setRanges([fullDataRange])
      .build());
    var statusValidation = SpreadsheetApp.newDataValidation()
      .requireValueInList(["active", "inactive_soft_locked"], true)
      .setAllowInvalid(false)
      .build();
    statusRange.setDataValidation(statusValidation);
  }
  if (displayNameCol > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied("=ISBLANK($" + String.fromCharCode(64 + displayNameCol) + "2)")
      .setBackground(warnAmber)
      .setRanges([sh.getRange(2, displayNameCol, lastRow, displayNameCol)])
      .build());
  }
  if (headers.indexOf("email") >= 0) {
    var emailCol = headers.indexOf("email") + 1;
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied("=ISBLANK($" + String.fromCharCode(64 + emailCol) + "2)")
      .setBackground(warnAmber)
      .setRanges([sh.getRange(2, emailCol, lastRow, emailCol)])
      .build());
  }
  sh.setConditionalFormatRules(rules);

  /* isAdmin column: data validation allows only the strings "TRUE" or "FALSE". Any script or user edit that writes to this column must use exactly those values or the sheet will show a validation error (e.g. cell AA2). */
  if (isAdminCol > 0) {
    var adminRange = sh.getRange(2, isAdminCol, lastRow, isAdminCol);
    adminRange.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(["TRUE", "FALSE"], true)
      .setAllowInvalid(false)
      .build());
    adminRange.setBackground(accentPurple);
  }
  if (!sh.getFilter()) sh.getRange(1, 1, lastRow, lastCol).createFilter();
}

/**
 * Create/update "Admin Profiles View" sheet: profileId, displayName, status, isAdmin, Lanes (read-only).
 * Lanes: from laneControls when set (enabled lane keys), else from roleTracksJSON. Matches engine resolution.
 */
function ensureAdminProfilesView_() {
  var profiles;
  try {
    profiles = loadProfiles_();
  } catch (e) {
    return;
  }
  if (!profiles || profiles.length === 0) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Admin Profiles View");
  if (!sh) {
    sh = ss.insertSheet("Admin Profiles View");
  }
  sh.clear();
  var headers = ["profileId", "displayName", "status", "isAdmin", "Lanes (read-only)"];
  var rows = [headers];
  for (var i = 0; i < profiles.length; i++) {
    var p = profiles[i];
    var lanesStr = "—";
    if (p.laneControls && typeof p.laneControls === "object" && Object.keys(p.laneControls).length > 0) {
      var enabled = [];
      for (var key in p.laneControls) {
        if (!Object.prototype.hasOwnProperty.call(p.laneControls, key)) continue;
        var c = p.laneControls[key];
        if (c && c.is_enabled === true) enabled.push(String(key).trim());
      }
      lanesStr = enabled.length > 0 ? enabled.join(", ") : "—";
    } else {
      var tracks = Array.isArray(p.roleTracks) ? p.roleTracks : [];
      var laneLabels = tracks.map(function(t) { return (t && t.label) ? String(t.label).trim() : ""; }).filter(Boolean);
      lanesStr = laneLabels.length > 0 ? laneLabels.join(", ") : "—";
    }
    rows.push([
      p.profileId,
      p.displayName || p.profileId,
      p.status || "active",
      p.isAdmin ? "TRUE" : "FALSE",
      lanesStr
    ]);
  }
  sh.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e8eaed").setFontColor("#202124").setFontSize(12);
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 100);
  sh.setColumnWidth(2, 140);
  sh.setColumnWidth(3, 120);
  sh.setColumnWidth(4, 72);
  sh.setColumnWidth(5, 220);
}

/**
 * Apply ops-style format to Resume_Staging: theme header, checkboxes on Approved/Applied, conditional format, header notes (Approved/Applied legend).
 * Row 1 remains the header row; no rows inserted above it.
 */
function formatResumeStagingSheet_(sh) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  if (lastRow < 1) return;

  var headerBg = (typeof HEADER_BG !== "undefined") ? HEADER_BG : "#e8eaed";
  var headerText = (typeof HEADER_TEXT !== "undefined") ? HEADER_TEXT : "#202124";
  var mutedBg = (typeof PANEL_DARK !== "undefined") ? PANEL_DARK : "#f1f3f4";
  var accentGreen = (typeof ACCENT_GREEN !== "undefined") ? ACCENT_GREEN : "#e6f4ea";

  sh.setFrozenRows(1);
  var lastCol = Math.max(sh.getLastColumn(), 10);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || "").trim(); });
  var idxApproved = headers.indexOf("Approved");
  var idxApplied = headers.indexOf("Applied");

  sh.getRange(1, 1, 1, lastCol).setBackground(headerBg).setFontColor(headerText).setFontWeight("bold");
  if (typeof ROW_HEIGHT_HEADER !== "undefined") sh.setRowHeight(1, ROW_HEIGHT_HEADER);

  if (lastRow >= 2) {
    var dataRange = sh.getRange(1, 1, lastRow, lastCol);
    if (!sh.getFilter()) dataRange.createFilter();
    if (idxApproved >= 0) {
      sh.getRange(2, idxApproved + 1, lastRow, idxApproved + 1).insertCheckboxes();
      try { sh.getRange(1, idxApproved + 1).setNote("Approved = Include lane on next Apply"); } catch (e) { /* notes may be disabled */ }
    }
    if (idxApplied >= 0) {
      sh.getRange(2, idxApplied + 1, lastRow, idxApplied + 1).insertCheckboxes();
      try { sh.getRange(1, idxApplied + 1).setNote("Applied = Already applied to roleTracksJSON"); } catch (e) { /* notes may be disabled */ }
    }

    var dataRangeForRules = sh.getRange(2, 1, lastRow, lastCol);
    var rules = [];
    if (idxApplied >= 0) {
      var colApplied = idxApplied + 1;
      var letterApplied = colApplied <= 26 ? String.fromCharCode(64 + colApplied) : "G";
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied("=$" + letterApplied + "2=TRUE")
        .setBackground(mutedBg)
        .setRanges([dataRangeForRules])
        .build());
    }
    if (idxApproved >= 0 && idxApplied >= 0) {
      var colApproved = idxApproved + 1;
      var letterApproved = colApproved <= 26 ? String.fromCharCode(64 + colApproved) : "F";
      var letterApplied2 = (idxApplied + 1) <= 26 ? String.fromCharCode(64 + idxApplied + 1) : "G";
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied("=AND($" + letterApproved + "2=TRUE,$" + letterApplied2 + "2<>TRUE)")
        .setBackground(accentGreen)
        .setRanges([dataRangeForRules])
        .build());
    }
    sh.setConditionalFormatRules(rules);
  }
}

/**
 * Apply ops-style format to Jobs_Inbox: theme header, column widths, frozen row.
 */
function formatJobsInboxSheet_(sh) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  var headerBg = (typeof HEADER_BG !== "undefined") ? HEADER_BG : "#e8eaed";
  var headerText = (typeof HEADER_TEXT !== "undefined") ? HEADER_TEXT : "#202124";

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setBackground(headerBg).setFontColor(headerText).setFontWeight("bold");
  if (typeof ROW_HEIGHT_HEADER !== "undefined") sh.setRowHeight(1, ROW_HEIGHT_HEADER);
  sh.setColumnWidth(3, 180);   // title
  sh.setColumnWidth(5, 260);   // url
  sh.setColumnWidth(6, 120);  // enrichment_status
  sh.setColumnWidth(7, 140);   // missing_fields
  if (lastRow >= 2 && !sh.getFilter()) sh.getRange(1, 1, lastRow, sh.getLastColumn()).createFilter();
}

/**
 * Apply ops-style format to Role_Bank: theme header, column widths, frozen row.
 */
function formatRoleBankSheet_(sh) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  var headerBg = (typeof HEADER_BG !== "undefined") ? HEADER_BG : "#e8eaed";
  var headerText = (typeof HEADER_TEXT !== "undefined") ? HEADER_TEXT : "#202124";

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setBackground(headerBg).setFontColor(headerText).setFontWeight("bold");
  if (typeof ROW_HEIGHT_HEADER !== "undefined") sh.setRowHeight(1, ROW_HEIGHT_HEADER);
  sh.setColumnWidth(1, 260);   // url
  sh.setColumnWidth(4, 140);  // company
  sh.setColumnWidth(5, 180);  // title
  sh.setColumnWidth(9, 220);  // description_snippet
  if (lastRow >= 2 && !sh.getFilter()) sh.getRange(1, 1, lastRow, sh.getLastColumn()).createFilter();
}

/**
 * Apply ops-style format to Lane_Role_Bank: theme header, is_active checkboxes, dim inactive/merged/hidden rows.
 * Handles Option A columns: status, role_slug, source, merged_into_id.
 */
function formatLaneRoleBankSheet_(sh) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  if (lastRow < 1) return;

  var headerBg = (typeof HEADER_BG !== "undefined") ? HEADER_BG : "#e8eaed";
  var headerText = (typeof HEADER_TEXT !== "undefined") ? HEADER_TEXT : "#202124";
  var mutedBg = (typeof PANEL_DARK !== "undefined") ? PANEL_DARK : "#f1f3f4";

  var lastCol = Math.max(sh.getLastColumn(), 11);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, lastCol).setBackground(headerBg).setFontColor(headerText).setFontWeight("bold");
  if (typeof ROW_HEIGHT_HEADER !== "undefined") sh.setRowHeight(1, ROW_HEIGHT_HEADER);

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || "").trim(); });
  var idxActive = headers.indexOf("is_active");
  var idxStatus = headers.indexOf("status");
  if (idxActive >= 0 && lastRow >= 2) {
    sh.getRange(2, idxActive + 1, lastRow, idxActive + 1).insertCheckboxes();
  }
  if (lastRow >= 2) {
    var dataRange = sh.getRange(2, 1, lastRow, lastCol);
    var rules = [];
    if (idxActive >= 0) {
      var colLetter = idxActive + 1 <= 26 ? String.fromCharCode(64 + idxActive + 1) : "E";
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied("=$" + colLetter + "2=FALSE")
        .setBackground(mutedBg)
        .setRanges([dataRange])
        .build());
    }
    if (idxStatus >= 0) {
      var colStatus = idxStatus + 1;
      var letterStatus = colStatus <= 26 ? String.fromCharCode(64 + colStatus) : "K";
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied("=OR(LOWER($" + letterStatus + "2)=\"merged\",LOWER($" + letterStatus + "2)=\"hidden\")")
        .setBackground(mutedBg)
        .setRanges([dataRange])
        .build());
    }
    if (rules.length > 0) sh.setConditionalFormatRules(rules);
  }
}
