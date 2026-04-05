import type { RawJob } from "@/lib/sources/types";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface ScoredJob extends RawJob {
  score: number;
  tier: string;
  match_hits: number;
  salary_below_min: boolean;
  lane_label: string | null;
  category: string | null;
  // Enrichment fields (filled later in Phase 6)
  job_summary: string | null;
  why_fit: string | null;
}

interface RoleTrack {
  label?: string;
  roleKeywords?: string[];
  priorityWeight?: number;
}

interface LaneControl {
  laneKey?: string;
  laneLabel?: string;
  enabled?: boolean;
  roles?: string[];
}

/** Common German words that appear in job postings - require 3+ matches to flag */
const GERMAN_MARKERS = [
  "und", "oder", "für", "mit", "von", "wir", "sie", "ihre",
  "aufgaben", "anforderungen", "bewerbung", "berufserfahrung",
  "unternehmen", "kenntnisse", "stellenangebot", "verantwortung",
  "erfahrung", "bereich", "arbeiten", "bieten", "suchen",
];

const UMLAUT_RE = /[äöüÄÖÜß]/g;

/** Detect if text is likely German. Returns "de" or null. */
function detectLanguage(text: string): string | null {
  const lower = text.toLowerCase();
  // Check German word markers (require 3+ distinct hits to avoid false positives)
  let hits = 0;
  for (const marker of GERMAN_MARKERS) {
    if (new RegExp(`\\b${marker}\\b`).test(lower)) {
      hits++;
      if (hits >= 3) return "de";
    }
  }
  // Check umlaut density - 3+ umlauts in title+snippet is a strong signal
  const umlauts = text.match(UMLAUT_RE);
  if (umlauts && umlauts.length >= 3) return "de";

  return null;
}

/** Score and rank a set of raw jobs against a profile */
export function scoreJobs(jobs: RawJob[], profile: Profile): ScoredJob[] {
  const scored = jobs.map((job) => scoreOne(job, profile));

  // Remove hard-excluded jobs (score <= -900)
  const valid = scored.filter((j) => j.score > -900);

  // Sort by score descending
  valid.sort((a, b) => b.score - a.score);

  return valid;
}

