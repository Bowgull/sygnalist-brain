import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import path from "path";

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
      attachments: [
        {
          filename: "logo.png",
          path: path.join(process.cwd(), "public", "apple-touch-icon.png"),
          cid: "sygnalist-logo",
        },
      ],
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Sygnalist</title>
  <!--[if !mso]><!-->
  <style>
    @media (prefers-color-scheme: dark) {
      .email-outer { background-color: #0C1016 !important; }
      .email-card { background-color: #171F28 !important; }
    }
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0C1016;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-outer" style="background-color:#0C1016;">
    <tr>
      <td align="center" style="padding:40px 16px 32px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="border-radius:20px;overflow:hidden;background-color:#0C1016;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#0C1016;padding:32px 28px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <img src="cid:sygnalist-logo" alt="" width="48" height="48" style="display:block;border:0;outline:none;width:48px;height:48px;border-radius:12px;">
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:12px;">
                    <span style="font-size:16px;font-weight:800;color:#6AD7A3;letter-spacing:4px;">SYGNALIST</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent line (solid green, not gradient - reliable across clients) -->
          <tr>
            <td style="height:2px;font-size:0;line-height:0;background-color:#6AD7A3;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-card" style="background-color:#171F28;padding:32px 28px;border-radius:20px;">
              <div style="font-size:15px;line-height:1.75;color:#E5E7EB;">
                ${htmlBody}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0C1016;padding:20px 28px;text-align:center;">
              <span style="font-size:11px;color:#6AD7A3;font-weight:bold;letter-spacing:1px;">SYGNALIST</span>
              <span style="font-size:11px;color:#4B5563;"> &nbsp;|&nbsp; </span>
              <span style="font-size:11px;color:#6B7280;">Find the Signal</span>
            </td>
          </tr>

              </table>
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
