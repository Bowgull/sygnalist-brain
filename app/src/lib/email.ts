import nodemailer from "nodemailer";
import { randomUUID } from "crypto";

const GMAIL_USER = process.env.GMAIL_SMTP_USER;
const GMAIL_PASS = process.env.GMAIL_SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
  }
  return transporter;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Send a branded Sygnalist email.
 *
 * Generates a deterministic Message-ID so replies can be threaded.
 * The messageId returned is the one set in the email headers.
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
): Promise<SendEmailResult> {
  const transport = getTransporter();
  if (!transport) {
    return { success: false, error: "Gmail SMTP not configured (set GMAIL_SMTP_USER and GMAIL_SMTP_PASS in Vercel env vars)" };
  }

  // Generate a deterministic Message-ID we control
  const messageId = `<${randomUUID()}@sygnalist.app>`;

  try {
    await transport.sendMail({
      from: `"Sygnalist" <${GMAIL_USER}>`,
      to,
      subject,
      messageId,
      html: wrapInTemplate(htmlBody),
    });

    return { success: true, messageId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown send error",
    };
  }
}

/**
 * Escape HTML entities in user/AI content to prevent rendering issues.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Branded Sygnalist email template.
 *
 * Design: Clean light background, table-based layout, Outlook-safe.
 * Uses hosted PNG logo + solid color brand text fallback.
 */
function wrapInTemplate(body: string): string {
  const escaped = escapeHtml(body);
  const htmlBody = escaped.replace(/\n/g, "<br>");

  // Detect deployment URL for logo — fallback to production domain
  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://sygnalist.app";

  const logoUrl = `${baseUrl}/email-logo.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sygnalist</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img src="${logoUrl}" alt="" width="32" height="32" style="display:block;border:0;outline:none;width:32px;height:32px;border-radius:6px;">
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#1a1a1a;letter-spacing:2px;">SYGNALIST</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;border-radius:8px;padding:32px 28px;border:1px solid #e5e7eb;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;">
                ${htmlBody}
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;">Sent via Sygnalist &mdash; Your Job Hunt Coach</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}
