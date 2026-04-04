import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

/**
 * POST /api/admin/gmail-ingest — trigger Gmail ingest.
 *
 * Pulls job URLs and metadata from labeled Gmail threads.
 * Supports newsletter-aware parsing for ZipRecruiter, LinkedIn, Indeed, Glassdoor.
 *
 * Requires GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN env vars.
 * Uses Gmail API to fetch threads with the SYGN_INTAKE label.
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
    // Get access token from refresh token
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

    // Search for threads with SYGN_INTAKE label
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label:SYGN_INTAKE&maxResults=20`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    );

    if (!searchRes.ok) {
      return error("Failed to search Gmail", 500);
    }

    const searchData = await searchRes.json();
    const messageIds: string[] = (searchData.messages ?? []).map((m: { id: string }) => m.id);

    if (messageIds.length === 0) {
      return json({ message: "No messages with SYGN_INTAKE label found", jobs_ingested: 0 });
    }

    const jobs: Array<{ title: string; company: string; url: string; location: string | null; work_mode: string | null; source: string }> = [];

    let skippedFetch = 0;
    let skippedNoHtml = 0;

    // Process each message
    for (const msgId of messageIds) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${access_token}` } },
      );

      if (!msgRes.ok) { skippedFetch++; continue; }
      const msg = await msgRes.json();

      // Get sender from headers
      const fromHeader = msg.payload?.headers?.find(
        (h: { name: string; value: string }) => h.name.toLowerCase() === "from",
      );
      const from = fromHeader?.value?.toLowerCase() ?? "";

      // Get HTML body
      const html = extractHtmlBody(msg.payload);
      if (!html) { skippedNoHtml++; continue; }

      // Route to appropriate parser based on sender
      if (from.includes("ziprecruiter")) {
        jobs.push(...parseZipRecruiter(html));
      } else if (from.includes("linkedin")) {
        jobs.push(...parseLinkedIn(html));
      } else if (from.includes("indeed")) {
        jobs.push(...parseIndeed(html));
      } else if (from.includes("glassdoor")) {
        jobs.push(...parseGlassdoor(html));
      } else {
        // Generic: extract all job-like URLs
        jobs.push(...parseGeneric(html));
      }
    }

    // Insert into global_job_bank (dedupe by URL)
    let inserted = 0;
    if (jobs.length > 0) {
      const rows = jobs.map((j) => ({
        title: j.title || null,
        company: j.company || null,
        url: j.url,
        source: j.source,
        location: j.location,
        work_mode: j.work_mode,
      }));

      // Filter to only jobs with URLs (required for upsert)
      const withUrl = rows.filter((r) => r.url);
      const withoutUrl = rows.filter((r) => !r.url);

      if (withUrl.length > 0) {
        const { data } = await service
          .from("global_job_bank")
          .upsert(withUrl, { onConflict: "url" })
          .select("id");
        inserted += data?.length ?? 0;
      }

      if (withoutUrl.length > 0) {
        const { data } = await service
          .from("global_job_bank")
          .insert(withoutUrl)
          .select("id");
        inserted += data?.length ?? 0;
      }
    }

    await logEvent("gmail.ingest_completed", {
      userId: profile.id,
      metadata: {
        messages_total: messageIds.length,
        messages_skipped_fetch: skippedFetch,
        messages_skipped_no_html: skippedNoHtml,
        jobs_found: jobs.length,
        jobs_inserted: inserted,
      },
    });

    return json({
      message: `Processed ${messageIds.length} emails, found ${jobs.length} jobs, ${inserted} added to job bank`,
      jobs_ingested: inserted,
      jobs_found: jobs.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown gmail ingest error";
    await logError(msg, {
      sourceSystem: "gmail.ingest",
      userId: profile.id,
    });
    return error("Gmail ingest failed", 500);
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
}

/** ZipRecruiter newsletter parser */
function parseZipRecruiter(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  // ZipRecruiter cards have a pattern: <a> with job title text, nearby company and location
  const linkRegex = /<a[^>]+href="([^"]*ziprecruiter[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!title || title.length < 3 || title.length > 200) continue;
    if (/unsubscribe|privacy|view in browser/i.test(title)) continue;

    // Try to find company/location nearby in the HTML
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
