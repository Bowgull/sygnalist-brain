"use client";

import { useState, useEffect } from "react";

type LogType = "events" | "errors" | "fetches";

export default function AdminLogsPage() {
  const [logType, setLogType] = useState<LogType>("events");
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/logs?type=${logType}&limit=50`)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["events", "errors", "fetches"] as LogType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setLogType(t)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
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
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#171F28]" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[#9CA3AF]">No {logType} logs yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <LogRow key={log.id as string} log={log} logType={logType} onResolve={handleResolve} />
          ))}
        </div>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function LogRow({
  log,
  logType,
  onResolve,
}: {
  log: any;
  logType: LogType;
  onResolve: (id: string) => void;
}) {
  const time = new Date(log.created_at).toLocaleString();

  if (logType === "errors") {
    const severity = log.severity as string;
    const sevColor =
      severity === "critical"
        ? "text-[#DC2626]"
        : severity === "error"
          ? "text-[#F59E0B]"
          : severity === "warning"
            ? "text-[#FAD76A]"
            : "text-[#9CA3AF]";

    return (
      <div className="glass-card-flat p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold uppercase ${sevColor}`}>
                {severity}
              </span>
              <span className="text-[11px] text-[#9CA3AF]">{log.source_system}</span>
            </div>
            <p className="mt-1 text-[13px] text-[#B8BFC8]">{log.message}</p>
            <p className="mt-1 text-[11px] text-[#9CA3AF]">{time}</p>
          </div>
          {!log.resolved && (
            <button
              type="button"
              onClick={() => onResolve(log.id)}
              className="shrink-0 rounded-full border border-[#6AD7A3]/30 px-2.5 py-1 text-[11px] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
            >
              Resolve
            </button>
          )}
          {log.resolved && (
            <span className="shrink-0 rounded-full bg-[#6AD7A3]/10 px-2.5 py-1 text-[11px] text-[#6AD7A3]">
              Resolved
            </span>
          )}
        </div>
      </div>
    );
  }

  if (logType === "fetches") {
    return (
      <div className="glass-card-flat p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[13px] font-medium text-white">{log.source_name}</span>
            {log.search_term && (
              <span className="ml-2 text-[12px] text-[#9CA3AF]">&quot;{log.search_term}&quot;</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-[#B8BFC8]">{log.jobs_returned} jobs</span>
            {log.duration_ms && (
              <span className="text-[#9CA3AF]">{log.duration_ms}ms</span>
            )}
            <span className={log.success ? "text-[#6AD7A3]" : "text-[#DC2626]"}>
              {log.success ? "OK" : "Fail"}
            </span>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-[#9CA3AF]">{time}</p>
      </div>
    );
  }

  // User events
  return (
    <div className="glass-card-flat p-3">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[11px] font-medium text-[#6AD7A3]">
          {log.event_type}
        </span>
        <span className="text-[11px] text-[#9CA3AF]">{time}</span>
      </div>
      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <p className="mt-1 text-[12px] text-[#B8BFC8]">
          {JSON.stringify(log.metadata, null, 0).slice(0, 120)}
        </p>
      )}
    </div>
  );
}
