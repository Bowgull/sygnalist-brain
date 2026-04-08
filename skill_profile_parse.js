/****************************************************
 * skill_profile_parse.gs
 * Resume → Skill Profile + Target Roles (Admin-only helper)
 *
 * Output shape:
 * {
 *   skillProfileText: string,
 *   topSkills: string[],
 *   signatureStories: string[],
 *   suggestedRoles: [{ title: string, keywords: string[] }],
 *   yearsExperience: string,
 *   preferredLocations: string[],
 *   preferredCountries: string[],
 *   preferredCities: string[],
 *   currentCity: string (optional),
 *   remotePreference: "remote_only"|"hybrid_ok"|"onsite_ok",
 *   seniorityTarget: string,
 *   industriesToAvoid: string[]
 * }
 ****************************************************/

function parseResumeToSkillProfile_(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) throw new Error("Resume text is empty.");

  // Keep token usage sane
  const clipped = raw.length > 12000 ? raw.slice(0, 12000) : raw;

  const prompt =
`You are analyzing a resume to extract:
1. A compact skill profile
2. Target job roles this person should pursue
3. Structured preferences for job matching (location, remote, seniority, experience)

Return ONLY valid JSON. No markdown. No commentary.

JSON schema:
{
  "skillProfileText": "string (4-8 lines max, plain language summary of their background)",
  "topSkills": ["8-14 skills max, short phrases"],
  "signatureStories": ["3-6 bullets max, each 1-2 lines, measurable achievements"],
  "suggestedRoles": [
    {
      "title": "Job title they should target (e.g., Customer Success Manager)",
      "keywords": ["3-6 search keywords for this role"]
    }
  ],
  "yearsExperience": "string: total years relevant experience, e.g. '2-4', '5-7', '10+' or '0-1'",
  "preferredLocations": ["city or region names from resume they prefer; empty array if not stated or open to anywhere"],
  "preferredCountries": ["country names only e.g. United States, Canada; empty if not stated"],
  "preferredCities": ["city names only e.g. New York, Boston; empty if not stated"],
  "currentCity": "string: current city of residence if clearly stated; empty string otherwise",
  "remotePreference": "one of: remote_only, hybrid_ok, onsite_ok (infer from resume; default remote_only if unclear)",
  "seniorityTarget": "one of: entry, mid, senior, lead (level they fit best for next role)",
  "industriesToAvoid": ["industries to exclude if clearly stated; empty array otherwise"]
}

Rules for skills/stories:
- No HR buzzwords. No inspirational tone. No fluff.
- Be specific, based only on the resume text.
- If something is unclear, omit it (do not guess).

Rules for suggestedRoles:
- Suggest 2-4 job titles (not more). These drive job search directly, so precision matters.
- The FIRST suggestion (most important) should be the role closest to their last 1-2 positions.
- Additional suggestions can be adjacent roles they could realistically get hired for.
- Every title MUST include appropriate seniority level (Junior, Associate, Mid-level, Senior, Staff, Lead, Director, VP) based on years of experience: 0-2y = Junior/Associate, 3-5y = Mid-level, 6-9y = Senior, 10-14y = Staff/Lead, 15+ = Director/VP.
- Titles must be real job titles found on LinkedIn/Indeed, not invented compound titles.
- Keywords should be search terms that would find these exact jobs: the title itself, common abbreviations, and 2-3 variations employers use.
- Do NOT suggest career pivots that require skills or experience the resume doesn't demonstrate.
- Do NOT include "Manager" in the title unless the person has actually managed people or projects.
- Examples:
  - {"title": "Senior Customer Success Manager", "keywords": ["senior customer success manager", "senior csm", "customer success lead", "sr customer success"]}
  - {"title": "Solutions Engineer", "keywords": ["solutions engineer", "se", "pre-sales engineer", "solutions consultant"]}

Rules for structured fields:
- yearsExperience: infer from dates; use range like "3-5" or "10+".
- preferredLocations: only if resume mentions location preference or current location; else [].
- preferredCountries: only country-level (United States, Canada, UK, etc.); empty [] if not stated.
- preferredCities: only city names; empty [] if not stated.
- currentCity: their current city of residence if clearly stated; else empty string.
- remotePreference: remote_only if they work remote or prefer it; hybrid_ok or onsite_ok if stated.
- seniorityTarget: match their experience level; entry (0-2y), mid (3-6y), senior (7+), lead (if they led teams).
- industriesToAvoid: only if resume explicitly says they want to leave an industry or avoid one.

Resume text:
"""${clipped}"""`;

  const ai = aiRequest_(prompt, CONFIG.OPENAI_MODEL);
  const txt = String(ai.text || "").trim();

  let obj;
  try {
    obj = JSON.parse(txt);
  } catch (e) {
    // Make failures actionable
    throw new Error("Resume parse returned non-JSON. First 200 chars: " + txt.slice(0, 200));
  }

  // Validate + normalize
  const skillProfileText = String(obj.skillProfileText || "").trim();
  const topSkills = normalizeStringArray_(obj.topSkills, 14);
  const signatureStories = normalizeStringArray_(obj.signatureStories, 6);
  const suggestedRoles = normalizeSuggestedRoles_(obj.suggestedRoles);
  const yearsExperience = normalizeYearsExperience_(obj.yearsExperience);
  const preferredLocations = normalizeStringArray_(obj.preferredLocations, 10);
  const preferredCountries = normalizeStringArray_(obj.preferredCountries, 10);
  const preferredCities = normalizeStringArray_(obj.preferredCities, 10);
  const currentCity = (obj.currentCity != null && String(obj.currentCity).trim() !== "") ? String(obj.currentCity).trim().slice(0, 100) : "";
  const remotePreference = normalizeRemotePreference_(obj.remotePreference);
  const seniorityTarget = normalizeSeniorityTarget_(obj.seniorityTarget);
  const industriesToAvoid = normalizeStringArray_(obj.industriesToAvoid, 8);

  if (!skillProfileText) throw new Error("Resume parse missing skillProfileText.");
  if (topSkills.length < 3) throw new Error("Resume parse topSkills looks too empty.");
  if (signatureStories.length < 1) throw new Error("Resume parse signatureStories looks too empty.");

  return {
    skillProfileText: skillProfileText,
    topSkills: topSkills,
    signatureStories: signatureStories,
    suggestedRoles: suggestedRoles,
    yearsExperience: yearsExperience,
    preferredLocations: preferredLocations,
    preferredCountries: preferredCountries,
    preferredCities: preferredCities,
    currentCity: currentCity,
    remotePreference: remotePreference,
    seniorityTarget: seniorityTarget,
    industriesToAvoid: industriesToAvoid
  };
}

