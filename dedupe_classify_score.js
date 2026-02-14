/****************************************************
 * dedupe_classify_score.gs
 * Dedupe → Classify → Score (Blueprint-aligned)
 *
 * Blueprint notes:
 * - Classification picks roleTrack via keyword hits weighted by priorityWeight
 * - Tie-breakers: higher priorityWeight, then more skillKeywordsPlus matches
 * - If below minimum threshold → roleType="Unknown", laneLabel="Review JD", category="Unknown"
 * - Scoring: hard filters -> Tier X, lane priorityWeight acts as multiplier
 ****************************************************/

function dedupeJobs_(jobs) {
  const out = [];
  const seenUrl = new Set();
  const seenKey = new Set();

  for (const j of jobs || []) {
    const url = String(j.url || "").trim();
    const key = (
      String(j.company || "").toLowerCase().trim() +
      "||" +
      String(j.title || "").toLowerCase().trim()
    );

    if (url) {
      if (seenUrl.has(url)) continue;
      seenUrl.add(url);
    } else {
      if (seenKey.has(key)) continue;
      seenKey.add(key);
    }

    out.push(j);
  }

  return out;
}

/**
 * Classification (Blueprint 10.1)
 * - Combine title + description
 * - Count roleKeywords hits
 * - Weight by priorityWeight
 * - Tie-breakers:
 *    1) higher priorityWeight
 *    2) more skillKeywordsPlus matches
 * - If below minimum threshold -> Unknown / Review JD / Unknown
 */
function classifyJobsForProfile_(jobs, profile) {
  const tracks = getEffectiveRoleTracks_(profile);

  // Minimum threshold for classification (weighted score).
  // Blueprint says "below minimum threshold" -> Review JD.
  // Default keeps behavior sane without adding new config requirements.
  const MIN_WEIGHTED = (CONFIG && typeof CONFIG.CLASSIFY_MIN_WEIGHTED === "number")
    ? CONFIG.CLASSIFY_MIN_WEIGHTED
    : 1; // 1 = at least one weighted hit required

  const plus = (profile.skillKeywordsPlus || [])
    .map(s => String(s).toLowerCase().trim())
    .filter(Boolean);

  return (jobs || []).map(job => {
    const text = (String(job.title || "") + "\n" + String(job.description || "")).toLowerCase();

    // Used only for tie-breaker (more skillKeywordsPlus matches)
    const plusHits = countKeywordHits_(text, plus);

    let best = null;

    // Primary score: weighted role hits
    let bestWeighted = -1;
    let bestHits = -1;

    // Tie-breakers
    let bestWeight = -1;
    let bestPlusHits = -1;

    for (const t of tracks) {
      if (!t) continue;

      const kws = Array.isArray(t.roleKeywords) ? t.roleKeywords : [];
      const roleHits = countKeywordHits_(text, kws);

      const priorityWeight = Number(t.priorityWeight || 1);
      const weighted = roleHits * priorityWeight;

      // Choose best by weighted score, then tie-breakers per blueprint
      const isBetter =
        (weighted > bestWeighted) ||
        (weighted === bestWeighted && priorityWeight > bestWeight) ||
        (weighted === bestWeighted && priorityWeight === bestWeight && plusHits > bestPlusHits) ||
        (weighted === bestWeighted && priorityWeight === bestWeight && plusHits === bestPlusHits && roleHits > bestHits);

      if (isBetter) {
        best = t;
        bestWeighted = weighted;
        bestHits = roleHits;
        bestWeight = priorityWeight;
        bestPlusHits = plusHits;
      }
    }

    // Below minimum threshold -> Unknown / Review JD / Unknown :contentReference[oaicite:3]{index=3}
    if (!best || bestWeighted < MIN_WEIGHTED) {
      return Object.assign({}, job, {
        roleType: "Unknown",
        laneLabel: "Review JD",
        category: "Unknown",
        matchHits: 0,
        _classify: { weighted: bestWeighted < 0 ? 0 : bestWeighted, plusHits }
      });
    }

    return Object.assign({}, job, {
      roleType: String(best.id || "Unknown"),
      laneLabel: String(best.laneLabel || "Review JD"),
      category: String(best.label || "Unknown"),
      matchHits: bestHits,
      _classify: { weighted: bestWeighted, plusHits, priorityWeight: bestWeight }
    });
  });
}

/**
 * Scoring (Blueprint 10.2)
 * - Hard filters -> Tier X (excluded, score=-999)
 * - Positive signals, then lane priorityWeight acts as multiplier
 * - Tier mapping: S 90+, A 75–89, B 60–74, C 0–59, F <0, X -999 :contentReference[oaicite:4]{index=4}
 */
