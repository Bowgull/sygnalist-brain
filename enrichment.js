/****************************************************
 * enrichment.gs
 * Phase 4 — Enrichment (Summary + WhyFit)
 * Uses:
 *  - aiRequest_()
 *  - CONFIG.MAX_DESC_CHARS_FOR_AI
 *  - profile.skillProfileText / topSkills / signatureStories
 ****************************************************/

function buildEnrichmentPrompt_(job, profile) {
  const title = String(job.title || "").trim();
  const company = String(job.company || "").trim();
  const url = String(job.url || "").trim();
  const location = String(job.location || "").trim();

  const descRaw = String(job.description || "");
  const desc = descRaw.length > CONFIG.MAX_DESC_CHARS_FOR_AI
    ? descRaw.slice(0, CONFIG.MAX_DESC_CHARS_FOR_AI)
    : descRaw;

  const skillProfileText = String(profile.skillProfileText || "").trim();
  const topSkills = Array.isArray(profile.topSkills) ? profile.topSkills : [];
  const signatureStories = Array.isArray(profile.signatureStories) ? profile.signatureStories : [];

  // Blueprint Section 2.3 (Language Filters) + 8.1 (Enrichment Shape). Voice: client's truth only.
  return (
`You are writing an Inbox card summary and "why you're a fit" for a job-search tool.
Return ONLY valid JSON. No markdown. No commentary. jobSummary must be at most 5 lines.

OUTPUT JSON schema:
{
  "jobSummary": "3-5 lines max (one more sentence of useful detail). What the role is + what it likely entails. Plain language.",
  "whyFit": ["exactly 3 strings. Each string is one paragraph block (2-3 short sentences). No bullets, no numbering, no section labels, no headers, no em dashes, no emojis, no colon-led prefixes like Gap: or Plan:."]
}

whyFit structure (exactly 3 paragraph blocks; internal logic, invisible but required):
- Block 1 (Concrete match): Reference one specific fact from the candidate profile and one specific requirement from the job. Connect them plainly. No vague wording. No resume tone. Read like someone calmly observing a real match. Not praising. Not hyping.
- Block 2 (Clear gap or unknown): Identify a real gap, missing signal, or ambiguity. Do not fabricate missing skills. If no clear gap exists, state what is unclear in the job posting and why that uncertainty matters operationally. Calm tone. No drama.
- Block 3 (Realistic framing): Show how the candidate would speak to this in conversation. Mention what evidence they would point to. Mention how they would handle it early on. Not advice. Not coaching. Not encouragement. Just practical positioning.

TONE (non-negotiable):
- Sound like a sharp ops/account person thinking out loud next to the candidate. Not a resume writer, motivational coach, LinkedIn post, chatbot, polished essay, or corporate HR rep. Conversational but controlled.
- Short sentences. Most under 18 words. Use plain verbs: handled, ran, owned, fixed, tracked, escalated, coordinated. Avoid abstract nouns and complex dependent clauses. No academic or resume-summary tone.
- No motivational tone. No corporate tone. No resume summary language. Do not invent missing profile skills. If profile signal is missing, say it directly. If you cannot find a concrete profile fact, state "Profile signal missing on X" rather than fabricating alignment.

BANNED words and phrases (do not use, case-insensitive): aligns, alignment, demonstrates, suggests, indicates, highlights, showcases, leverages, utilizes, transferable, dynamic, fast paced, passionate, self starter, rockstar, great fit, perfect fit, ideal candidate, consider, you should, try to, make sure, ability to, open question, interview answer, your experience, we're excited, we are excited, don't worry, you're amazing, personal brand, 10x, dream role. No em dashes. No bullet symbols. No numbered lists. No filler like "This is a great opportunity", "This position offers", "You would be well suited".

Example style (tone only; do not copy verbatim):
Block 1: "You've handled high volume customer interactions and kept the desk steady during busy shifts. The posting focuses on inbound questions and quick issue resolution. The pace looks similar."
Block 2: "The job mentions CRM tracking and structured reporting. Your profile does not clearly show system ownership. If reporting is central to the role, that could matter."
Block 3: "You would frame your strength in triage and follow through. Point to moments where you tracked issues from start to finish. Then explain how you would learn their system quickly and keep records clean from day one."

Candidate Skill Profile:
${skillProfileText ? skillProfileText : "(No skill profile text provided yet.)"}

Top Skills:
${topSkills.length ? "- " + topSkills.join("\n- ") : "(None listed.)"}

Signature Stories / Proof Points:
${signatureStories.length ? "- " + signatureStories.join("\n- ") : "(None listed.)"}

Job:
- Company: ${company}
- Title: ${title}
- Location: ${location || "N/A"}
- URL: ${url || "N/A"}

Job Description (truncated):
"""${desc}"""
`
  );
}

