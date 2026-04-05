import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type Meta = Record<string, unknown>;
type Severity = "info" | "warning" | "error" | "critical";

/**
 * Log an auditable user/system event to user_events.
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
 * Log a structured error to error_logs. Sends alert email for error/critical.
 */
export async function logError(
  message: string,
  opts: {
    severity?: Severity;
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
      stack_trace: opts.stackTrace ?? new Error("[logError]").stack ?? null,
      user_id: opts.userId ?? null,
      request_id: opts.requestId ?? null,
      metadata: (opts.metadata ?? {}) as Json,
    });
  } catch {
    // Logging must never break callers
  }

  if (severity === "error" || severity === "critical") {
    sendAlertEmail(message, severity, opts.sourceSystem ?? "api", opts.metadata).catch(() => {});
  }
}

/**
 * Dual-log a failure: creates both an event (audit trail) and an error (operational),
 * linked by request_id so they can be traced together.
 */
export async function logFailure(
  eventType: string,
  message: string,
  opts: {
    severity?: Severity;
    sourceSystem?: string;
    userId?: string | null;
    requestId?: string;
    stackTrace?: string;
    metadata?: Meta;
  } = {}
) {
  const requestId = opts.requestId ?? crypto.randomUUID();
  await Promise.allSettled([
    logEvent(eventType, {
      userId: opts.userId,
      requestId,
      success: false,
      metadata: opts.metadata,
    }),
    logError(message, {
      severity: opts.severity ?? "error",
      sourceSystem: opts.sourceSystem,
      userId: opts.userId,
      requestId,
      stackTrace: opts.stackTrace,
      metadata: opts.metadata,
    }),
  ]);
}

async function sendAlertEmail(errorMessage: string, severity: string, source: string, metadata?: Meta) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM ?? user;
  if (!host || !user || !pass || !to) return;

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  const metaBlock = metadata ? Object.entries(metadata).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join("\n") : "  (none)";

  await transporter.sendMail({
    from, to,
    subject: `[Sygnalist ${severity.toUpperCase()}] ${errorMessage.slice(0, 80)}`,
    text: `Severity: ${severity.toUpperCase()}\nSource:   ${source}\nTime:     ${new Date().toISOString()}\n\nMessage:\n  ${errorMessage}\n\nMetadata:\n${metaBlock}\n`,
  });
}
