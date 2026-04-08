import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/**
 * POST /api/admin/gmail-ingest - Safe Gmail ingest.
 *
 * Pulls job URLs from labeled Gmail threads into the review queue (jobs_inbox).
 * Jobs require admin approval before entering the Job Bank.
 *
 * Safety controls:
 * - Age cutoff: only emails from last 14 days
 * - Batch cap: 20 messages per run, 25 jobs per run
 * - Label management: SYGN_INTAKE → SYGN_INGESTED after processing
 * - Backlog detection: reports if more messages exist
 * - Dedup: checks against jobs_inbox + global_job_bank URLs
 * - Garbage filter: rejects CSS fragments, base64 strings, encoded data as titles
 */
export async function POST() {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    return error("Gmail API credentials not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.", 500);
  }

  const service = getServiceClient();

  try {
    // --- Step 1: Get access token ---
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      return error("Failed to refresh Gmail access token", 500);
    }

    const { access_token } = await tokenRes.json();

    // --- Step 2: Resolve label IDs ---
    const labelsRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      { headers: { Authorization: `Bearer ${access_token}` } },
    );
    if (!labelsRes.ok) {
      return error("Failed to fetch Gmail labels", 500);
    }
    const labelsData = await labelsRes.json();
    const allLabels = labelsData.labels as Array<{ id: string; name: string }>;

    const intakeLabel = allLabels.find((l) => l.name === "SYGN_INTAKE");
    let ingestedLabel = allLabels.find((l) => l.name === "SYGN_INGESTED");

    if (!intakeLabel) {
      return error("Gmail label SYGN_INTAKE not found. Create it first.", 400);
    }

    // Create SYGN_INGESTED label if it doesn't exist
    if (!ingestedLabel) {
      const createRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/labels",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "SYGN_INGESTED",
            labelListVisibility: "labelShow",
            messageListVisibility: "show",
          }),
        },
      );
      if (createRes.ok) {
        ingestedLabel = await createRes.json();
      }
    }

    const intakeLabelId = intakeLabel.id;
    const ingestedLabelId = ingestedLabel?.id;

    // --- Step 3: Search for messages (with safety filters) ---
    const searchQuery = "label:SYGN_INTAKE -label:SYGN_INGESTED newer_than:14d";
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=20`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    );

    if (!searchRes.ok) {
      return error("Failed to search Gmail", 500);
    }

    const searchData = await searchRes.json();
    const messageIds: string[] = (searchData.messages ?? []).map((m: { id: string }) => m.id);
    const hasMore = !!searchData.nextPageToken;
    const estimatedTotal = searchData.resultSizeEstimate ?? messageIds.length;

    if (messageIds.length === 0) {
      return json({
        messages_scanned: 0,
        messages_skipped: 0,
        jobs_found: 0,
        jobs_new: 0,
        jobs_duplicate: 0,
        queue_remaining: 0,
        backlog_detected: false,
      });
    }

    // --- Step 4: Load existing URLs for dedup ---
    // Exclude rejected jobs so they can be re-ingested after reset
    const { data: existingInbox } = await service
      .from("jobs_inbox")
      .select("url")
      .not("url", "is", null)
      .neq("review_status", "rejected");
    const { data: existingBank } = await service
      .from("global_job_bank")
      .select("url")
      .not("url", "is", null);

    const existingUrls = new Set<string>();
    for (const row of existingInbox ?? []) {
      if (row.url) existingUrls.add(normalizeUrl(row.url));
    }
    for (const row of existingBank ?? []) {
      if (row.url) existingUrls.add(normalizeUrl(row.url));
    }

    // --- Step 5: Process each message ---
    const allJobs: ParsedJob[] = [];
    let skippedFetch = 0;
    let skippedNoContent = 0;
    let messagesProcessed = 0;
    const processedMessageIds: string[] = [];

    for (const msgId of messageIds) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${access_token}` } },
      );

      if (!msgRes.ok) {
        skippedFetch++;
        continue;
      }

      const msg = await msgRes.json();
      messagesProcessed++;

      // Get sender from headers
      const fromHeader = msg.payload?.headers?.find(
        (h: { name: string; value: string }) => h.name.toLowerCase() === "from",
      );
      const from = fromHeader?.value?.toLowerCase() ?? "";

      // Get email date from headers
      const dateHeader = msg.payload?.headers?.find(
        (h: { name: string; value: string }) => h.name.toLowerCase() === "date",
      );
      const emailDate = dateHeader?.value
        ? safeParseDate(dateHeader.value)
        : new Date().toISOString();

      // Get email body (HTML preferred, text/plain fallback)
      const body = extractEmailBody(msg.payload);
      if (!body) {
        skippedNoContent++;
        processedMessageIds.push(msgId);
        continue;
      }

      // Route to appropriate parser based on sender
      let parsed: ParsedJob[] = [];
      if (from.includes("ziprecruiter")) {
        parsed = parseZipRecruiter(body);
      } else if (from.includes("linkedin")) {
        parsed = parseLinkedIn(body);
      } else if (from.includes("indeed")) {
        parsed = parseIndeed(body);
      } else if (from.includes("glassdoor")) {
        parsed = parseGlassdoor(body);
      } else if (from.includes("wellfound") || from.includes("angellist") || from.includes("angel.co")) {
        parsed = parseWellfound(body);
      } else {
        parsed = parseGeneric(body);
      }

      // Tag each job with gmail message ID and email date
      for (const job of parsed) {
        job.gmail_message_id = msgId;
        job.email_date = emailDate;
      }

      allJobs.push(...parsed);
      processedMessageIds.push(msgId);
    }

    // --- Step 6: Dedup and insert into jobs_inbox (review queue) ---
    const MAX_INGEST_JOBS = 25;
    let jobsNew = 0;
    let jobsDuplicate = 0;
    let jobsCapped = false;
    const seenInBatch = new Set<string>();

    for (const job of allJobs) {
      if (!job.url) continue;

      const normalized = normalizeUrl(job.url);
      if (existingUrls.has(normalized) || seenInBatch.has(normalized)) {
        jobsDuplicate++;
        continue;
      }
      seenInBatch.add(normalized);

      // Cap at MAX_INGEST_JOBS per run
      if (jobsNew >= MAX_INGEST_JOBS) {
        jobsCapped = true;
        break;
      }

      const { error: insertErr } = await service.from("jobs_inbox").insert({
        job_id: `gmail_${crypto.randomUUID().slice(0, 8)}`,
        title: job.title || null,
        company: job.company || null,
        url: job.url,
        source: job.source,
        location: job.location,
        work_mode: job.work_mode,
        enrichment_status: "NEW",
        review_status: "pending",
        gmail_message_id: job.gmail_message_id || null,
        email_received_at: job.email_date || new Date().toISOString(),
      });

      if (!insertErr) {
        jobsNew++;
      } else {
        jobsDuplicate++;
      }
    }

    // --- Step 7: Update Gmail labels (mark processed) ---
    if (ingestedLabelId) {
      for (const msgId of processedMessageIds) {
        try {
          await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/modify`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                addLabelIds: [ingestedLabelId],
                removeLabelIds: [intakeLabelId],
              }),
            },
          );
        } catch {
          // Label update failure is non-fatal - dedup prevents duplicate inserts
        }
      }
    }

    // --- Step 8: Log event and return receipt ---
    const queueRemaining = hasMore ? estimatedTotal - messageIds.length : 0;
    const backlogDetected = hasMore || estimatedTotal > 30;

    const receipt = {
      messages_scanned: messagesProcessed,
      messages_skipped: skippedFetch + skippedNoContent,
      jobs_found: allJobs.length,
      jobs_new: jobsNew,
      jobs_duplicate: jobsDuplicate,
      jobs_capped: jobsCapped,
      jobs_cap_limit: MAX_INGEST_JOBS,
      queue_remaining: queueRemaining,
      backlog_detected: backlogDetected,
    };

    await logEvent("gmail.ingest_completed", {
      userId: profile.id,
      success: true,
      metadata: {
        ...receipt,
        messages_skipped_fetch: skippedFetch,
        messages_skipped_no_content: skippedNoContent,
        messages_labeled: processedMessageIds.length,
      },
    });

    return json(receipt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown gmail ingest error";
    await logError(msg, {
      sourceSystem: "gmail.ingest",
      userId: profile.id,
    });
    return error("Gmail ingest failed", 500);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("ref");
    return (u.origin + u.pathname + (u.search || "")).toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

function safeParseDate(value: string): string {
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** Extract email body from Gmail payload (prefers HTML, falls back to text/plain) */
function extractEmailBody(payload: Record<string, unknown>): string | null {
  if (!payload) return null;

  // Try HTML first
  const html = extractPart(payload, "text/html");
  if (html) return html;

  // Fall back to text/plain, wrapped so link parsers can still work
  const text = extractPart(payload, "text/plain");
  if (text) return `<pre>${text}</pre>`;

  return null;
}

function extractPart(payload: Record<string, unknown>, targetMime: string): string | null {
  const mimeType = payload.mimeType as string;
  if (mimeType === targetMime && payload.body) {
    const body = payload.body as { data?: string };
    return body.data ? Buffer.from(body.data, "base64url").toString("utf-8") : null;
  }

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      const result = extractPart(part, targetMime);
      if (result) return result;
    }
  }

  return null;
}

// ============================================================================
// Garbage / noise filters
// ============================================================================

/** Reject titles that are CSS fragments, base64 strings, encoded data, etc. */
function isGarbageTitle(title: string): boolean {
  // CSS property patterns
  if (/[\w-]+:\s*[\w#%-]+;/.test(title)) return true;
  // Tailwind / CSS class-like fragments
  if (/\b(?:inline-block|max-w-|min-w-|px-|py-|pl-|pr-|pt-|pb-|text-\[|bg-\[|flex-|grid-|overflow-|whitespace-)\b/.test(title)) return true;
  // HTML entities or tag fragments
  if (/&[a-z]+;|&#\d+;|<\/?[a-z]/i.test(title)) return true;
  // URL-encoded sequences (3+ occurrences)
  if ((title.match(/%[0-9A-Fa-f]{2}/g) ?? []).length >= 3) return true;
  // No spaces and longer than 20 chars (hashes, encoded strings)
  if (title.length > 20 && !/\s/.test(title)) return true;
  // Mostly non-alphabetic (real job titles are mostly letters/spaces)
  const alphaLen = title.replace(/[^a-zA-Z\s]/g, "").length;
  if (title.length > 10 && alphaLen / title.length < 0.4) return true;
  // Too short to be a real job title (single word under 8 chars like "Apply", "Jobs")
  if (title.length < 8 && !/\s/.test(title)) return true;
  // Section headers like "Remote jobs", "Business Operations jobs", "Hybrid jobs"
  if (/^[\w\s]{1,40}\bjobs?\s*$/i.test(title) && title.split(/\s+/).length <= 5) return true;

  return false;
}

/** Reject URLs that point to non-job pages (unsubscribe, tracking, etc.) */
function isNoiseUrl(url: string): boolean {
  return NOISE_URL_PATTERN.test(url);
}

const NOISE_URL_PATTERN = /\/(unsubscribe|privacy|settings|preferences|manage|optout|opt-out|terms|help|faq|about|contact|pixel|track|open|beacon|impression|click|redirect|email-preferences|notifications|account|login|signin|signup|register|profile|download|app-download|share|social|referral|invite|upgrade|premium|subscription|billing|payment|receipt|confirm|verify|password|reset|deactivate|feedback|survey|rate|review|nps)\b/i;

/** Shared blocklist for anchor text that is clearly not a job title */
const NOISE_TITLE_PATTERN = /^(unsubscribe|privacy|view in browser|click here|learn more|view online|manage preferences|update preferences|see all jobs|view all|view all jobs|apply now|apply here|apply today|apply|more jobs|terms of use|terms of service|contact us|help center|view job|view jobs|view details|view listing|see details|see job|see more|see this job|job details|get started|sign up|sign in|log in|register|download app|download|get the app|get the new linkedin.*|open app|open in app|view in app|go to site|visit site|visit website|read more|find out more|explore|browse jobs|browse|search jobs|search|create alert|create job alert|job alert|set alert|save search|save job|saved jobs|similar jobs|recommended jobs|top picks|your matches|new for you|daily digest|weekly digest|job picks|hot jobs|trending|featured|sponsored|promoted|advertisement|ad|free trial|upgrade|premium|pro|subscribe|buy now|shop now|order now|claim|redeem|confirm|verify|update now|update|action required|important|reminder|notification|alert|warning|resume|profile|account|settings|edit profile|complete profile|update resume|update profile|expand your search|recommendations based on.*|people also viewed|you might like|jobs you might like|top picks for you|follow|manage)$/i;

/** Strip inner HTML tags from anchor text */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ============================================================================
// Parsers
// ============================================================================

interface ParsedJob {
  title: string;
  company: string;
  url: string;
  location: string | null;
  work_mode: string | null;
  source: string;
  gmail_message_id?: string;
  email_date?: string;
}

/** ZipRecruiter newsletter parser */
function parseZipRecruiter(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  // Match all links in ZipRecruiter emails — we already know the sender
  const linkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    if (isNoiseUrl(url)) continue;

    const title = stripTags(match[2]).trim();
    if (!title || title.length < 3 || title.length > 200) continue;
    if (NOISE_TITLE_PATTERN.test(title)) continue;
    if (isGarbageTitle(title)) continue;

    // Extract company and location from surrounding context
    const contextAfter = html.slice(match.index + match[0].length, match.index + match[0].length + 1000);
    const company = extractCompanyFromContext(contextAfter);
    const location = extractLocationFromContext(contextAfter);

    jobs.push({
      title,
      company: company || "Unknown",
      url: cleanUrl(url),
      location,
      work_mode: detectWorkMode(contextAfter),
      source: "ziprecruiter_email",
    });
  }
  return jobs;
}

/** LinkedIn digest parser — only match actual job posting URLs */
function parseLinkedIn(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const linkRegex = /<a[^>]+href="(https?:\/\/[^"]*linkedin\.com[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    // Only keep individual job posting URLs
    if (!isLinkedInJobUrl(url)) continue;
    if (isNoiseUrl(url)) continue;

    const title = stripTags(match[2]).trim();
    if (!title || title.length < 3 || title.length > 200) continue;
    if (NOISE_TITLE_PATTERN.test(title)) continue;
    if (isGarbageTitle(title)) continue;

    const contextAfter = html.slice(match.index + match[0].length, match.index + match[0].length + 1000);
    const company = extractCompanyFromContext(contextAfter);

    const isPost = /\/posts\/|\/feed\/update\//i.test(url);
    jobs.push({
      title,
      company: company || "Unknown",
      url: cleanUrl(url),
      location: extractLocationFromContext(contextAfter),
      work_mode: detectWorkMode(contextAfter),
      source: isPost ? "linkedin_post" : "linkedin_email",
    });
  }
  return jobs;
}

/** Check if a LinkedIn URL is a job posting or a social post about hiring */
function isLinkedInJobUrl(url: string): boolean {
  // Individual job postings
  if (/\/jobs\/view\/\d+/i.test(url)) return true;
  if (/\/comm\/jobs\/view\/\d+/i.test(url)) return true;
  // Social posts (people sharing job opportunities)
  if (/\/posts\//i.test(url)) return true;
  if (/\/feed\/update\//i.test(url)) return true;
  return false;
}

/** Indeed alert parser */
function parseIndeed(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  // Match links containing indeed.com — we already know the sender
  const linkRegex = /<a[^>]+href="([^"]*indeed\.com[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    if (isNoiseUrl(url)) continue;

    const title = stripTags(match[2]).trim();
    if (!title || title.length < 3 || title.length > 200) continue;
    if (NOISE_TITLE_PATTERN.test(title)) continue;
    if (isGarbageTitle(title)) continue;

    const contextAfter = html.slice(match.index + match[0].length, match.index + match[0].length + 1000);
    const company = extractCompanyFromContext(contextAfter);
    const location = extractLocationFromContext(contextAfter);

    jobs.push({
      title,
      company: company || "Unknown",
      url: cleanUrl(url),
      location,
      work_mode: detectWorkMode(contextAfter),
      source: "indeed_email",
    });
  }
  return jobs;
}

/** Glassdoor parser */
function parseGlassdoor(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const linkRegex = /<a[^>]+href="([^"]*glassdoor[^"]*(?:\/job|\/Job|[?&]job)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    if (isNoiseUrl(url)) continue;

    const title = stripTags(match[2]).trim();
    if (!title || title.length < 3 || title.length > 200) continue;
    if (NOISE_TITLE_PATTERN.test(title)) continue;
    if (isGarbageTitle(title)) continue;

    const contextAfter = html.slice(match.index + match[0].length, match.index + match[0].length + 1000);

    jobs.push({
      title,
      company: extractCompanyFromContext(contextAfter) || "Unknown",
      url: cleanUrl(url),
      location: extractLocationFromContext(contextAfter),
      work_mode: detectWorkMode(contextAfter),
      source: "glassdoor_email",
    });
  }
  return jobs;
}

/** Wellfound / AngelList parser */
function parseWellfound(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const linkRegex = /<a[^>]+href="(https?:\/\/[^"]*(?:wellfound\.com|angel\.co)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    if (isNoiseUrl(url)) continue;

    const title = stripTags(match[2]).trim();
    if (!title || title.length < 3 || title.length > 200) continue;
    if (NOISE_TITLE_PATTERN.test(title)) continue;
    if (isGarbageTitle(title)) continue;

    const contextAfter = html.slice(match.index + match[0].length, match.index + match[0].length + 1000);

    jobs.push({
      title,
      company: extractCompanyFromContext(contextAfter) || "Unknown",
      url: cleanUrl(url),
      location: extractLocationFromContext(contextAfter),
      work_mode: detectWorkMode(contextAfter),
      source: "wellfound_email",
    });
  }
  return jobs;
}

/** Generic URL extractor for unknown newsletter formats and forwarded emails */
function parseGeneric(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const linkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    if (isNoiseUrl(url)) continue;

    // Accept URLs from known job domains OR with job-like URL paths
    const matchedDomain = JOB_DOMAINS.find((d) => url.includes(d));
    if (!matchedDomain && !isJobLikeUrl(url)) continue;

    const title = stripTags(match[2]).trim();
    if (!title || title.length < 5 || title.length > 200) continue;
    if (NOISE_TITLE_PATTERN.test(title)) continue;
    if (isGarbageTitle(title)) continue;

    // Try to extract company from the URL hostname for ATS platforms
    const company = (matchedDomain ? extractCompanyFromAtsUrl(url, matchedDomain) : null) || "Unknown";

    jobs.push({
      title,
      company,
      url: cleanUrl(url),
      location: null,
      work_mode: null,
      source: "email_generic",
    });
  }
  return jobs;
}

/** ATS and job board domains recognized by the generic parser */
const JOB_DOMAINS = [
  "lever.co",
  "greenhouse.io",
  "workday.com",
  "myworkdayjobs.com",
  "smartrecruiters.com",
  "ashbyhq.com",
  "icims.com",
  "jobvite.com",
  "breezy.hr",
  "recruitee.com",
  "bamboohr.com",
  "jazz.co",
  "applytojob.com",
  "wellfound.com",
  "angel.co",
  "otta.com",
  "builtin.com",
  "dice.com",
  "remoteok.com",
  "weworkremotely.com",
  "hired.com",
  "linkedin.com/jobs/view",
  "jobs.",
];

/** Check if a URL path suggests a job/careers page (for forwarded emails) */
function isJobLikeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    return /\/(jobs?|careers?|positions?|openings?|opportunities|vacancies|hiring|roles?)(\/|$)/i.test(path);
  } catch {
    return false;
  }
}

// ============================================================================
// Context extraction helpers
// ============================================================================

/**
 * Extract company name from HTML context after a job title link.
 * Looks for the first short, meaningful text fragment in nearby elements.
 */
function extractCompanyFromContext(html: string): string | null {
  // Strategy 1: Look for text content in the first few elements after the link
  const textChunks = extractTextChunks(html, 8);

  for (const chunk of textChunks) {
    const text = chunk.trim();
    if (!text || text.length < 2 || text.length > 80) continue;
    // Skip things that look like job titles (contain role keywords)
    if (/\b(engineer|developer|manager|director|analyst|designer|lead|senior|junior|intern|specialist|coordinator|associate|consultant|architect|administrator)\b/i.test(text)) continue;
    // Skip navigation/action text
    if (/^(apply|view|see|save|share|more|details|easy apply|new|hot|featured|sponsored|promoted|quick apply)\b/i.test(text)) continue;
    // Skip pure numbers or dates
    if (/^[\d\s/$.,:-]+$/.test(text)) continue;
    // Skip location-like strings (we'll capture those separately)
    if (/^[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}$/.test(text)) continue;
    // Skip "Remote" standalone
    if (/^remote$/i.test(text)) continue;
    // This looks like a company name
    return text;
  }

  // Strategy 2: Look for "at CompanyName" or "- CompanyName" or "| CompanyName" patterns
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500);
  const dashMatch = stripped.match(/(?:^|\s)[-–|]\s+([A-Z][A-Za-z0-9\s&.,]+?)(?:\s+[-–|]|\s*$)/);
  if (dashMatch?.[1] && dashMatch[1].length >= 2 && dashMatch[1].length <= 60) {
    return dashMatch[1].trim();
  }

  const atMatch = stripped.match(/\bat\s+([A-Z][A-Za-z0-9\s&.,]+?)(?:\s+[-–|·•]|\s*$)/);
  if (atMatch?.[1] && atMatch[1].length >= 2 && atMatch[1].length <= 60) {
    return atMatch[1].trim();
  }

  return null;
}

/** Extract text chunks from HTML elements (first N meaningful text nodes) */
function extractTextChunks(html: string, maxChunks: number): string[] {
  const chunks: string[] = [];
  // Match text content inside common HTML elements
  const tagRegex = /<(?:td|span|div|p|a|strong|b|em)[^>]*>([\s\S]*?)<\/(?:td|span|div|p|a|strong|b|em)>/gi;
  let m;
  while ((m = tagRegex.exec(html)) !== null && chunks.length < maxChunks) {
    const inner = stripTags(m[1]).trim();
    if (inner && inner.length >= 2) {
      chunks.push(inner);
    }
  }
  return chunks;
}

/** Extract location (City, ST format) from HTML context */
function extractLocationFromContext(html: string): string | null {
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 800);
  // "City, ST" or "City, State" patterns
  const cityState = stripped.match(/\b([A-Z][a-zA-Z\s]{1,30},\s*[A-Z]{2})\b/);
  if (cityState) return cityState[1].trim();
  return null;
}

/** Detect remote/hybrid/onsite from nearby HTML */
function detectWorkMode(html: string): string | null {
  const text = html.replace(/<[^>]+>/g, " ").slice(0, 500).toLowerCase();
  if (/\bremote\b/.test(text)) return "remote";
  if (/\bhybrid\b/.test(text)) return "hybrid";
  return null;
}

/** Try to extract company name from ATS-style URLs (e.g. company.greenhouse.io) */
function extractCompanyFromAtsUrl(url: string, domain: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname;
    // For subdomain-based ATS: company.greenhouse.io, company.lever.co, etc.
    const subdomainAts = ["greenhouse.io", "lever.co", "ashbyhq.com", "breezy.hr", "recruitee.com", "bamboohr.com"];
    if (subdomainAts.some((d) => host.endsWith(d))) {
      const sub = host.replace(`.${domain}`, "").replace(/\./g, "");
      if (sub && sub !== "www" && sub !== "app" && sub !== "jobs" && sub.length > 1) {
        // Capitalize first letter
        return sub.charAt(0).toUpperCase() + sub.slice(1);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    return u.toString();
  } catch {
    return url;
  }
}