/**
 * Enrich a list of jobs using PARALLEL API calls.
 * 
 * Performance: 25 jobs in ~5-10 seconds (vs 50+ seconds sequential)
 * 
 * If enrichment fails for a job:
 * - log WARN
 * - skip it (do not surface)
 */
function enrichJobsForProfile_(jobs, profile) {
  const jobList = jobs || [];
  if (!jobList.length) return [];
  
  const batchId = newBatchId_();
  const out = [];

  // Build all prompts upfront
  const prompts = jobList.map(job => buildEnrichmentPrompt_(job, profile));
  
  // Send all requests in parallel (FAST!)
  const results = aiBatchRequest_(prompts, CONFIG.OPENAI_MODEL);
  
  // Process results
  for (let i = 0; i < jobList.length; i++) {
    const job = jobList[i];
    const result = results[i];
    
    try {
      if (!result.ok) {
        throw new Error(result.error || "AI request failed");
      }
      
      const parsed = safeParseEnrichmentJson_(result.text);
      if (!parsed.jobSummary || !parsed.whyFit || parsed.whyFit.length !== 3) {
        throw new Error("Enrichment missing required fields.");
      }
      const sanitized = sanitizeEnrichmentVoice_(parsed.jobSummary, parsed.whyFit);
      if (!sanitized.jobSummary || sanitized.whyFit.length !== 3) {
        throw new Error("Enrichment invalid after sanitization.");
      }

      out.push(Object.assign({}, job, {
        jobSummary: sanitized.jobSummary,
        whyFit: sanitized.whyFit.join("\n\n")
      }));

    } catch (e) {
      logEvent_({
        timestamp: Date.now(),
        profileId: profile.profileId || null,
        action: "enrich",
        source: "openai",
        details: {
          level: "WARN",
          message: "Enrichment failed; skipping job",
          meta: {
            batchId,
            company: String(job.company || ""),
            title: String(job.title || ""),
            url: String(job.url || ""),
            error: e.message
          },
          batchId,
          version: Sygnalist_VERSION
        }
      });
    }
  }

  logEvent_({
    timestamp: Date.now(),
    profileId: profile.profileId || null,
    action: "enrich",
    source: "openai",
    details: {
      level: "INFO",
      message: "Enrichment complete (parallel)",
      meta: { batchId, inCount: jobList.length, outCount: out.length },
      batchId,
      version: Sygnalist_VERSION
    }
  });

  return out;
}

