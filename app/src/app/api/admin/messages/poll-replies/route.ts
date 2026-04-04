import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

const MAX_MESSAGES = 20;
const PARALLEL_BATCH = 5;

/**
 * POST /api/admin/messages/poll-replies — Poll Gmail for replies
 *
 * Simplified approach:
 * 1. Get access token
 * 2. Search for recent inbox messages (no label filtering — dedup via DB)
 * 3. Fetch messages in parallel batches
 * 4. Match to sent messages via sender email or In-Reply-To
 * 5. Insert new replies into received_messages (unique constraint handles dedup)
 */
export async function POST() {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    return error("Gmail API credentials not configured", 500);
  }

  const service = getServiceClient();
  const debug: string[] = [];

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
      const errText = await tokenRes.text().catch(() => "");
      return error(`Failed to refresh Gmail access token: ${errText}`, 500);
    }

    const { access_token } = await tokenRes.json();
    debug.push("token: ok");

    // --- Step 2: Build lookup maps (parallel DB queries) ---
    const [profilesRes, sentRecipientsRes, existingRes, sentMsgsRes] = await Promise.all([
      service.from("profiles").select("id, email").not("email", "is", null),
      service.from("sent_messages").select("client_id, recipient_email").not("recipient_email", "is", null),
      service.from("received_messages").select("gmail_message_id"),
      service.from("sent_messages").select("id, smtp_message_id, client_id").not("smtp_message_id", "is", null),
    ]);

    // Email → profile ID map (all profiles)
    const emailToProfileId = new Map<string, string>();
    for (const p of profilesRes.data ?? []) {
      if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id);
    }
    // Also add recipient emails from sent_messages
    for (const s of sentRecipientsRes.data ?? []) {
      if (s.recipient_email && s.client_id) {
        const e = s.recipient_email.toLowerCase();
        if (!emailToProfileId.has(e)) emailToProfileId.set(e, s.client_id);
      }
    }
    debug.push(`known_emails: ${emailToProfileId.size}`);

    // Already-stored gmail message IDs (for dedup)
    const existingIds = new Set((existingRes.data ?? []).map((m) => m.gmail_message_id));
    debug.push(`already_stored: ${existingIds.size}`);

    // Sent message ID → client mapping (for In-Reply-To matching)
    const sentByMessageId = new Map<string, { id: string; client_id: string }>();
    for (const s of sentMsgsRes.data ?? []) {
      if (s.smtp_message_id) {
        const normalized = s.smtp_message_id.replace(/^<|>$/g, "");
        sentByMessageId.set(normalized, { id: s.id, client_id: s.client_id });
      }
    }
    debug.push(`sent_with_msgid: ${sentByMessageId.size}`);

    // --- Step 3: Search Gmail inbox — simple, no label filtering ---
    const query = `in:inbox newer_than:7d`;
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${MAX_MESSAGES}`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    );

    if (!searchRes.ok) {
      const errBody = await searchRes.text().catch(() => "");
      return error(`Gmail search failed: ${searchRes.status} ${errBody}`, 500);
    }

    const searchData = await searchRes.json();
    const gmailMessages = (searchData.messages ?? []) as Array<{ id: string; threadId: string }>;
    debug.push(`inbox_messages: ${gmailMessages.length}`);

    // Filter out already-stored messages BEFORE fetching (saves API calls)
    const toFetch = gmailMessages.filter((m) => !existingIds.has(m.id));
    debug.push(`to_fetch: ${toFetch.length}`);

    if (toFetch.length === 0) {
      return json({ new_replies: 0, processed: 0, errors: 0, skipped_known: gmailMessages.length - toFetch.length, debug });
    }

    // --- Step 4: Fetch messages in parallel batches ---
    let newReplies = 0;
    let errors = 0;
    let skippedNotContact = 0;

    for (let i = 0; i < toFetch.length; i += PARALLEL_BATCH) {
      const batch = toFetch.slice(i, i + PARALLEL_BATCH);

      const results = await Promise.allSettled(
        batch.map(async ({ id: gmailMsgId, threadId }) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMsgId}?format=full`,
            { headers: { Authorization: `Bearer ${access_token}` } },
          );
          if (!msgRes.ok) throw new Error(`fetch failed: ${msgRes.status}`);

          const msgData = await msgRes.json();
          return { gmailMsgId, threadId, msgData };
        }),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          errors++;
          debug.push(`fetch_err: ${result.reason}`);
          continue;
        }

        const { gmailMsgId, threadId, msgData } = result.value;

        try {
          const hdrs = (msgData.payload?.headers ?? []) as Array<{ name: string; value: string }>;
          const getHeader = (name: string) =>
            hdrs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

          const fromRaw = getHeader("From") ?? "";
          const subject = getHeader("Subject");
          const inReplyTo = getHeader("In-Reply-To");
          const dateHeader = getHeader("Date");

          // Parse sender email
          const emailMatch = fromRaw.match(/<([^>]+)>/);
          const fromEmail = (emailMatch ? emailMatch[1] : fromRaw).toLowerCase().trim();
          const nameMatch = fromRaw.match(/^"?([^"<]+)"?\s*</);
          const fromName = nameMatch ? nameMatch[1].trim() : null;

          // Resolve client_id: try profile email, then In-Reply-To match
          let clientId = emailToProfileId.get(fromEmail) ?? null;

          if (!clientId && inReplyTo) {
            const normalized = inReplyTo.replace(/^<|>$/g, "");
            const match = sentByMessageId.get(normalized);
            if (match) clientId = match.client_id;
          }

          if (!clientId) {
            skippedNotContact++;
            debug.push(`skip: ${fromEmail} (not a contact)`);
            continue;
          }

          // Extract body
          const bodyText = extractBody(msgData.payload, "text/plain");
          const bodyHtml = extractBody(msgData.payload, "text/html");

          // Match to sent message for thread linking
          let matchedSentId: string | null = null;
          if (inReplyTo) {
            const normalized = inReplyTo.replace(/^<|>$/g, "");
            const match = sentByMessageId.get(normalized);
            if (match) matchedSentId = match.id;
          }

          const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

          // Insert — unique constraint on gmail_message_id handles dedup
          const { error: insertErr } = await service.from("received_messages").insert({
            gmail_message_id: gmailMsgId,
            gmail_thread_id: threadId,
            from_email: fromEmail,
            from_name: fromName,
            subject,
            body_text: bodyText,
            body_html: bodyHtml,
            received_at: receivedAt,
            in_reply_to: inReplyTo?.replace(/^<|>$/g, "") || null,
            client_id: clientId,
            is_read: false,
          });

          if (insertErr) {
            debug.push(`insert_err: ${insertErr.message}`);
            errors++;
          } else {
            newReplies++;
            debug.push(`matched: ${fromEmail} → ${clientId}`);

            if (matchedSentId) {
              await service
                .from("sent_messages")
                .update({ gmail_thread_id: threadId })
                .eq("id", matchedSentId);
            }
          }
        } catch (err) {
          debug.push(`process_err: ${err instanceof Error ? err.message : "unknown"}`);
          errors++;
        }
      }
    }

    // Update poll state
    await service
      .from("gmail_poll_state")
      .upsert({ id: "singleton", last_polled_at: new Date().toISOString(), updated_at: new Date().toISOString() });

    await logEvent("message.poll_replies", {
      userId: profile.id,
      metadata: { new_replies: newReplies, errors, skippedNotContact, total: gmailMessages.length },
    });

    return json({ new_replies: newReplies, processed: toFetch.length, errors, skippedNotContact, debug });
  } catch (err) {
    await logError(err instanceof Error ? err.message : "Reply polling failed", {
      severity: "error",
      sourceSystem: "gmail.poll_replies",
      userId: profile.id,
      metadata: {},
    });
    return error(`Reply polling failed: ${err instanceof Error ? err.message : "unknown"}`, 500);
  }
}

function extractBody(
  payload: Record<string, unknown>,
  mimeType: string,
): string | null {
  const partMime = payload.mimeType as string;
  if (partMime === mimeType && payload.body) {
    const body = payload.body as { data?: string };
    return body.data ? Buffer.from(body.data, "base64url").toString("utf-8") : null;
  }
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      const result = extractBody(part, mimeType);
      if (result) return result;
    }
  }
  return null;
}
