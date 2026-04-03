import nodemailer from "nodemailer";

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

  try {
    const info = await transport.sendMail({
      from: `"Sygnalist" <${GMAIL_USER}>`,
      to,
      subject,
      html: wrapInTemplate(htmlBody),
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown send error",
    };
  }
}

/** Wrap raw HTML content in the branded Sygnalist email template */
function wrapInTemplate(body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0C1016;font-family:'Inter',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#A9FFB5,#5EF2C7,#39D6FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Sygnalist</div>
    </div>
    <div style="background:#171F28;border-radius:16px;padding:32px 24px;border:1px solid rgba(255,255,255,0.08);">
      <div style="color:#E5E7EB;font-size:14px;line-height:1.7;">${htmlBody}</div>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <p style="color:#6B7280;font-size:11px;margin:0;">Sent via Sygnalist — Your Job Hunt Coach</p>
    </div>
  </div>
</body>
</html>`;
}