function safeParseEnrichmentJson_(txt) {
  let obj;
  try {
    obj = JSON.parse(txt);
  } catch (e) {
    throw new Error("Non-JSON enrichment output. First 200 chars: " + txt.slice(0, 200));
  }

  let jobSummary = String(obj.jobSummary || "").trim();
  // Cap to 5 lines or ~520 chars (one more sentence)
  const lines = jobSummary.split("\n");
  if (lines.length > 5) jobSummary = lines.slice(0, 5).join("\n").trim();
  if (jobSummary.length > 520) jobSummary = jobSummary.slice(0, 517) + "...";

  let whyFit = [];
  if (Array.isArray(obj.whyFit)) {
    whyFit = obj.whyFit.map(x => String(x || "").trim()).filter(Boolean);
    if (whyFit.length > 3) whyFit = whyFit.slice(0, 3);
  } else if (typeof obj.whyFit === "string") {
    whyFit = String(obj.whyFit).split(/\n\s*\n/).map(s => s.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
    if (whyFit.length > 3) whyFit = whyFit.slice(0, 3);
  }
  if (whyFit.length !== 3) throw new Error("whyFit must have exactly 3 paragraph blocks.");

  return { jobSummary, whyFit };
}

/**
 * Post-process enrichment text to strip HR sludge / coachy / buzz phrases (Blueprint 2.3).
 * No network; in-memory only.
 */
function sanitizeEnrichmentVoice_(jobSummary, whyFitArray) {
  const banned = [
    "we're excited", "we are excited", "dynamic fast-paced", "rockstar", "ninja", "self-starter",
    "you've got this", "you've got this!", "don't worry", "you're amazing", "personal brand",
    "10x", "great fit", "perfect fit", "ideal candidate", "dream role",
    "aligns", "alignment", "demonstrates", "suggests", "indicates", "highlights", "showcases",
    "leverages", "utilizes", "transferable", "dynamic", "fast paced", "passionate", "self starter",
    "consider", "you should", "try to", "make sure", "ability to", "open question", "interview answer",
    "your experience", "This is a great opportunity", "This position offers", "You would be well suited"
  ];
  function stripBanned(text) {
    if (!text || typeof text !== "string") return text;
    let out = text.replace(/[\u2014\u2013\u2012]/g, " ");
    banned.forEach(function (phrase) {
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      out = out.replace(re, "[removed]");
    });
    return out.replace(/\s*\[removed\]\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  }
  const summary = stripBanned(jobSummary);
  const bullets = (whyFitArray || []).map(function (b) { return stripBanned(b); });
  const whyFit = bullets.length >= 3 ? bullets.slice(0, 3) : bullets;
  return { jobSummary: summary, whyFit: whyFit };
}

// ─────────────────────────────────────────────────────────────────────────────
// GoodFit (Tracker-only): exactly 3 paragraph blocks, blank-line separated, voice rules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build prompt for GoodFit: exactly 3 paragraph blocks (2-3 short sentences each), separated by a single blank line.
 * Voice: sharp ops/account person; no praise/encouragement/HR/filler. Same structure as enrichment whyFit.
 */
function buildGoodFitPrompt_(job, profile) {
  const title = String(job.title || "").trim();
  const company = String(job.company || "").trim();
  const url = String(job.url || "").trim();
  const location = String(job.location || "").trim();
  const descRaw = String(job.description || "").trim();
  const desc = descRaw.length > CONFIG.MAX_DESC_CHARS_FOR_AI
    ? descRaw.slice(0, CONFIG.MAX_DESC_CHARS_FOR_AI)
    : descRaw;

  const skillProfileText = String(profile.skillProfileText || "").trim();
  const topSkills = Array.isArray(profile.topSkills) ? profile.topSkills : [];
  const signatureStories = Array.isArray(profile.signatureStories) ? profile.signatureStories : [];

  return (
`You are writing a "Good Fit" note for a job-search tool. Return only the GoodFit content. No JSON, no markdown, no labels (no "Why you fit:" or similar).

FORMAT:
- Output exactly 3 paragraph blocks. No bullets, no numbering, no section labels, no headers, no em dashes, no emojis, no colon-led prefixes.
- Each block: 2-3 short sentences. Separate each block with a single blank line.

Structure (exactly 3 blocks):
- Block 1 (Concrete match): One specific fact from the candidate profile and one specific requirement from the job. Connect them plainly. Calm observation, not praise.
- Block 2 (Clear gap or unknown): A real gap, missing signal, or ambiguity. If no clear gap, state what is unclear in the posting and why it matters operationally. Do not fabricate missing skills.
- Block 3 (Realistic framing): How the candidate would speak to this in conversation; what evidence they would point to; how they would handle it early. Practical positioning only. Not advice, coaching, or encouragement.

TONE (non-negotiable):
- Sharp ops/account person thinking out loud next to the candidate. Not resume writer, motivational coach, LinkedIn post, chatbot, polished essay, or corporate HR. Short sentences (most under 18 words). Plain verbs: handled, ran, owned, fixed, tracked, escalated, coordinated. No motivational tone. No corporate tone. No resume summary language. Do not invent missing profile skills. If you cannot find a concrete profile fact, state "Profile signal missing on X" rather than fabricating alignment.

BANNED words and phrases (do not use): aligns, alignment, demonstrates, suggests, indicates, highlights, showcases, leverages, utilizes, transferable, dynamic, fast paced, passionate, self starter, rockstar, great fit, perfect fit, ideal candidate, consider, you should, try to, make sure, ability to, open question, interview answer, your experience, we're excited, don't worry, you're amazing, personal brand, 10x, dream role. No em dashes. No filler like "This is a great opportunity", "This position offers", "You would be well suited".

Example style (tone only; do not copy verbatim):
Block 1: "You've handled high volume customer interactions and kept the desk steady during busy shifts. The posting focuses on inbound questions and quick issue resolution. The pace looks similar."
Block 2: "The job mentions CRM tracking and structured reporting. Your profile does not clearly show system ownership. If reporting is central to the role, that could matter."
Block 3: "You would frame your strength in triage and follow through. Point to moments where you tracked issues from start to finish. Then explain how you would learn their system quickly and keep records clean from day one."

Candidate Skill Profile:
${skillProfileText ? skillProfileText : "(No skill profile text provided yet.)"}

Top Skills:
${topSkills.length ? topSkills.join(", ") : "(None listed.)"}

Signature Stories / Proof Points:
${signatureStories.length ? signatureStories.join("; ") : "(None listed.)"}

Job:
- Company: ${company}
- Title: ${title}
- Location: ${location || "N/A"}
- URL: ${url || "N/A"}

Job Description${desc ? " (truncated):" : " (not provided):"}
"""${desc || "N/A"}"""

Output only the 3 paragraph blocks, each separated by a single blank line. Nothing else.`
  );
}

/**
 * Strip HR sludge / buzz phrases from a single GoodFit string (Blueprint 2.3).
 */
function sanitizeGoodFitVoice_(text) {
  if (!text || typeof text !== "string") return "";
  const banned = [
    "we're excited", "we are excited", "dynamic fast-paced", "rockstar", "ninja", "self-starter",
    "you've got this", "you've got this!", "don't worry", "you're amazing", "personal brand",
    "10x", "great fit", "perfect fit", "ideal candidate", "dream role",
    "aligns", "alignment", "demonstrates", "suggests", "indicates", "highlights", "showcases",
    "leverages", "utilizes", "transferable", "dynamic", "fast paced", "passionate", "self starter",
    "consider", "you should", "try to", "make sure", "ability to", "open question", "interview answer",
    "your experience", "This is a great opportunity", "This position offers", "You would be well suited",
    "strong background", "excellent communication", "dynamic environment",
    "fast-paced environment", "strong communication skills"
  ];
  let out = text.replace(/[\u2014\u2013\u2012]/g, " ");
  banned.forEach(function (phrase) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, "[removed]");
  });
  return out.replace(/\s*\[removed\]\s*/g, " ").replace(/\n{3,}/g, "\n\n").replace(/[^\S\n]{2,}/g, " ").trim();
}

