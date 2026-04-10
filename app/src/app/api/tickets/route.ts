import { requireAuth, requireAdmin, json, error, getServiceClient, getRequestId } from "@/lib/api-helpers";
import { sendEmail } from "@/lib/email";
import { logEvent } from "@/lib/logger";

const VALID_STATUSES = ["open", "in_progress", "resolved"];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];
const VALID_SOURCES = ["user_report", "activity", "error", "manual"];

const ANIME_NAMES = [
  // Dragon Ball Z
  "goku", "vegeta", "gohan", "piccolo", "trunks", "krillin", "frieza", "cell", "beerus", "broly",
  // Naruto
  "naruto", "sasuke", "kakashi", "itachi", "hinata", "sakura", "gaara", "jiraiya", "tsunade",
  "madara", "obito", "minato", "lee", "shikamaru",
  // One Piece
  "luffy", "zoro", "sanji", "nami", "robin", "chopper", "franky", "jinbe", "ace", "law", "shanks",
  // Demon Slayer
  "tanjiro", "nezuko", "zenitsu", "inosuke", "rengoku", "tengen", "muzan", "akaza", "giyu",
  // My Hero Academia
  "deku", "bakugo", "todoroki", "allmight", "aizawa", "uraraka", "hawks", "endeavor", "toga", "dabi",
  // Jujutsu Kaisen
  "gojo", "yuji", "megumi", "nobara", "sukuna", "todo", "nanami", "maki", "toge",
  // Hunter x Hunter
  "gon", "killua", "hisoka", "kurapika", "leorio", "chrollo", "meruem", "netero", "illumi",
  // Fullmetal Alchemist
  "edward", "alphonse", "mustang", "hawkeye", "scar", "winry", "bradley", "envy", "greed",
  // Cowboy Bebop
  "spike", "jet", "faye", "vicious", "julia",
  // Avatar TLA
  "aang", "zuko", "katara", "sokka", "toph", "iroh", "azula", "appa",
];

/** Generate a unique ticket name like "killua-3" using sequential numbering */
async function generateTicketName(service: ReturnType<typeof getServiceClient>): Promise<string> {
  // Count existing tickets to get the next number
  const { count } = await service.from("tickets").select("id", { count: "exact", head: true });
  const num = (count ?? 0) + 1;
  const name = ANIME_NAMES[Math.floor(Math.random() * ANIME_NAMES.length)];
  return `${name}-${num}`;
}

