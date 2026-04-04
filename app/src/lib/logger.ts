import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Centralized Logger — logEvent, logError, sendAlertEmail
// ---------------------------------------------------------------------------

type Meta = Record<string, unknown>;

/**
 * Log an auditable user/system event to user_events.
 *
 * Every API route should call this instead of manually inserting.
 */
export async function logEvent(
  eventType: string,
  opts: {
    userId?: string | null;
    requestId?: string;
    success?: boolean;
    metadata?: Meta;
  } = {}
) {
  try {
    const service = createServiceClient();
    await service.from("user_events").insert({
      user_id: opts.userId ?? null,
      event_type: eventType,
      request_id: opts.requestId ?? null,
      success: opts.success ?? true,
      metadata: (opts.metadata ?? {}) as Json,
    });
  } catch {
    // Logging must never break callers
  }
}

/**
 * Log a structured error to error_logs. Optionally sends an alert email
 * for "error" and "critical" severity.
 */
export async function logError(
  message: string,
  opts: {
    severity?: "info" | "warning" | "error" | "critical";
    sourceSystem?: string;
    userId?: string | null;
    requestId?: string;
    stackTrace?: string;
    metadata?: Meta;
  } = {}
) {
  const severity = opts.severity ?? "error";

  try {
    const service = createServiceClient();
    await service.from("error_logs").insert({
      severity,
      source_system: opts.sourceSystem ?? "api",
      message,
      stack_trace: opts.stackTrace ?? null,
      user_id: opts.userId ?? null,
      request_id: opts.requestId ?? null,
      metadata: (opts.metadata ?? {}) as Json,
    });
  } catch {
    // Logging must never break callers
  }

  // Send alert email for error + critical if SMTP is configured
  if (severity === "error" || severity === "critical") {
    sendAlertEmail(message, severity, opts.sourceSystem ?? "api", opts.metadata).catch(
      () => {
        // Alert email is best-effort
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Alert Email — uses nodemailer with SMTP env vars
// ---------------------------------------------------------------------------

/**
 * Send an alert email when a high-severity error is logged.
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL_TO
 *
 * Optional:
 *   ALERT_EMAIL_FROM  (defaults to SMTP_USER)
 *
 * If any required var is missing, this is a silent no-op.
 */
async function sendAlertEmail(
  errorMessage: string,
  severity: string,
  source: string,
  metadata?: Record<string, unknown>
) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM ?? user;

  if (!host || !user || !pass || !to) return;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const metaBlock = metadata
    ? Object.entries(metadata)
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
        .join("\n")
    : "  (none)";

  const subject = `[Sygnalist ${severity.toUpperCase()}] ${errorMessage.slice(0, 80)}`;

  const text = `Severity: ${severity.toUpperCase()}
Source:   ${source}
Time:     ${new Date().toISOString()}

Message:
  ${errorMessage}

Metadata:
${metaBlock}
`;

  await transporter.sendMail({ from, to, subject, text });
}
