/**
 * Micro test: range must be derived only from values.length / values[0].length
 * so that setValues never sees "data rows does not match range".
 * Run from Script Editor: runSheetWriteGuardTests_()
 * No real sheet writes; uses a mock that throws if range dimensions don't match data.
 */

function runSheetWriteGuardTests_() {
  var results = [];
  try {
    testSheetWriteGuardZeroRows_(results);
    testSheetWriteGuardOneRow_(results);
    testSheetWriteGuardElevenRows_(results);
    testSheetWriteGuardLarge_(results);
  } catch (e) {
    results.push("FAIL: " + (e.message || String(e)));
  }
  var msg = results.length ? results.join("\n") : "No assertions run.";
  if (typeof Logger !== "undefined") Logger.log(msg);
  if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getUi()) {
    SpreadsheetApp.getUi().alert("Sheet write guard tests\n\n" + msg);
  }
  return results;
}

/**
 * Mock sheet: getRange(row, col, numRows, numCols) returns range with setValues(values).
 * setValues throws if numRows !== values.length or numCols !== (values[0]?.length).
 */
function makeMockSheet_() {
  var lastNumRows, lastNumCols;
  return {
    getRange: function (startRow, startCol, numRows, numCols) {
      lastNumRows = numRows;
      lastNumCols = numCols;
      return {
        setValues: function (values) {
          if (numRows !== values.length) {
            throw new Error("The number of rows in the data does not match the number of rows in the range. The data has " + values.length + " but the range has " + numRows + ".");
          }
          var cols = values[0] && values[0].length;
          if (values.length > 0 && numCols !== cols) {
            throw new Error("Column count mismatch: data cols " + cols + " vs range " + numCols);
          }
        }
      };
    }
  };
}

/**
 * Rule: range is derived ONLY from values. numRows = values.length, numCols = values[0].length.
 * Never use endRow (e.g. 1 + values.length); never compute 0-row update for data.
 */
function writeValuesWithGuard_(sheet, startRow, startCol, values) {
  if (!values || values.length === 0) return 0;
  var numRows = values.length;
  var numCols = values[0] && values[0].length ? values[0].length : 0;
  if (numRows !== values.length) throw new Error("Engine_Inbox: range rows " + numRows + " != data rows " + values.length);
  sheet.getRange(startRow, startCol, numRows, numCols).setValues(values);
  return values.length;
}

function testSheetWriteGuardZeroRows_(results) {
  var sh = makeMockSheet_();
  var written = writeValuesWithGuard_(sh, 1, 1, []);
  if (written !== 0) results.push("FAIL: 0 rows should return 0");
  else results.push("PASS: 0 rows (no setValues call, no 0-row range)");
}

function testSheetWriteGuardOneRow_(results) {
  var sh = makeMockSheet_();
  var values = [["a", "b"]];
  writeValuesWithGuard_(sh, 1, 1, values);
  results.push("PASS: 1 row");
}

function testSheetWriteGuardElevenRows_(results) {
  var sh = makeMockSheet_();
  var values = [];
  for (var i = 0; i < 11; i++) values.push(["r" + i, "c2"]);
  writeValuesWithGuard_(sh, 1, 1, values);
  results.push("PASS: 11 rows");
}

function testSheetWriteGuardLarge_(results) {
  var sh = makeMockSheet_();
  var values = [];
  for (var i = 0; i < 100; i++) values.push(["r" + i, "c2", "c3"]);
  writeValuesWithGuard_(sh, 1, 1, values);
  results.push("PASS: 100 rows");
}
