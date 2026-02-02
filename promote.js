/****************************************************
 * promote.gs
 * Inbox/Enriched → Tracker promotion (idempotent + dedupe)
 *
 * Stability principles:
 * - Per-profile lock (withProfileLock_)
 * - Throttle promote spam
 * - Idempotent write with strict dedupe (profileId + url OR fallback key)
 ****************************************************/

function promoteEnrichedJobToTracker_(profileId, enrichedJob) {
  const profile = getProfileByIdOrThrow_(profileId);
  assertProfileActiveOrThrow_(profile);

  const batchId = newBatchId_();

  return withProfileLock_(profile.profileId, "promote", () => {
    // prevent spam-clicks
    assertNotThrottled_(profile.profileId, "promote", 1500);

    const entry = buildTrackerEntryFromEnrichedJob_(enrichedJob, profile.profileId);

    // Hard idempotency: if already in tracker, do nothing + return DUPLICATE
    if (trackerHasDuplicateForProfile_(profile.profileId, entry)) {
      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId,
        action: "promote",
        source: "promote",
        details: {
          level: "WARN",
          message: "Duplicate blocked",
          meta: {
            batchId,
            url: String(entry.url || ""),
            key: buildDedupKey_(entry)
          },
          batchId,
          version: Sygnalist_VERSION
        }
      });

      return uiError_("DUPLICATE", "Already in Tracker.", { batchId });
    }

    appendTrackerEntry_(entry);

    logEvent_({
      timestamp: Date.now(),
      profileId: profile.profileId,
      action: "promote",
      source: "promote",
      details: {
        level: "INFO",
        message: "Promoted to Tracker",
        meta: { batchId, url: String(entry.url || "") },
        batchId,
        version: Sygnalist_VERSION
      }
    });

    return { ok: true, version: Sygnalist_VERSION, batchId };
  });
}

/**
 * Strict dedupe (per profile).
 * Primary: normalized URL
 * Fallback: company||title key
 * 
 * Uses BOUNDED reads for performance (doesn't read entire wide sheet)
 */
function trackerHasDuplicateForProfile_(profileId, entry) {
  ensureEngineTables_();

  const pid = String(profileId || "").trim();
  if (!pid) throw new Error("trackerHasDuplicateForProfile_: profileId is empty.");

  const sh = assertSheetExists_("Engine_Tracker");
  
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return false;  // Header only or empty
  
  // Bounded read: only read up to last column with a header
  const lastCol = getLastHeaderCol_(sh);
  if (lastCol < 1) return false;
  
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 2) return false;

  const headers = values[0].map(h => String(h).trim());
  const idxProfile = headers.indexOf("profileId");
  const idxUrl = headers.indexOf("url");
  const idxCompany = headers.indexOf("company");
  const idxTitle = headers.indexOf("title");

  if (idxProfile === -1) throw new Error("Engine_Tracker missing header: profileId");
  if (idxUrl === -1) throw new Error("Engine_Tracker missing header: url");
  if (idxCompany === -1) throw new Error("Engine_Tracker missing header: company");
  if (idxTitle === -1) throw new Error("Engine_Tracker missing header: title");

  const entryUrl = normalizeUrl_(entry && entry.url);
  const entryKey = buildFallbackKey_(entry && entry.company, entry && entry.title);

  for (let r = 1; r < values.length; r++) {
    const rowPid = String(values[r][idxProfile] || "").trim();
    if (rowPid !== pid) continue;

    const rowUrl = normalizeUrl_(values[r][idxUrl]);
    if (entryUrl && rowUrl && rowUrl === entryUrl) return true;

    // URL missing? fallback key
    if (!entryUrl && entryKey) {
      const rowKey = buildFallbackKey_(values[r][idxCompany], values[r][idxTitle]);
      if (rowKey && rowKey === entryKey) return true;
    }
  }

  return false;
}

/**
 * Find the last column with a non-empty header.
 * Prevents reading 500 empty columns if sheet got accidentally wide.
 */
function getLastHeaderCol_(sh) {
  const maxCol = sh.getLastColumn();
  if (maxCol < 1) return 0;
  
  const headerRow = sh.getRange(1, 1, 1, maxCol).getValues()[0];
  for (let c = headerRow.length - 1; c >= 0; c--) {
    const v = String(headerRow[c] || "").trim();
    if (v) return c + 1;
  }
  return 0;
}

/**
 * For logging / debugging only.
 */
function buildDedupKey_(entry) {
  const url = normalizeUrl_(entry && entry.url);
  if (url) return "url::" + url;

  const key = buildFallbackKey_(entry && entry.company, entry && entry.title);
  return key ? "key::" + key : "unknown";
}

// Note: buildFallbackKey_() and normalizeUrl_() are now in core_utils.js