function normalizeYearsExperience_(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  return s.slice(0, 20);
}

function normalizeRemotePreference_(val) {
  const s = String(val || "").trim().toLowerCase();
  if (s === "remote_only" || s === "hybrid_ok" || s === "onsite_ok") return s;
  if (s.indexOf("remote") !== -1) return "remote_only";
  if (s.indexOf("hybrid") !== -1) return "hybrid_ok";
  if (s.indexOf("onsite") !== -1 || s.indexOf("on-site") !== -1) return "onsite_ok";
  return "remote_only";
}

function normalizeSeniorityTarget_(val) {
  const s = String(val || "").trim().toLowerCase();
  if (["entry", "mid", "senior", "lead"].indexOf(s) !== -1) return s;
  if (s) return s.slice(0, 20);
  return "";
}

/**
 * Normalize suggested roles from AI response.
 */
function normalizeSuggestedRoles_(roles) {
  if (!Array.isArray(roles)) return [];
  
  var out = [];
  for (var i = 0; i < roles.length && out.length < 8; i++) {
    var r = roles[i];
    if (!r || typeof r !== 'object') continue;
    
    var title = String(r.title || "").trim();
    if (!title) continue;
    
    var keywords = [];
    if (Array.isArray(r.keywords)) {
      for (var k = 0; k < r.keywords.length && keywords.length < 8; k++) {
        var kw = String(r.keywords[k] || "").trim().toLowerCase();
        if (kw && keywords.indexOf(kw) === -1) {
          keywords.push(kw);
        }
      }
    }
    
    // Always include the title as a keyword
    var titleLower = title.toLowerCase();
    if (keywords.indexOf(titleLower) === -1) {
      keywords.unshift(titleLower);
    }
    
    out.push({ title: title, keywords: keywords });
  }
  
  return out;
}

/**
 * Build roleTracksJSON from suggested roles.
 * Dedupes by normalized role title so one role title produces one track.
 */
function buildRoleTracksFromSuggested_(suggestedRoles) {
  if (!Array.isArray(suggestedRoles)) return "[]";

  var seen = {};
  var tracks = [];
  for (var i = 0; i < suggestedRoles.length; i++) {
    var r = suggestedRoles[i];
    var title = String(r.title || "").trim();
    if (!title) continue;
    var key = title.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "_";
    if (seen[key]) continue;
    seen[key] = true;

    var id = title.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20) || ("role_" + i);
    tracks.push({
      id: id,
      label: title,
      roleKeywords: r.keywords || [],
      laneLabel: title + " Lane",
      priorityWeight: 1.0
    });
  }

  return JSON.stringify(tracks);
}

function normalizeStringArray_(val, maxLen) {
  const arr = Array.isArray(val) ? val : [];
  const out = [];
  const seen = new Set();

  for (var i = 0; i < arr.length; i++) {
    const s = String(arr[i] || "").trim();
    if (!s) continue;

    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);

    out.push(s);
    if (out.length >= maxLen) break;
  }

  return out;
}