/**
 * Parse and validate GoodFit response: exactly 3 blocks separated by \\n\\n.
 * Returns single string with 3 blocks separated by \\n\\n.
 */
function parseGoodFitResponse_(txt) {
  const raw = String(txt || "").trim();
  if (!raw) throw new Error("GoodFit response empty.");
  const blocks = raw.split(/\n\s*\n/).map(function (b) { return b.trim(); }).filter(Boolean);
  if (blocks.length !== 3) throw new Error("GoodFit must have exactly 3 paragraph blocks.");
  return blocks.slice(0, 3).join("\n\n");
}

/**
 * Generate GoodFit for a single job (Tracker-only, on-demand).
 * Returns one string: 3-5 statements separated by \\n\\n.
 * Uses aiRequest_ (single call).
 */
function generateGoodFitForJob_(job, profile) {
  if (!job || !profile) throw new Error("generateGoodFitForJob_: job and profile required.");
  const prompt = buildGoodFitPrompt_(job, profile);
  const result = aiRequest_(prompt, CONFIG.OPENAI_MODEL);
  if (!result.ok) throw new Error(result.error || "GoodFit AI request failed.");
  let text = (result.text || "").trim();
  // Allow JSON wrapper e.g. { "goodFit": "..." }
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj.goodFit === "string") text = obj.goodFit.trim();
  } catch (e) { /* plain text */ }
  const parsed = parseGoodFitResponse_(text);
  return sanitizeGoodFitVoice_(parsed);
}
