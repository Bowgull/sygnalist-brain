import { requireAdmin, json, error, getServiceClient } from "@/lib/api-helpers";

/**
 * GET /api/admin/messages — List sent messages with optional client filter
 * POST /api/admin/messages — Send an email to a client
 */
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = getServiceClient();
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");

  let query = service
    .from("sent_messages")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(50);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error: err } = await query;
  if (err) return error(err.message, 500);

  return json(data);
}

export async function POST(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { client_id, template_id, subject, body: emailBody, tracker_entry_id } = body;

  if (!client_id || !subject || !emailBody) {
    return error("client_id, subject, and body are required");
  }

  const service = getServiceClient();

  // Get client info
  const { data: client } = await service
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", client_id)
    .single();

  if (!client || !client.email) {
    return error("Client not found or has no email");
  }

  // Send email via SMTP
  const emailSent = await sendEmail(client.email, subject, emailBody);

  // Log to sent_messages
  const { data: msg, error: insertErr } = await service
    .from("sent_messages")
    .insert({
      coach_id: profile.id,
      client_id,
      template_id: template_id || null,
      subject,
      body: emailBody,
      tracker_entry_id: tracker_entry_id || null,
    })
    .select()
    .single();

  if (insertErr) return error(insertErr.message, 500);

  // Log to email_logs
  await service.from("email_logs").insert({
    recipient_email: client.email,
    recipient_id: client_id,
    email_type: template_id ? "template" : "manual",
    subject,
    success: emailSent,
    template_id: template_id || null,
  });

  return json({ sent: emailSent, message: msg });
}

/** Send email via SMTP (nodemailer-compatible) */
async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const SMTP_FROM = process.env.SMTP_FROM || "sygnalist.app@gmail.com";

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("SMTP not configured — email not sent");
    return false;
  }

  try {
    // Use nodemailer dynamically (avoids build error if not installed)
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || "587", 10),
      secure: (SMTP_PORT || "587") === "465",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transport.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html: htmlBody,
    });

    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}