/** POST /api/tickets - create a ticket (any authenticated user for reports, admin for other sources) */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, profile, response } = await requireAuth();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const body = await request.json();
  const { message, pageUrl, userAgent, screenSize, title, source, priority, eventIds, errorIds } = body;

  // User report flow: just needs a message
  const isUserReport = !source || source === "user_report";

  if (isUserReport) {
    if (!message || typeof message !== "string" || message.length < 1 || message.length > 5000) {
      return error("Message is required (1-5000 characters)", 400);
    }

    const service = getServiceClient();
    const ticketName = await generateTicketName(service);
    const ticketTitle = title || message.slice(0, 80);
    const { data: ticket, error: insertErr } = await service
      .from("tickets")
      .insert({
        ticket_name: ticketName,
        title: ticketTitle,
        source: "user_report",
        reporter_id: profile.id,
        message,
        page_url: pageUrl ?? null,
        user_agent: userAgent ?? null,
        screen_size: screenSize ?? null,
      })
      .select()
      .single();

    if (insertErr) return error(insertErr.message, 500);

    logEvent("ticket.created", { userId: profile.id, requestId, metadata: { ticket_id: ticket.id, ticket_name: ticketName, source: "user_report" } });

    // Fire-and-forget alert email
    const feedbackTo = process.env.FEEDBACK_EMAIL_TO ?? process.env.GMAIL_SMTP_USER;
    if (feedbackTo) {
      sendEmail(
        feedbackTo,
        `[Sygnalist Beta] Feedback from ${profile.display_name}`,
        `<h2 style="color:#6AD7A3;font-size:18px;margin:0 0 16px;">Beta Feedback</h2>
<div style="background:#0C1016;border-radius:12px;padding:16px;margin:0 0 20px;">
  <p style="color:#E5E7EB;white-space:pre-wrap;margin:0;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
</div>
<table style="font-size:13px;color:#9CA3AF;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:600;">From:</td><td>${profile.display_name} (${profile.email})</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Page:</td><td>${pageUrl || "—"}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Screen:</td><td>${screenSize || "—"}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Time:</td><td>${new Date().toISOString()}</td></tr>
</table>`,
      ).catch(() => {});
    }

    return json({ ok: true, ticket_id: ticket.id }, 201);
  }

  // Admin-only: create ticket from activity/error/manual
  if (profile.role !== "admin") return error("Forbidden", 403);
  if (source && !VALID_SOURCES.includes(source)) return error("Invalid source", 400);
  if (priority && !VALID_PRIORITIES.includes(priority)) return error("Invalid priority", 400);
  if (!title && !message) return error("Title or message required", 400);

  const service = getServiceClient();
  const ticketName = await generateTicketName(service);
  const { data: ticket, error: insertErr } = await service
    .from("tickets")
    .insert({
      ticket_name: ticketName,
      title: title || (message ? message.slice(0, 80) : "Untitled ticket"),
      source: source || "manual",
      priority: priority || "medium",
      reporter_id: profile.id,
      message: message ?? null,
    })
    .select()
    .single();

  if (insertErr) return error(insertErr.message, 500);

  // Link events/errors if provided
  if (eventIds?.length) {
    await service.from("user_events").update({ ticket_id: ticket.id }).in("id", eventIds);
  }
  if (errorIds?.length) {
    await service.from("error_logs").update({ ticket_id: ticket.id }).in("id", errorIds);
  }

  logEvent("ticket.created", { userId: profile.id, requestId, metadata: { ticket_id: ticket.id, ticket_name: ticketName, source: source || "manual", linked_events: eventIds?.length ?? 0, linked_errors: errorIds?.length ?? 0 } });

  return json({ ok: true, ticket_id: ticket.id }, 201);
}

/** GET /api/tickets - list tickets (admin only) */
export async function GET(request: Request) {
  const { response, profile } = await requireAdmin();
  if (response) return response;
  if (!profile) return error("Profile not found", 404);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const source = searchParams.get("source");
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const service = getServiceClient();

  let query = service
    .from("tickets")
    .select("*, reporter:profiles!tickets_reporter_id_fkey(display_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && VALID_STATUSES.includes(status)) query = query.eq("status", status);
  if (priority && VALID_PRIORITIES.includes(priority)) query = query.eq("priority", priority);
  if (source && VALID_SOURCES.includes(source)) query = query.eq("source", source);
  if (search) query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%,ticket_name.ilike.%${search}%`);

  const { data: tickets, error: dbErr, count } = await query;
  if (dbErr) return error(dbErr.message, 500);

  // Get linked item counts for each ticket
  const ticketIds = (tickets ?? []).map((t: Record<string, unknown>) => t.id as string);
  let eventCounts: Record<string, number> = {};
  let errorCounts: Record<string, number> = {};

  if (ticketIds.length > 0) {
    const { data: events } = await service.from("user_events").select("ticket_id").in("ticket_id", ticketIds);
    for (const e of events ?? []) {
      if (e.ticket_id) eventCounts[e.ticket_id] = (eventCounts[e.ticket_id] ?? 0) + 1;
    }
    const { data: errors } = await service.from("error_logs").select("ticket_id").in("ticket_id", ticketIds);
    for (const e of errors ?? []) {
      if (e.ticket_id) errorCounts[e.ticket_id] = (errorCounts[e.ticket_id] ?? 0) + 1;
    }
  }

  const enriched = (tickets ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    linked_events: eventCounts[t.id as string] ?? 0,
    linked_errors: errorCounts[t.id as string] ?? 0,
  }));

  return json({ tickets: enriched, total: count });
}
