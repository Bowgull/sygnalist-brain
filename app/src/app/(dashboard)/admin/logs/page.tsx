"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";

type LogType = "fetches" | "errors" | "events";

// ── Domain-based badge styles ──────────────────────────────────────────
const domainStyles: Record<string, { badge: string; dot: string; label: string }> = {
  auth:    { badge: "border-[#3B82F6] bg-[#3B82F6]/12 text-[#3B82F6]", dot: "bg-[#3B82F6]", label: "Auth" },
  inbox:   { badge: "border-[#22C55E] bg-[#22C55E]/12 text-[#22C55E]", dot: "bg-[#22C55E]", label: "Inbox" },
  tracker: { badge: "border-[#8B5CF6] bg-[#8B5CF6]/12 text-[#8B5CF6]", dot: "bg-[#8B5CF6]", label: "Tracker" },
  fetch:   { badge: "border-[#22C55E] bg-[#22C55E]/12 text-[#22C55E]", dot: "bg-[#22C55E]", label: "Fetch" },
  admin:   { badge: "border-[#A855F7] bg-[#A855F7]/12 text-[#A855F7]", dot: "bg-[#A855F7]", label: "Admin" },
  message: { badge: "border-[#FAD76A] bg-[#FAD76A]/12 text-[#FAD76A]", dot: "bg-[#FAD76A]", label: "Message" },
  gmail:   { badge: "border-[#14B8A6] bg-[#14B8A6]/12 text-[#14B8A6]", dot: "bg-[#14B8A6]", label: "Gmail" },
  cron:    { badge: "border-[#14B8A6] bg-[#14B8A6]/12 text-[#14B8A6]", dot: "bg-[#14B8A6]", label: "Cron" },
  enrich:  { badge: "border-[#38BDF8] bg-[#38BDF8]/12 text-[#38BDF8]", dot: "bg-[#38BDF8]", label: "Enrich" },
  system:  { badge: "border-[#9CA3AF] bg-[#9CA3AF]/10 text-[#9CA3AF]", dot: "bg-[#9CA3AF]", label: "System" },
};
const defaultDomain = { badge: "border-[#9CA3AF] bg-[#9CA3AF]/10 text-[#9CA3AF]", dot: "bg-[#9CA3AF]", label: "Event" };

function getDomainStyle(eventType: string) {
  const domain = (eventType || "").split(".")[0];
  return domainStyles[domain] || defaultDomain;
}

// ── Severity badges (for errors tab) ───────────────────────────────────
const severityStyles: Record<string, string> = {
  critical: "border-[#DC2626] bg-[#DC2626]/15 text-[#DC2626]",
  error: "border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]",
  warning: "border-[#FAD76A] bg-[#FAD76A]/15 text-[#FAD76A]",
  info: "border-[#9CA3AF] bg-[#9CA3AF]/10 text-[#9CA3AF]",
};

function getSeverityStyle(severity: string): string {
  return severityStyles[severity] || severityStyles.info;
}

// ── Fetch tab badge ────────────────────────────────────────────────────
const fetchBadge = "border-[#22C55E] bg-[#22C55E]/15 text-[#22C55E]";

// ── Helpers ────────────────────────────────────────────────────────────
function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fullTime(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Human-readable action label from dotted event type */
function actionLabel(eventType: string): string {
  const action = (eventType || "").split(".").slice(1).join(".");
  if (!action) return eventType || "unknown";
  return action.replace(/_/g, " ");
}

/** Pick the most meaningful metadata key to show in the preview */
function previewMeta(meta: Record<string, unknown> | null): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  // Priority keys
  for (const key of ["reason", "email", "method", "display_name", "client_id", "target_profile_id", "tracker_entry_id", "batch_id", "inbox_job_id"]) {
    if (meta[key] !== undefined && meta[key] !== null) {
      return `${key}: ${meta[key]}`;
    }
  }
  // Fallback: first key
  const [k, v] = Object.entries(meta)[0];
  return `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`;
}

