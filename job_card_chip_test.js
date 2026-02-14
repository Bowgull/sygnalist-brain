/**
 * Tests for job card meta chips: order (Tier, Lane, Salary, Location, Source) and salary provenance (listed, inferred, missing).
 * Run from Script Editor: runJobCardChipTests_()
 * No DOM or sheet required; asserts on built HTML string.
 */

function runJobCardChipTests_() {
  var results = [];
  try {
    testChipOrder_(results);
    testSalaryListed_(results);
    testSalaryInferred_(results);
    testSalaryMissing_(results);
  } catch (e) {
    results.push("FAIL: " + (e.message || String(e)));
  }
  var msg = results.length ? results.join("\n") : "No assertions run.";
  if (typeof Logger !== "undefined") Logger.log(msg);
  if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getUi()) {
    SpreadsheetApp.getUi().alert("Job Card Chip Tests\n\n" + msg);
  }
  return results;
}

/**
 * Builds job-meta HTML fragment mirroring portal order: Tier, Lane, Salary, Location, Source.
 * Used only for tests; portal builds this in portal_scripts.html.
 */
function buildJobMetaHtmlForTest_(job) {
  var tier = String(job.tier || "C").toUpperCase();
  var parts = [];
  parts.push("<span class=\"chip chip-tier chip-tier-" + tier.toLowerCase() + "\">Tier " + tier + " · " + (job.score || 0) + "</span>");
  if (job.laneLabel) {
    var laneLabel = String(job.laneLabel).trim().replace(/\s+Lane\s*$/i, "").trim() || job.laneLabel;
    parts.push("<span class=\"chip chip-role\">" + laneLabel + "</span>");
  }
  var salarySource = (job.salary_source && String(job.salary_source).trim()) || "missing";
  var salaryText = job.salary && String(job.salary).trim() && job.salary !== "—" ? String(job.salary).trim() : "Salary not listed";
  var salaryChipClass = "chip job-salary";
  var salaryChipContent = salaryText;
  var salaryChipTitle = "";
  if (salarySource === "inferred") {
    salaryChipClass += " job-salary-inferred";
    salaryChipContent = salaryText;
  } else if (salarySource === "missing" || salaryText === "Salary not listed") {
    salaryChipClass += " job-salary-missing";
    salaryChipContent = "Salary not listed";
  }
  parts.push("<span class=\"" + salaryChipClass + "\"" + salaryChipTitle + ">" + salaryChipContent + "</span>");
  parts.push("<span class=\"chip\">" + (job.location || "Remote") + "</span>");
  parts.push("<span class=\"chip\">" + (job.source || "") + "</span>");
  return parts.join("");
}

function testChipOrder_(results) {
  var job = {
    tier: "A",
    score: 85,
    laneLabel: "Engineering Lane",
    salary: "$80k–$120k",
    salary_source: "listed",
    location: "Remote",
    source: "remotive"
  };
  var html = buildJobMetaHtmlForTest_(job);
  var iTier = html.indexOf("chip-tier");
  var iRole = html.indexOf("chip-role");
  var iSalary = html.indexOf("job-salary");
  var iLocation = html.indexOf("Remote");
  var iSource = html.indexOf("remotive");
  if (iTier === -1 || iRole === -1 || iSalary === -1) {
    results.push("FAIL: chip order test – missing chip class");
    return;
  }
  if (iTier < iRole && iRole < iSalary && iSalary < iLocation && iLocation < iSource) {
    results.push("PASS: chip order is Tier, Lane, Salary, Location, Source");
  } else {
    results.push("FAIL: chip order – expected Tier then Lane then Salary then Location then Source (indexes: tier=" + iTier + " role=" + iRole + " salary=" + iSalary + " loc=" + iLocation + " src=" + iSource + ")");
  }
}

function testSalaryListed_(results) {
  var job = {
    tier: "B",
    score: 70,
    laneLabel: "Sales",
    salary: "$90k–$110k",
    salary_source: "listed",
    location: "NYC",
    source: "adzuna_us"
  };
  var html = buildJobMetaHtmlForTest_(job);
  if (html.indexOf("$90k–$110k") !== -1 && html.indexOf("Salary not listed") === -1 && html.indexOf("job-salary-missing") === -1 && html.indexOf("title=\"Estimated\"") === -1) {
    results.push("PASS: listed salary shows formatted value, no missing chip, no Estimated tooltip");
  } else {
    results.push("FAIL: listed salary – expected formatted value, no 'Salary not listed', no Estimated");
  }
}

function testSalaryInferred_(results) {
  var job = {
    tier: "C",
    score: 60,
    salary: "$70k",
    salary_source: "inferred",
    location: "Remote",
    source: "remoteok"
  };
  var html = buildJobMetaHtmlForTest_(job);
  if (html.indexOf("job-salary-inferred") !== -1 && html.indexOf("$70k") !== -1) {
    results.push("PASS: inferred salary shows inferred class and value (visual only, no Est. or tooltip)");
  } else {
    results.push("FAIL: inferred salary – expected job-salary-inferred class and salary value");
  }
}

function testSalaryMissing_(results) {
  var job = {
    tier: "C",
    score: 50,
    laneLabel: "Support",
    salary_source: "missing",
    location: "Worldwide",
    source: "jooble"
  };
  var html = buildJobMetaHtmlForTest_(job);
  if (html.indexOf("Salary not listed") !== -1 && html.indexOf("job-salary-missing") !== -1) {
    results.push("PASS: missing salary shows 'Salary not listed' and missing class");
  } else {
    results.push("FAIL: missing salary – expected 'Salary not listed' and job-salary-missing");
  }
}
