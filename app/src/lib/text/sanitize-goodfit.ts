/**
 * GoodFit voice sanitizer — ported from legacy enrichment.js (Blueprint 2.3).
 * Strips banned HR/corporate phrases and em dashes from AI-generated GoodFit text.
 */

const BANNED_PHRASES = [
  "we're excited", "we are excited", "dynamic fast-paced", "rockstar", "ninja", "self-starter",
  "you've got this", "you've got this!", "don't worry", "you're amazing", "personal brand",
  "10x", "great fit", "perfect fit", "ideal candidate", "dream role",
  "aligns", "alignment", "demonstrates", "suggests", "indicates", "highlights", "showcases",
  "leverages", "utilizes", "transferable", "dynamic", "fast paced", "passionate", "self starter",
  "consider", "you should", "try to", "make sure", "ability to", "open question", "interview answer",
  "your experience", "This is a great opportunity", "This position offers", "You would be well suited",
  "strong background", "excellent communication", "dynamic environment",
  "fast-paced environment", "strong communication skills",
];

/**
 * Strip HR sludge / buzz phrases from a single GoodFit string.
 * Replaces em/en/figure dashes with spaces, removes banned phrases,
 * collapses whitespace, and trims.
 */
export function sanitizeGoodFitVoice(text: string): string {
  if (!text || typeof text !== "string") return "";

  // Replace em/en/figure dashes with space
  let out = text.replace(/[\u2014\u2013\u2012]/g, " ");

  // Strip banned phrases (case-insensitive)
  for (const phrase of BANNED_PHRASES) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "gi");
    out = out.replace(re, "[removed]");
  }

  // Clean up [removed] markers and collapse whitespace
  return out
    .replace(/\s*\[removed\]\s*/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}

/**
 * Parse and validate GoodFit response: exactly 3 blocks separated by \n\n.
 * Returns single string with 3 blocks separated by \n\n.
 * Throws if response is empty or doesn't have exactly 3 blocks.
 */
export function parseGoodFitResponse(text: string): string {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("GoodFit response empty.");
  const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length !== 3) throw new Error(`GoodFit must have exactly 3 paragraph blocks (got ${blocks.length}).`);
  return blocks.slice(0, 3).join("\n\n");
}
