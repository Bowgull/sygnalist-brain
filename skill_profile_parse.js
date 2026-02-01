/****************************************************
 * skill_profile_parse.gs
 * Resume → Skill Profile (Admin-only helper)
 *
 * Output shape:
 * {
 *   skillProfileText: string,
 *   topSkills: string[],
 *   signatureStories: string[]
 * }
 ****************************************************/

function parseResumeToSkillProfile_(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) throw new Error("Resume text is empty.");

  // Keep token usage sane
  const clipped = raw.length > 12000 ? raw.slice(0, 12000) : raw;

  const prompt =
`You are extracting a compact skill profile from a resume.
Return ONLY valid JSON. No markdown. No commentary.

JSON schema:
{
  "skillProfileText": "string (4-8 lines max, plain language, no corporate fluff)",
  "topSkills": ["8-14 skills max, short phrases"],
  "signatureStories": ["3-6 bullets max, each 1-2 lines, measurable when possible"]
}

Rules:
- No HR buzzwords. No inspirational tone. No cringe.
- Be specific, based only on the resume text.
- If something is unclear, omit it (do not guess).
- Keep skills and stories relevant to likely job search lanes.
- Use consistent casing (Title Case for skills is fine).

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

  if (!skillProfileText) throw new Error("Resume parse missing skillProfileText.");
  if (topSkills.length < 3) throw new Error("Resume parse topSkills looks too empty.");
  if (signatureStories.length < 1) throw new Error("Resume parse signatureStories looks too empty.");

  return {
    skillProfileText: skillProfileText,
    topSkills: topSkills,
    signatureStories: signatureStories
  };
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
