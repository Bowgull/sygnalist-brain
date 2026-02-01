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

  // Blueprint tone rules: no fluff/HR tone.
  return (
`You are writing an "Inbox card" summary for a job-search tool.
Return ONLY valid JSON. No markdown. No commentary.

OUTPUT JSON schema:
{
  "jobSummary": "2-4 lines max. What the role is + what it likely entails. Plain language.",
  "whyFit": ["3-5 bullets max. Each bullet is short. No fluff. No corporate cringe."]
}

Tone rules:
- No HR buzzwords.
- No hype. No "exciting opportunity".
- Be specific. If unknown, keep it general and honest.
- Base your output on the job + candidate profile ONLY. Do not invent experience.

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
 * Enrich a list of jobs. If enrichment fails for a job:
 * - log WARN
 * - skip it (do not surface)
 */
function enrichJobsForProfile_(jobs, profile) {
  const out = [];
  const batchId = newBatchId_();

  for (let i = 0; i < (jobs || []).length; i++) {
    const job = jobs[i];

    try {
      const prompt = buildEnrichmentPrompt_(job, profile);
      const ai = aiRequest_(prompt, CONFIG.OPENAI_MODEL);
      const txt = String(ai.text || "").trim();

      const parsed = safeParseEnrichmentJson_(txt);

      // Hard requirement: must have both non-empty
      if (!parsed.jobSummary || !parsed.whyFit || !parsed.whyFit.length) {
        throw new Error("Enrichment missing required fields.");
      }

      out.push(Object.assign({}, job, {
        jobSummary: parsed.jobSummary,
        whyFit: parsed.whyFit.join("\n")
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
      message: "Enrichment complete",
      meta: { batchId, inCount: (jobs || []).length, outCount: out.length },
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

  const jobSummary = String(obj.jobSummary || "").trim();

  let whyFit = [];
  if (Array.isArray(obj.whyFit)) {
    whyFit = obj.whyFit.map(x => String(x || "").trim()).filter(Boolean);
  } else if (typeof obj.whyFit === "string") {
    // tolerate string, split into lines
    whyFit = String(obj.whyFit).split("\n").map(s => s.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  }

  // Cap to spec
  if (whyFit.length > 5) whyFit = whyFit.slice(0, 5);

  return { jobSummary, whyFit };
}
