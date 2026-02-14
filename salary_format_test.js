/**
 * Unit tests for formatSalaryDisplay_: no long decimals, no double "k".
 * Run from Script Editor: runSalaryFormatTests_()
 * Requires: fetch_enriched.js (formatSalaryDisplay_) in project.
 */

function runSalaryFormatTests_() {
  var results = [];
  try {
    testNoLongDecimals_(results);
    testRangeNoDoubleK_(results);
    testUnderThousand_(results);
  } catch (e) {
    results.push("FAIL: " + (e.message || String(e)));
  }
  var msg = results.length ? results.join("\n") : "No assertions run.";
  if (typeof Logger !== "undefined") Logger.log(msg);
  if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getUi()) {
    SpreadsheetApp.getUi().alert("Salary Format Tests\n\n" + msg);
  }
  return results;
}

function testNoLongDecimals_(results) {
  var salary = { min: 78350.35, max: null, currency: "USD" };
  var out = formatSalaryDisplay_(salary);
  if (out.indexOf("78.35035") !== -1) {
    results.push("FAIL: formatSalaryDisplay_ must not output long decimals (got " + out + ")");
    return;
  }
  if (out.indexOf("k") === -1 || out.indexOf("78") === -1) {
    results.push("FAIL: expected ~$78k or $78.4k, got " + out);
    return;
  }
  results.push("PASS: no long decimals (e.g. 78350.35 -> " + out + ")");
}

function testRangeNoDoubleK_(results) {
  var salary = { min: 95000, max: 120000, currency: "USD" };
  var out = formatSalaryDisplay_(salary);
  var hasDoubleK = (out.match(/k/g) || []).length > 2;
  if (hasDoubleK || out.indexOf("95k") === -1 || out.indexOf("120k") === -1) {
    results.push("FAIL: expected $95k–$120k style, no double k (got " + out + ")");
    return;
  }
  results.push("PASS: range formats as $95k–$120k (got " + out + ")");
}

function testUnderThousand_(results) {
  var salary = { min: 500, max: null, currency: "USD" };
  var out = formatSalaryDisplay_(salary);
  if (out.indexOf("0.5k") !== -1) {
    results.push("FAIL: 500 should not show as 0.5k (got " + out + ")");
    return;
  }
  if (out.indexOf("500") === -1) {
    results.push("FAIL: expected $500 or 500, got " + out);
    return;
  }
  results.push("PASS: under 1000 shows as number (got " + out + ")");
}
