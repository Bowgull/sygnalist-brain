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
 * - Batch cap: 20 messages per run, 50 jobs per run
 * - Label management: SYGN_INTAKE → SYGN_INGESTED after processing
 * - Backlog detection: reports if more messages exist
 * - Dedup: checks against jobs_inbox + global_job_bank URLs
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
    const { data: existingInbox } = await service
      .from("jobs_inbox")
      .select("url")
      .not("url", "is", null);
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
    let skippedNoHtml = 0;
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

      // Get HTML body
      const html = extractHtmlBody(msg.payload);
      if (!html) {
        skippedNoHtml++;
        // Still mark as processed - no point retrying a message with no HTML
        processedMessageIds.push(msgId);
        continue;
      }

      // Route to appropriate parser based on sender
      let parsed: ParsedJob[] = [];
      if (from.includes("ziprecruiter")) {
        parsed = parseZipRecruiter(html);
      } else if (from.includes("linkedin")) {
        parsed = parseLinkedIn(html);
      } else if (from.includes("indeed")) {
        parsed = parseIndeed(html);
      } else if (from.includes("glassdoor")) {
        parsed = parseGlassdoor(html);
      } else {
        parsed = parseGeneric(html);
      }

      // Tag each job with the gmail message ID
      for (const job of parsed) {
        job.gmail_message_id = msgId;
      }

      allJobs.push(...parsed);
      processedMessageIds.push(msgId);
    }

    // --- Step 6: Dedup and insert into jobs_inbox (review queue) ---
    const MAX_INGEST_JOBS = 50;
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
        email_received_at: new Date().toISOString(),
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
      messages_skipped: skippedFetch + skippedNoHtml,
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
        messages_skipped_no_html: skippedNoHtml,
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

/** Extract HTML body from Gmail message payload (handles multipart) */
function extractHtmlBody(payload: Record<string, unknown>): string | null {
  if (!payload) return null;

  const mimeType = payload.mimeType as string;
  if (mimeType === "text/html" && payload.body) {
    const body = payload.body as { data?: string };
    return body.data ? Buffer.from(body.data, "base64url").toString("utf-8") : null;
  }

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      const html = extractHtmlBody(part);
      if (html) return html;
    }
  }

  return null;
}

interface ParsedJob {
  title: string;
  company: string;
  url: string;
  location: string | null;
  work_mode: string | null;
  source: string;
  gmail_message_id?: string;
}

/** ZipRecruiter newsletter parser */
function parseZipRecruiter(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const linkRegex = /<a[^>]+href="([^"]*ziprecruiter[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!title || title.length < 3 || title.length > 200) continue;
    if (/unsubscribe|privacy|view in browser/i.test(title)) continue;

    const nearby = html.slice(match.index, match.index + 500);
    const company = extractNearbyText(nearby, /(?:at|company[:\s]*)([^<]{2,60})/i);
    const location = extractNearbyText(nearby, /(?:location[:\s]*|in\s+)([^<]{2,60})/i);

    jobs.push({
      title,
      company: company || "Unknown",
      url: cleanUrl(url),
      location,
      work_mode: /remote/i.test(nearby) ? "remote" : null,
      source: "ziprecruiter_email",
    });
  }
  return jobs;
}

/** LinkedIn digest parser */
function parseLinkedIn(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const linkRegex = /<a[^>]+href="([^"]*linkedin\.com\/jobs[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!title || title.length < 3) continue;
    if (/unsubscribe|privacy/i.test(title)) continue;

    const nearby = html.slice(match.index, match.index + 500);
    const company = extractNearbyText(nearby, /(?:at|company[:\s]*)([^<]{2,60})/i);

    jobs.push({
      title,
      company: company || "Unknown",
      url: cleanUrl(url),
      location: null,
      work_mode: /remote/i.test(nearby) ? "remote" : null,
      source: "linkedin_email",
    });
  }
  return jobs;
}

/** Indeed alert parser */
function parseIndeed(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const linkRegex = /<a[^>]+href="([^"]*indeed\.com[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!title || title.length < 3 || /unsubscribe|privacy|view/i.test(title)) continue;

    const nearby = html.slice(match.index, match.index + 500);
    const company = extractNearbyText(nearby, /(?:company[:\s]*)([^<]{2,60})/i);
    const location = extractNearbyText(nearby, /(?:location[:\s]*)([^<]{2,60})/i);

    jobs.push({
      title,
      company: company || "Unknown",
      url: cleanUrl(url),
      location,
      work_mode: /remote/i.test(nearby) ? "remote" : null,
      source: "indeed_email",
    });
  }
  return jobs;
}

/** Glassdoor parser */
function parseGlassdoor(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const linkRegex = /<a[^>]+href="([^"]*glassdoor[^"]*job[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!title || title.length < 3 || /unsubscribe|privacy/i.test(title)) continue;

    jobs.push({
      title,
      company: "Unknown",
      url: cleanUrl(url),
      location: null,
      work_mode: null,
      source: "glassdoor_email",
    });
  }
  return jobs;
}

/** Generic URL extractor for unknown newsletter formats */
function parseGeneric(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const linkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  const jobDomains = ["lever.co", "greenhouse.io", "workday.com", "smartrecruiters.com", "ashbyhq.com", "jobs."];
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!title || title.length < 5 || title.length > 200) continue;
    if (/unsubscribe|privacy|view in browser|click here|learn more/i.test(title)) continue;

    const isJobUrl = jobDomains.some((d) => url.includes(d));
    if (!isJobUrl) continue;

    jobs.push({
      title,
      company: "Unknown",
      url: cleanUrl(url),
      location: null,
      work_mode: null,
      source: "email_generic",
    });
  }
  return jobs;
}

function extractNearbyText(html: string, pattern: RegExp): string | null {
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const match = pattern.exec(stripped);
  return match?.[1]?.trim() || null;
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