// ── Main Component ─────────────────────────────────────────────────────
export default function AdminLogsPage() {
  const [logType, setLogType] = useState<LogType>("events");
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  // Fetch logs
  useEffect(() => {
    setLoading(true);
    setExpandedId(null);
    fetch(`/api/admin/logs?type=${logType}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [logType]);

  // Fetch profile names for user_id resolution (events tab only)
  useEffect(() => {
    if (logType !== "events") return;
    fetch("/api/admin/profiles")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          for (const p of data) {
            if (p.id && p.display_name) map[p.id] = p.display_name;
          }
          setProfileMap(map);
        }
      })
      .catch(() => {});
  }, [logType]);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  async function handleResolve(errorId: string, note?: string) {
    const res = await fetch("/api/admin/logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error_id: errorId, resolve_note: note || undefined }),
    });
    if (res.ok) {
      setLogs((prev) =>
        prev.map((l) => (l.id === errorId ? { ...l, resolved: true, resolve_note: note || null } : l))
      );
      setResolvingId(null);
      setResolveNote("");
    }
  }

  return (
    <div className="space-y-4">
      {/* Type tabs */}
      <div className="flex items-center gap-2">
        {(["events", "errors", "fetches"] as LogType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setLogType(t)}
            className={`rounded-full px-3 py-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
              logType === t
                ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                : "text-[#9CA3AF] hover:text-[#B8BFC8]"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-[0.6875rem] tabular-nums text-[#9CA3AF]">{logs.length} entries</span>
      </div>

      {loading ? (
        <div className="space-y-1">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg" />)}</div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center"><p className="text-[0.8125rem] text-[#9CA3AF]">No {logType} logs yet</p></div>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.06)] bg-[#171F28] overflow-hidden divide-y divide-[#2A3544]/40">
          {logs.map((log) => {
            const id = log.id as string;
            const isExpanded = expandedId === id;

            {/* ── FETCHES TAB ── */}
            if (logType === "fetches") {
              const success = log.success as boolean;
              const duration = formatDuration(log.duration_ms as number);
              const time = fullTime(log.created_at as string);
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#222D3D]/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : id)}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${success ? "bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.4)]" : "bg-[#DC2626] shadow-[0_0_6px_rgba(220,38,38,0.4)]"}`} />
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${fetchBadge}`}>
                    {log.source_name as string}
                  </span>
                  <div className="min-w-0 flex-1">
                    {log.search_term ? (
                      <span className="text-[0.75rem] text-[#9CA3AF] truncate">&ldquo;{String(log.search_term)}&rdquo;</span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[0.75rem] font-semibold tabular-nums text-white">{log.jobs_returned as number}</span>
                  <span className="shrink-0 text-[0.6875rem] text-[#9CA3AF]">jobs</span>
                  {duration && (
                    <span className="shrink-0 rounded bg-[#6AD7A3]/10 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-[#6AD7A3]">
                      {duration}
                    </span>
                  )}
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{time}</span>
                </div>
              );
            }

            {/* ── ERRORS TAB ── */}
            if (logType === "errors") {
              const severity = log.severity as string;
              const time = fullTime(log.created_at as string);
              return (
                <div key={id} className="px-4 py-3 hover:bg-[#222D3D]/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${getSeverityStyle(severity)}`}>
                      {severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[0.75rem] font-medium text-[#B8BFC8]">{log.source_system as string}</span>
                        <span className="text-[0.6875rem] tabular-nums text-[#9CA3AF]">{time}</span>
                      </div>
                      <p className="mt-1 text-[0.8125rem] text-white">{log.message as string}</p>
                      {log.stack_trace ? (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : id)}
                          className="mt-1 text-[0.6875rem] text-[#38BDF8] hover:underline"
                        >
                          {isExpanded ? "Hide stack" : "Show stack"}
                        </button>
                      ) : null}
                      {isExpanded && log.stack_trace ? (
                        <pre className="mt-2 max-h-32 overflow-auto rounded bg-[#0C1016] p-2 text-[0.6875rem] text-[#9CA3AF]">
                          {String(log.stack_trace)}
                        </pre>
                      ) : null}
                    </div>
                    {!(log.resolved as boolean) ? (
                      resolvingId === id ? (
                        <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="w-36 rounded-lg border border-[#2A3544] bg-[#0C1016] px-2 py-1 text-[0.6875rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
                            onKeyDown={(e) => { if (e.key === "Enter") handleResolve(id, resolveNote); }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleResolve(id, resolveNote)}
                            className="shrink-0 rounded-full border border-[#6AD7A3]/30 p-1.5 text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
                            title="Confirm resolve"
                          >
                            <Check size={14} strokeWidth={2} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setResolvingId(id); setResolveNote(""); }}
                          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[#6AD7A3]/30 px-2.5 py-1 text-[0.6875rem] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
                        >
                          <Check size={14} strokeWidth={2} />
                          Resolve
                        </button>
                      )
                    ) : (
                      <div className="shrink-0 text-right">
                        <span className="text-[0.6875rem] text-[#6AD7A3]/50">Resolved</span>
                        {typeof log.resolve_note === "string" && log.resolve_note && (
                          <p className="mt-0.5 text-[0.625rem] text-[#9CA3AF] italic max-w-[140px] truncate" title={log.resolve_note}>{log.resolve_note}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            {/* ── EVENTS TAB ── */}
            const eventType = (log.event_type as string) || "unknown";
            const meta = log.metadata as Record<string, unknown> | null;
            const success = log.success as boolean;
            const domain = getDomainStyle(eventType);
            const userId = log.user_id as string | null;
            const userName = userId ? profileMap[userId] : null;
            const requestId = log.request_id as string | null;
            const rel = relativeTime(log.created_at as string);

            return (
              <div key={id}>
                {/* Row */}
                <div
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-[#222D3D]/20 ${
                    !success ? "border-l-2 border-l-[#DC2626]/60" : "border-l-2 border-l-transparent"
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : id)}
                >
                  {/* Success/failure dot */}
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      success
                        ? "bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.3)]"
                        : "bg-[#DC2626] shadow-[0_0_6px_rgba(220,38,38,0.4)]"
                    }`}
                  />

                  {/* Domain badge */}
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${domain.badge}`}>
                    {eventType}
                  </span>

                  {/* Preview: most important metadata */}
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-[#B8BFC8]">
                    {previewMeta(meta) || "—"}
                  </span>

                  {/* User name or removed user pill */}
                  {userName ? (
                    <span className="shrink-0 text-[0.6875rem] text-[#9CA3AF]">{userName}</span>
                  ) : userId ? (
                    <span className="shrink-0 rounded-full bg-[#9CA3AF]/10 px-2 py-0.5 text-[0.625rem] text-[#9CA3AF] ring-1 ring-[#9CA3AF]/20">Removed User</span>
                  ) : null}

                  {/* Relative time */}
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{rel}</span>

                  {/* Expand chevron */}
                  <ChevronDown size={14} strokeWidth={2} className={`shrink-0 text-[#9CA3AF] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-t border-[#2A3544]/40 bg-[#0C1016]/60 px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Left: Who + What + Result */}
                      <div className="space-y-3">
                        {/* Result */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${
                              success
                                ? "bg-[#22C55E]/10 text-[#22C55E] ring-1 ring-[#22C55E]/20"
                                : "bg-[#DC2626]/10 text-[#DC2626] ring-1 ring-[#DC2626]/20"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${success ? "bg-[#22C55E]" : "bg-[#DC2626]"}`} />
                            {success ? "Success" : "Failed"}
                          </span>
                          {meta?.reason != null && (
                            <span className="text-[0.75rem] text-[#DC2626]">{String(meta.reason)}</span>
                          )}
                        </div>

                        {/* Who */}
                        <div>
                          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Actor</span>
                          <p className="mt-0.5 text-[0.8125rem] text-white">
                            {userName || (userId ? <span className="rounded-full bg-[#9CA3AF]/10 px-2 py-0.5 text-[0.6875rem] text-[#9CA3AF] ring-1 ring-[#9CA3AF]/20">Removed User</span> : "System")}
                          </p>
                        </div>

                        {/* What */}
                        <div>
                          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Action</span>
                          <p className="mt-0.5 text-[0.8125rem] text-white capitalize">{actionLabel(eventType)}</p>
                        </div>

                        {/* When */}
                        <div>
                          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Timestamp</span>
                          <p className="mt-0.5 text-[0.8125rem] tabular-nums text-white">{fullTime(log.created_at as string)}</p>
                        </div>
                      </div>

                      {/* Right: Metadata + Request ID */}
                      <div className="space-y-3">
                        {/* Metadata */}
                        {meta && Object.keys(meta).length > 0 && (
                          <div>
                            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Context</span>
                            <div className="mt-1.5 space-y-1">
                              {Object.entries(meta).map(([k, v]) => (
                                <div key={k} className="flex items-baseline gap-2">
                                  <span className="shrink-0 text-[0.6875rem] font-medium text-[#9CA3AF]">{k}</span>
                                  <span className="min-w-0 break-all text-[0.75rem] text-[#B8BFC8]">
                                    {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Request ID */}
                        {requestId && (
                          <div>
                            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Request ID</span>
                            <p
                              className="mt-0.5 cursor-pointer font-mono text-[0.6875rem] text-[#38BDF8] hover:underline"
                              title="Click to copy"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(requestId);
                              }}
                            >
                              {requestId}
                            </p>
                          </div>
                        )}

                        {/* Event ID */}
                        <div>
                          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Event ID</span>
                          <p className="mt-0.5 font-mono text-[0.6875rem] text-[#9CA3AF]">{id}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
