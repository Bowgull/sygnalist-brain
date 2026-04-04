"use client";

import { useState, useEffect } from "react";

type LogType = "fetches" | "errors" | "events";

const badgeStyles: Record<string, string> = {
  // Severity badges
  critical: "border-[#DC2626] bg-[#DC2626]/15 text-[#DC2626]",
  error: "border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]",
  warning: "border-[#FAD76A] bg-[#FAD76A]/15 text-[#FAD76A]",
  info: "border-[#9CA3AF] bg-[#9CA3AF]/10 text-[#9CA3AF]",
  // Event type badges
  fetch: "border-[#22C55E] bg-[#22C55E]/15 text-[#22C55E]",
  promote: "border-[#F59E0B] bg-[#F59E0B]/12 text-[#F59E0B]",
  dismiss: "border-[#9CA3AF] bg-[#9CA3AF]/10 text-[#9CA3AF]",
  gmail_ingest: "border-[#14B8A6] bg-[#14B8A6]/15 text-[#14B8A6]",
  admin: "border-[#A855F7] bg-[#A855F7]/15 text-[#A855F7]",
  login: "border-[#3B82F6] bg-[#3B82F6]/12 text-[#3B82F6]",
};

function getBadgeStyle(type: string, severity?: string): string {
  if (severity && badgeStyles[severity]) return badgeStyles[severity];
  const lower = (type || "").toLowerCase();
  for (const [key, style] of Object.entries(badgeStyles)) {
    if (lower.includes(key)) return style;
  }
  return badgeStyles.info;
}

export default function AdminLogsPage() {
  const [logType, setLogType] = useState<LogType>("fetches");
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setExpandedId(null);
    fetch(`/api/admin/logs?type=${logType}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [logType]);

  async function handleResolve(errorId: string) {
    const res = await fetch("/api/admin/logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error_id: errorId }),
    });
    if (res.ok) {
      setLogs((prev) =>
        prev.map((l) => (l.id === errorId ? { ...l, resolved: true } : l))
      );
    }
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function formatDuration(ms: number | null | undefined): string {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="space-y-4">
      {/* Type tabs */}
      <div className="flex items-center gap-2">
        {(["fetches", "errors", "events"] as LogType[]).map((t) => (
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
            const time = formatTime(log.created_at as string);
            const isExpanded = expandedId === id;

            if (logType === "fetches") {
              const success = log.success as boolean;
              const duration = formatDuration(log.duration_ms as number);
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#222D3D]/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : id)}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${success ? "bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.4)]" : "bg-[#DC2626] shadow-[0_0_6px_rgba(220,38,38,0.4)]"}`} />
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${getBadgeStyle("fetch")}`}>
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

            if (logType === "errors") {
              const severity = log.severity as string;
              return (
                <div key={id} className="px-4 py-3 hover:bg-[#222D3D]/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${getBadgeStyle("", severity)}`}>
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
                      <button
                        type="button"
                        onClick={() => handleResolve(id)}
                        className="shrink-0 rounded-full border border-[#6AD7A3]/30 px-2.5 py-1 text-[0.6875rem] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="shrink-0 text-[0.6875rem] text-[#6AD7A3]/50">Resolved</span>
                    )}
                  </div>
                </div>
              );
            }

            // Events
            const eventType = (log.event_type as string) || "unknown";
            const meta = log.metadata as Record<string, unknown> | null;
            return (
              <div
                key={id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#222D3D]/20 transition-colors cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : id)}
              >
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${getBadgeStyle(eventType)}`}>
                  {eventType}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-[#B8BFC8]">
                  {meta && Object.keys(meta).length > 0
                    ? Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(" · ").slice(0, 100)
                    : "—"}
                </span>
                <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{time}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
