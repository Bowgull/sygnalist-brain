import nodemailer from "nodemailer";
import { randomUUID } from "crypto";

const GMAIL_USER = process.env.GMAIL_SMTP_USER;
const GMAIL_PASS = process.env.GMAIL_SMTP_PASS;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sygnalist.app";

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

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
): Promise<SendEmailResult> {
  const transport = getTransporter();
  if (!transport) {
    return { success: false, error: "Gmail SMTP not configured (set GMAIL_SMTP_USER and GMAIL_SMTP_PASS in Vercel env vars)" };
  }

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrapInTemplate(body: string): string {
  const hasHtml = /<[a-z][\s\S]*>/i.test(body);
  const htmlBody = hasHtml
    ? body.replace(/\n/g, "<br>")
    : escapeHtml(body).replace(/\n/g, "<br>");

  const logoUrl = `${SITE_URL}/apple-touch-icon.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Sygnalist</title>
</head>
<body style="margin:0;padding:0;background-color:#0C1016;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0C1016;">
    <tr>
      <td align="center" style="padding:40px 16px 32px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Header bar -->
          <tr>
            <td style="background-color:#0C1016;border-radius:12px 12px 0 0;padding:24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    <img src="${logoUrl}" alt="Sygnalist" width="36" height="36" style="display:block;border:0;outline:none;width:36px;height:36px;border-radius:8px;">
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#6AD7A3;letter-spacing:3px;">SYGNALIST</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gradient accent line -->
          <tr>
            <td style="height:3px;font-size:0;line-height:0;background:linear-gradient(90deg,#A9FFB5,#5EF2C7,#39D6FF);">
              <!--[if mso]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:560px;height:3px;"><v:fill type="gradient" color="#A9FFB5" color2="#39D6FF" angle="90"/></v:rect><![endif]-->
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#171F28;padding:32px 28px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#E5E7EB;">
                ${htmlBody}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0C1016;border-radius:0 0 12px 12px;border-top:1px solid rgba(255,255,255,0.06);padding:16px 28px;text-align:center;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6AD7A3;font-weight:bold;">Sygnalist</span>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#4B5563;"> | </span>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9CA3AF;">Find the Signal</span>
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
