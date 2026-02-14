/****************************************************
 * core_utils.js
 * Shared utility functions used across the codebase
 * 
 * Keep this file lean - only truly shared functions.
 ****************************************************/

/**
 * Get API key from Script Properties.
 * Throws if not set.
 */
function getAPIKey_(name) {
  const key = PropertiesService
    .getScriptProperties()
    .getProperty(name);

  if (!key) {
    throw new Error(name + " not set in Script Properties");
  }

  return key;
}

/**
 * Get API key from Script Properties.
 * Returns null if not set (for optional sources like Jooble, Adzuna).
 */
function getOptionalAPIKey_(name) {
  return PropertiesService.getScriptProperties().getProperty(name) || null;
}

/**
 * Ensure a sheet exists, create if missing.
 * Used by multiple modules (logging, analytics, engine tables).
 */
function ensureSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet.");
  
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/**
 * Normalize URLs for dedupe.
 * - Trims whitespace
 * - Removes fragments (#...)
 * - Strips common tracking params (utm_*, ref, source, referrer)
 * - Removes trailing slash
 */
function normalizeUrl_(url) {
  var u = String(url || "").trim();
  if (!u) return "";

  // Remove fragments
  u = u.split("#")[0];

  // Strip tracking query params
  var parts = u.split("?");
  if (parts.length > 1) {
    var base = parts[0];
    var qs = parts.slice(1).join("?");

    var kept = [];
    qs.split("&").forEach(function(pair) {
      var p = String(pair || "").trim();
      if (!p) return;

      var k = p.split("=")[0].toLowerCase().trim();
      if (k.indexOf("utm_") === 0) return;
      if (k === "ref" || k === "referrer" || k === "source") return;

      kept.push(p);
    });

    u = kept.length ? (base + "?" + kept.join("&")) : base;
  }

  // Remove trailing slash
  if (u.length > 1 && u.charAt(u.length - 1) === "/") {
    u = u.slice(0, -1);
  }

  return u;
}

/**
 * Build a fallback dedupe key from company + title.
 * Used when URL is missing.
 */
function buildFallbackKey_(company, title) {
  var c = String(company || "").toLowerCase().trim();
  var t = String(title || "").toLowerCase().trim();
  if (!c || !t) return "";
  return c + "||" + t;
}

/**
 * Truncate a string to maxLen, adding "..." if truncated.
 */
function truncateStr_(str, maxLen) {
  var s = String(str || "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}

/**
 * Set a row cell by header name. Shared by admin_create_profile and admin_debug.
 * @param {string[]} headers - Row of header names
 * @param {Array} row - Mutable row array
 * @param {string} key - Header name
 * @param {*} value - Value to set
 */
function setByHeader_(headers, row, key, value) {
  var idx = headers.indexOf(key);
  if (idx !== -1) row[idx] = value;
}