function scoreOne(job: RawJob, profile: Profile): ScoredJob {
  let score = 50; // Base score
  let matchHits = 0;
  let laneLabel: string | null = null;
  let category: string | null = null;

  const titleLower = (job.title ?? "").toLowerCase();
  const companyLower = (job.company ?? "").toLowerCase();
  const snippetLower = (job.description_snippet ?? "").toLowerCase();
  const locationLower = (job.location ?? "").toLowerCase();
  const fullText = `${titleLower} ${companyLower} ${snippetLower}`;

  // --- Banned keyword check (hard exclude) ---
  for (const banned of profile.banned_keywords ?? []) {
    if (banned && fullText.includes(banned.toLowerCase())) {
      return makeScoredJob(job, -999, "F", 0, false, null, null);
    }
  }

  // --- Disqualifying seniority (hard exclude) ---
  for (const level of profile.disqualifying_seniority ?? []) {
    if (level && titleLower.includes(level.toLowerCase())) {
      return makeScoredJob(job, -999, "F", 0, false, null, null);
    }
  }

  // --- Language filter (hard exclude non-matching languages) ---
  const acceptedLanguages = new Set(
    (profile.preferred_languages?.length ? profile.preferred_languages : ["en"]).map((l) => l.toLowerCase()),
  );
  const detectedLang = detectLanguage(fullText);
  if (detectedLang && !acceptedLanguages.has(detectedLang)) {
    return makeScoredJob(job, -999, "F", 0, false, null, null);
  }

  // --- Work-type preference filters ---
  const isRemote = job.work_mode?.toLowerCase() === "remote" || titleLower.includes("remote");
  const isHybrid = job.work_mode?.toLowerCase() === "hybrid" || titleLower.includes("hybrid");
  const isOnsite = !isRemote && !isHybrid;

  if (isRemote && !profile.accept_remote) score -= 30;
  if (isHybrid && !profile.accept_hybrid) score -= 30;
  if (isOnsite && !profile.accept_onsite) score -= 30;

  // --- Location check: hard exclude wrong-location onsite/hybrid ---
  if ((isOnsite || isHybrid) && job.location) {
    const countries = (profile.preferred_countries ?? []).map((c) => c.toLowerCase());
    const locations = (profile.preferred_locations ?? []).map((l) => l.toLowerCase());
    const cities = (profile.preferred_cities ?? []).map((c) => c.toLowerCase());
    const blacklist = (profile.location_blacklist ?? []).map((l) => l.toLowerCase());

    // Check blacklist first
    for (const bl of blacklist) {
      if (bl && locationLower.includes(bl)) {
        return makeScoredJob(job, -999, "F", 0, false, null, null);
      }
    }

    // For onsite/hybrid, require location match
    const allAllowed = [...countries, ...locations, ...cities];
    if (allAllowed.length > 0) {
      const locationMatch = allAllowed.some((loc) => locationLower.includes(loc));
      if (!locationMatch) {
        return makeScoredJob(job, -999, "F", 0, false, null, null);
      }
    }
  }

  // Remote: just check blacklist, no location requirement
  if (isRemote && job.location) {
    const blacklist = (profile.location_blacklist ?? []).map((l) => l.toLowerCase());
    for (const bl of blacklist) {
      if (bl && locationLower.includes(bl)) {
        return makeScoredJob(job, -999, "F", 0, false, null, null);
      }
    }
  }

  // --- Role preferences (sales, phone, weekend, shift) ---
  if (!profile.allow_sales_heavy && /\b(sales|quota|revenue target|commission)\b/i.test(fullText)) {
    score -= 25;
  }
  if (!profile.allow_phone_heavy && /\b(cold call|outbound call|phone screen|telemarket)\b/i.test(fullText)) {
    score -= 25;
  }
  if (!profile.allow_weekend_work && /\b(weekend|saturday|sunday)\b/i.test(fullText)) {
    score -= 15;
  }
  if (!profile.allow_shift_work && /\b(shift work|rotating shift|night shift|graveyard)\b/i.test(fullText)) {
    score -= 15;
  }

  // --- Skill keyword matching ---
  for (const skill of profile.skill_keywords_plus ?? []) {
    if (skill && fullText.includes(skill.toLowerCase())) {
      score += 8;
      matchHits++;
    }
  }
  for (const neg of profile.skill_keywords_minus ?? []) {
    if (neg && fullText.includes(neg.toLowerCase())) {
      score -= 10;
    }
  }

  // --- Top skills boost ---
  for (const skill of profile.top_skills ?? []) {
    if (skill && fullText.includes(skill.toLowerCase())) {
      score += 5;
      matchHits++;
    }
  }

  // --- Role track matching (lane assignment + score boost) ---
  const tracks = Array.isArray(profile.role_tracks) ? (profile.role_tracks as RoleTrack[]) : [];
  const lanes = Array.isArray(profile.lane_controls) ? (profile.lane_controls as LaneControl[]) : [];

  let bestTrackWeight = 0;
  for (const track of tracks) {
    const trackLabel = (track.label ?? "").toLowerCase();
    const keywords = track.roleKeywords ?? [];
    const weight = track.priorityWeight ?? 1.0;

    const titleMatchesTrack =
      (trackLabel && titleLower.includes(trackLabel)) ||
      keywords.some((kw) => kw && titleLower.includes(kw.toLowerCase()));

    if (titleMatchesTrack && weight > bestTrackWeight) {
      bestTrackWeight = weight;
      // Find matching lane
      const matchedLane = lanes.find(
        (l) => l.enabled !== false && l.roles?.some((r) => r.toLowerCase() === trackLabel),
      );
      laneLabel = matchedLane?.laneLabel ?? track.label ?? null;
      category = track.label ?? null;
    }
  }

  if (bestTrackWeight > 0) {
    score += Math.round(15 * bestTrackWeight);
    matchHits++;
  }

  // --- Salary check (flag, don't exclude) ---
  let salaryBelowMin = false;
  if (profile.salary_min > 0 && job.salary) {
    const parsed = parseSalaryMax(job.salary);
    if (parsed !== null && parsed < profile.salary_min) {
      salaryBelowMin = true;
    }
  }

  // --- Source bonus (free sources get slight penalty vs paid) ---
  if (job.source === "arbeitnow" || job.source === "himalayas") {
    score -= 3; // Free sources tend to be less targeted
  }

  // --- Remote bonus (if user prefers remote) ---
  if (isRemote && profile.accept_remote) {
    score += 5;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  const tier = scoreTier(score);

  return makeScoredJob(job, score, tier, matchHits, salaryBelowMin, laneLabel, category);
}

function makeScoredJob(
  job: RawJob,
  score: number,
  tier: string,
  matchHits: number,
  salaryBelowMin: boolean,
  laneLabel: string | null,
  category: string | null,
): ScoredJob {
  return {
    ...job,
    score,
    tier,
    match_hits: matchHits,
    salary_below_min: salaryBelowMin,
    lane_label: laneLabel,
    category,
    job_summary: null,
    why_fit: null,
  };
}

function scoreTier(score: number): string {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 35) return "C";
  return "F";
}

/** Extract max salary number from a salary string like "$80,000 - $120,000" */
function parseSalaryMax(salary: string): number | null {
  const matches = salary.match(/[\d,]+/g);
  if (!matches || matches.length === 0) return null;
  const nums = matches.map((m) => parseInt(m.replace(/,/g, ""), 10)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return Math.max(...nums);
}
