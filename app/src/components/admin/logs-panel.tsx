"use client";

import { useState, useEffect } from "react";

type LogType = "events" | "errors" | "fetches";

interface EventLog {
  id: string;
  event_type: string;
  user_id: string | null;
  metadata: unknown;
  created_at: string;
}

interface ErrorLog {
  id: string;
  severity: string;
  source_system: string;
  message: string;
  stack_trace: string | null;
  resolved: boolean;
  created_at: string;
}

interface FetchLog {
  id: string;
  source_name: string;
  search_term: string | null;
  jobs_returned: number;
  jobs_after_dedupe: number | null;
  success: boolean;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

const severityColor: Record<string, string> = {
  error: "border-[#DC2626] bg-[#DC2626]/10 text-[#DC2626]",
  warning: "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]",
  info: "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]",
  critical: "border-[#DC2626] bg-[#DC2626]/15 text-[#DC2626]",
};

export default function LogsPanel() {
  const [logType, setLogType] = useState<LogType>("fetches");
  const [logs, setLogs] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/logs?type=${logType}&limit=100`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setLogs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [logType]);

  async function resolveError(errorId: string) {
    const res = await fetch("/api/admin/logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error_id: errorId }),
    });
    if (res.ok) {
      setLogs((prev) =>
        (prev as ErrorLog[]).map((l) =>
          l.id === errorId ? { ...l, resolved: true } : l
        )
      );
    }
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <div>
      {/* Log type tabs */}
      <div className="sticky top-0 z-10 flex gap-1 border-b border-[#2A3544] bg-[#151C24] px-4 py-2.5">
        {(["fetches", "errors", "events"] as LogType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setLogType(t)}
            className={`rounded-full px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
              logType === t
                ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                : "text-[#9CA3AF] hover:text-[#B8BFC8]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg" />)}</div>
      ) : logs.length === 0 ? (
        <p className="py-10 text-center text-[0.8125rem] text-[#9CA3AF]">No {logType} found</p>
      ) : (
        <div className="divide-y divide-[#2A3544]/50">
          {logType === "fetches" && (logs as FetchLog[]).map((log) => (
            <div key={log.id} className="flex items-center gap-4 px-4 py-2.5 hover:bg-[#222D3D]/30 transition-colors">
              <span className={`h-2 w-2 shrink-0 rounded-full ${log.success ? "bg-[#6AD7A3]" : "bg-[#DC2626]"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[0.8125rem] font-medium text-white">{log.source_name}</span>
                  {log.search_term && (
                    <span className="truncate text-[0.75rem] text-[#9CA3AF]">&ldquo;{log.search_term}&rdquo;</span>
                  )}
                </div>
                <div className="flex gap-3 text-[0.6875rem] text-[#9CA3AF]">
                  <span>{log.jobs_returned} returned</span>
                  {log.jobs_after_dedupe != null && <span>{log.jobs_after_dedupe} deduped</span>}
                  {log.duration_ms != null && <span className="tabular-nums">{log.duration_ms}ms</span>}
                  {log.error_message && <span className="text-[#DC2626]">{log.error_message}</span>}
                </div>
              </div>
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{formatTime(log.created_at)}</span>
            </div>
          ))}

          {logType === "errors" && (logs as ErrorLog[]).map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#222D3D]/30 transition-colors">
              <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${
                severityColor[log.severity] ?? severityColor.error
              }`}>
                {log.severity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.8125rem] text-white">{log.message}</p>
                <div className="mt-0.5 flex gap-2 text-[0.6875rem] text-[#9CA3AF]">
                  <span>{log.source_system}</span>
                  <span className="tabular-nums">{formatTime(log.created_at)}</span>
                </div>
              </div>
              {!log.resolved && (
                <button
                  type="button"
                  onClick={() => resolveError(log.id)}
                  className="shrink-0 rounded px-2 py-1 text-[0.6875rem] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
                >
                  Resolve
                </button>
              )}
              {log.resolved && (
                <span className="shrink-0 text-[0.6875rem] text-[#6AD7A3]/50">Resolved</span>
              )}
            </div>
          ))}

          {logType === "events" && (logs as EventLog[]).map((log) => (
            <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#222D3D]/30 transition-colors">
              <span className="shrink-0 rounded border border-[#3B82F6]/25 bg-[#3B82F6]/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-[#3B82F6]">
                {log.event_type}
              </span>
              <span className="flex-1 truncate text-[0.8125rem] text-[#B8BFC8]">
                {typeof log.metadata === "object" && log.metadata ? JSON.stringify(log.metadata).slice(0, 120) : "—"}
              </span>
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{formatTime(log.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
