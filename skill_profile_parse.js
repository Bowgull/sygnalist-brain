/****************************************************
 * skill_profile_parse.gs
 * Resume → Skill Profile + Target Roles (Admin-only helper)
 *
 * Output shape:
 * {
 *   skillProfileText: string,
 *   topSkills: string[],
 *   signatureStories: string[],
 *   suggestedRoles: [{ title: string, keywords: string[] }]
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
  ]
}

Rules for skills/stories:
- No HR buzzwords. No inspirational tone. No fluff.
- Be specific, based only on the resume text.
- If something is unclear, omit it (do not guess).

Rules for suggestedRoles:
- Suggest 3-6 job titles they're qualified for based on their experience.
- Include a mix of exact matches and adjacent roles they could pivot to.
- Keywords should be search terms that would find these jobs (job title variations, common abbreviations).
- Examples: 
  - {"title": "Customer Success Manager", "keywords": ["customer success", "csm", "client success", "customer success manager"]}
  - {"title": "Implementation Specialist", "keywords": ["implementation", "onboarding", "solutions consultant"]}

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

  if (!skillProfileText) throw new Error("Resume parse missing skillProfileText.");
  if (topSkills.length < 3) throw new Error("Resume parse topSkills looks too empty.");
  if (signatureStories.length < 1) throw new Error("Resume parse signatureStories looks too empty.");

  return {
    skillProfileText: skillProfileText,
    topSkills: topSkills,
    signatureStories: signatureStories,
    suggestedRoles: suggestedRoles
  };
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
 */
function buildRoleTracksFromSuggested_(suggestedRoles) {
  if (!Array.isArray(suggestedRoles)) return "[]";
  
  var tracks = [];
  for (var i = 0; i < suggestedRoles.length; i++) {
    var r = suggestedRoles[i];
    var id = String(r.title || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20);
    
    tracks.push({
      id: id || ("role_" + i),
      label: r.title,
      roleKeywords: r.keywords || [],
      laneLabel: r.title + " Lane",
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
