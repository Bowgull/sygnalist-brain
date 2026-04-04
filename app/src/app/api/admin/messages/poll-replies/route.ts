import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";
import { logEvent, logError } from "@/lib/logger";

const MAX_MESSAGES = 25;

/**
 * POST /api/admin/messages/poll-replies — Poll Gmail for client replies
 *
 * Uses the same OAuth refresh token pattern as gmail-ingest.
 * Searches inbox for replies from known client/contact emails, matches them
 * to sent messages via In-Reply-To header, stores in received_messages.
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
      return error("Failed to refresh Gmail access token", 500);
    }

    const { access_token } = await tokenRes.json();
    debug.push("token: ok");

    // --- Step 2: Resolve SYGN_MSG_PROCESSED label ---
    const labelsRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      { headers: { Authorization: `Bearer ${access_token}` } },
    );
    if (!labelsRes.ok) return error("Failed to fetch Gmail labels", 500);

    const labelsData = await labelsRes.json();
    const allLabels = labelsData.labels as Array<{ id: string; name: string }>;
    let processedLabel = allLabels.find((l) => l.name === "SYGN_MSG_PROCESSED");

    if (!processedLabel) {
      const createRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/labels",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "SYGN_MSG_PROCESSED",
            labelListVisibility: "labelHide",
            messageListVisibility: "hide",
          }),
        },
      );
      if (createRes.ok) {
        processedLabel = await createRes.json();
      }
    }

    // --- Step 3: Build email → client_id map from ALL profiles with email ---
    // Include all roles — replies can come from anyone we've messaged
    const { data: allProfiles } = await service
      .from("profiles")
      .select("id, email, role")
      .not("email", "is", null);

    const profileEmailMap = new Map<string, string>();
    for (const p of allProfiles ?? []) {
      if (p.email) profileEmailMap.set(p.email.toLowerCase(), p.id);
    }

    // Also build map from recipient_email on sent_messages (catches free-typed emails)
    const { data: sentRecipients } = await service
      .from("sent_messages")
      .select("client_id, recipient_email")
      .not("recipient_email", "is", null);

    for (const s of sentRecipients ?? []) {
      if (s.recipient_email && s.client_id) {
        const email = s.recipient_email.toLowerCase();
        if (!profileEmailMap.has(email)) {
          profileEmailMap.set(email, s.client_id);
        }
      }
    }

    debug.push(`known_emails: ${profileEmailMap.size}`);

    if (profileEmailMap.size === 0) {
      return json({ new_replies: 0, processed: 0, errors: 0, debug, message: "No contacts found" });
    }

    // --- Step 4: Load existing gmail_message_ids to skip ---
    const { data: existingMsgs } = await service
      .from("received_messages")
      .select("gmail_message_id");

    const existingIds = new Set((existingMsgs ?? []).map((m) => m.gmail_message_id));

    // --- Step 5: Load sent message IDs for reply matching ---
    const { data: sentMsgs } = await service
      .from("sent_messages")
      .select("id, smtp_message_id, client_id")
      .not("smtp_message_id", "is", null);

    const sentByMessageId = new Map<string, { id: string; client_id: string }>();
    for (const s of sentMsgs ?? []) {
      if (s.smtp_message_id) {
        const normalized = s.smtp_message_id.replace(/^<|>$/g, "");
        sentByMessageId.set(normalized, { id: s.id, client_id: s.client_id });
      }
    }
    debug.push(`sent_with_msgid: ${sentByMessageId.size}`);

    // --- Step 6: Search Gmail for unprocessed inbox messages ---
    const query = `in:inbox newer_than:7d -label:SYGN_MSG_PROCESSED`;
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${MAX_MESSAGES}`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    );

    if (!searchRes.ok) {
      const errBody = await searchRes.text().catch(() => "");
      return error(`Failed to search Gmail: ${searchRes.status} ${errBody}`, 500);
    }

    const searchData = await searchRes.json();
    const messageIds = (searchData.messages ?? []) as Array<{ id: string; threadId: string }>;
    debug.push(`gmail_messages_found: ${messageIds.length}`);

    let newReplies = 0;
    let processed = 0;
    let errors = 0;
    let skippedNotContact = 0;
    let skippedExisting = 0;

    for (const { id: gmailMsgId, threadId } of messageIds) {
      if (existingIds.has(gmailMsgId)) {
        if (processedLabel) {
          await labelMessage(access_token, gmailMsgId, processedLabel.id);
        }
        skippedExisting++;
        processed++;
        continue;
      }

      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMsgId}?format=full`,
          { headers: { Authorization: `Bearer ${access_token}` } },
        );
        if (!msgRes.ok) { errors++; continue; }

        const msgData = await msgRes.json();
        const headers = (msgData.payload?.headers ?? []) as Array<{ name: string; value: string }>;

        const getHeader = (name: string) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

        const fromRaw = getHeader("From") ?? "";
        const subject = getHeader("Subject");
        const inReplyTo = getHeader("In-Reply-To");
        const dateHeader = getHeader("Date");

        // Parse from email
        const emailMatch = fromRaw.match(/<([^>]+)>/);
        const fromEmail = (emailMatch ? emailMatch[1] : fromRaw).toLowerCase().trim();
        const nameMatch = fromRaw.match(/^"?([^"<]+)"?\s*</);
        const fromName = nameMatch ? nameMatch[1].trim() : null;

        // Check if from a known contact — OR if this is a reply to one of our sent messages
        let clientId = profileEmailMap.get(fromEmail) ?? null;

        // If not a known profile email, check if In-Reply-To matches a sent message
        if (!clientId && inReplyTo) {
          const normalizedReplyTo = inReplyTo.replace(/^<|>$/g, "");
          const match = sentByMessageId.get(normalizedReplyTo);
          if (match) {
            clientId = match.client_id;
          }
        }

        if (!clientId) {
          // Not from a known contact and not a reply to our messages
          if (processedLabel) {
            await labelMessage(access_token, gmailMsgId, processedLabel.id);
          }
          skippedNotContact++;
          processed++;
          continue;
        }

        // Extract body
        const bodyText = extractBody(msgData.payload, "text/plain");
        const bodyHtml = extractBody(msgData.payload, "text/html");

        // Match to sent message via In-Reply-To
        let matchedSentId: string | null = null;
        if (inReplyTo) {
          const normalizedReplyTo = inReplyTo.replace(/^<|>$/g, "");
          const match = sentByMessageId.get(normalizedReplyTo);
          if (match) {
            matchedSentId = match.id;
          }
        }

        const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

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

          if (matchedSentId) {
            await service
              .from("sent_messages")
              .update({ gmail_thread_id: threadId })
              .eq("id", matchedSentId);
          }
        }

        if (processedLabel) {
          await labelMessage(access_token, gmailMsgId, processedLabel.id);
        }

        processed++;
      } catch (err) {
        debug.push(`msg_err: ${err instanceof Error ? err.message : "unknown"}`);
        errors++;
      }
    }

    await service
      .from("gmail_poll_state")
      .upsert({ id: "singleton", last_polled_at: new Date().toISOString(), updated_at: new Date().toISOString() });

    await logEvent("message.poll_replies", {
      userId: profile.id,
      metadata: { new_replies: newReplies, processed, errors, skippedNotContact, skippedExisting, total_searched: messageIds.length },
    });

    return json({ new_replies: newReplies, processed, errors, skippedNotContact, skippedExisting, debug });
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

async function labelMessage(accessToken: string, messageId: string, labelId: string) {
  try {
    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addLabelIds: [labelId] }),
      },
    );
  } catch {
    // Non-fatal
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