function scoreJobsForProfile_(jobs, profile) {
  const banned = new Set((profile.bannedKeywords || []).map(s => String(s).toLowerCase().trim()).filter(Boolean));
  const disq = new Set((profile.disqualifyingSeniority || []).map(s => String(s).toLowerCase().trim()).filter(Boolean));

  const plus = (profile.skillKeywordsPlus || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
  const minus = (profile.skillKeywordsMinus || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);

  return (jobs || []).map(job => {
    const text = (String(job.title || "") + "\n" + String(job.description || "")).toLowerCase();

    // Hard filters → Tier X :contentReference[oaicite:5]{index=5}
    for (const k of banned) {
      if (k && text.includes(k)) return markExcluded_(job, "bannedKeyword:" + k);
    }
    for (const k of disq) {
      if (k && text.includes(k)) return markExcluded_(job, "disqualifyingSeniority:" + k);
    }

    // Disallowed content filters (treated as hard stop here)
    if (profile.allowSalesHeavy === false && hasAny_(text, ["cold call", "outbound", "quota", "commission"])) {
      return markExcluded_(job, "salesHeavy");
    }
    if (profile.allowPhoneHeavy === false && hasAny_(text, ["high call volume", "call center"])) {
      return markExcluded_(job, "phoneHeavy");
    }
    if (profile.allowWeekendWork === false && hasAny_(text, ["weekend", "saturdays", "sundays"])) {
      return markExcluded_(job, "weekendWork");
    }
    if (profile.allowShiftWork === false && hasAny_(text, ["shift work", "overnight", "rotating shifts"])) {
      return markExcluded_(job, "shiftWork");
    }

    // --- scoring core ---
    let score = 0;

    // Role match (track) = +30–40 (we keep your shape but blueprint-aligned) :contentReference[oaicite:6]{index=6}
    const hits = Number(job.matchHits || 0);
    if (job.roleType && job.roleType !== "Unknown") {
      score += 30;
      score += Math.min(10, hits * 3); // pushes toward 40-ish max
    }

    // Remote preference alignment = +5–10 :contentReference[oaicite:7]{index=7}
    const pref = String(profile.remotePreference || "remote_only");
    const loc = String(job.location || "").toLowerCase();
    const looksRemote = (job.remote === true) || (job.remote === "hybrid") || loc.includes("remote");

    if (pref === "remote_only") {
      if (looksRemote) score += 10;
      else score -= 50; // strong penalty (keeps your current behavior)
    } else if (pref === "remote_or_hybrid") {
      if (looksRemote || loc.includes("hybrid")) score += 8;
    } else if (pref === "onsite_ok") {
      // no bonus, no penalty
    }

    // Each skillKeywordsPlus hit = +2–6; minus hits are penalties :contentReference[oaicite:8]{index=8}
    // keep your v1 weights but slightly more blueprint-like
    plus.forEach(k => { if (k && text.includes(k)) score += 3; });
    minus.forEach(k => { if (k && text.includes(k)) score -= 4; });

    // Lane priorityWeight acts as multiplier :contentReference[oaicite:9]{index=9}
    // Use the track weight we computed during classification if present.
    const laneW = Number(job._classify && job._classify.priorityWeight ? job._classify.priorityWeight : 1);
    const weightedScore = Math.round(score * Math.max(1, laneW));

    const tier = tierFromScore_(weightedScore);

    return Object.assign({}, job, {
      score: weightedScore,
      tier,
      excluded: false
    });
  });
}

function markExcluded_(job, reason) {
  return Object.assign({}, job, {
    score: -999,
    tier: "X",
    excluded: true,
    _excludeReason: reason
  });
}

// Tier mapping per blueprint :contentReference[oaicite:10]{index=10}
function tierFromScore_(score) {
  if (score === -999) return "X";
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 0) return "C";
  return "F";
}

/**
 * Tier gate: if any job has tier S/A/B/C/D, exclude all F-tier from the list.
 * Only show F when there are zero S/A/B/C/D jobs (last-resort).
 */
function filterTierGate_(jobs) {
  if (!jobs || !jobs.length) return jobs;
  const hasUpper = (jobs || []).some(j => {
    const t = String(j.tier || "").toUpperCase();
    return t === "S" || t === "A" || t === "B" || t === "C" || t === "D";
  });
  if (!hasUpper) return jobs;
  return jobs.filter(j => String(j.tier || "").toUpperCase() !== "F");
}

function hasAny_(text, phrases) {
  const t = String(text || "").toLowerCase();
  return (phrases || []).some(p => t.includes(String(p).toLowerCase()));
}

/**
 * Counts unique keyword hits (simple includes). Empty keywords ignored.
 * Accepts array of strings; normalizes to lowercase trimmed.
 */
function countKeywordHits_(lowerText, keywords) {
  const text = String(lowerText || "");
  const arr = Array.isArray(keywords) ? keywords : [];
  let hits = 0;

  for (const k of arr) {
    const kw = String(k || "").toLowerCase().trim();
    if (!kw) continue;
    if (text.includes(kw)) hits++;
  }

  return hits;
}
