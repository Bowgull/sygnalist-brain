"use client";

import { useState, useEffect, type ReactNode } from "react";
import { CheckCircleIcon, XCircleIcon, getSeverityIcon } from "./log-icons";
import { getDomainStyle, actionLabel, fullTime, getSeverityStyle } from "./log-utils";

type Props = {
  log: Record<string, unknown>;
  profileMap: Record<string, string>;
  onTraceRequest: (requestId: string) => void;
};

export default function EventDetail({ log, profileMap, onTraceRequest }: Props) {
  const eventType = (log.event_type as string) || "unknown";
  const meta = (log.metadata ?? null) as Record<string, string | number | boolean | null> | null;
  const success = log.success as boolean;
  const userId = log.user_id as string | null;
  const userName = userId ? profileMap[userId] : null;
  const requestId = log.request_id as string | null;
  const id = log.id as string;

  // Fetch linked error if this is a failed event with a request_id
  const [linkedError, setLinkedError] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!requestId || success) return;
    fetch(`/api/admin/logs?type=errors&limit=5`)
      .then((r) => r.json())
      .then((data) => {
        const logs = data.logs ?? data;
        if (Array.isArray(logs)) {
          const match = logs.find((e: Record<string, unknown>) => e.request_id === requestId);
          if (match) setLinkedError(match);
        }
      })
      .catch(() => {});
  }, [requestId, success]);

  return (
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
              {success ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
              {success ? "Success" : "Failed"}
            </span>
            {meta?.reason != null && (
              <span className="text-[0.75rem] text-[#DC2626]">{String(meta.reason)}</span>
            )}
          </div>

          {/* Actor */}
          <div>
            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Actor</span>
            <p className="mt-0.5 text-[0.8125rem] text-white">
              {userName != null ? String(userName) : userId != null ? <span className="rounded-full bg-[#9CA3AF]/10 px-2 py-0.5 text-[0.6875rem] text-[#9CA3AF] ring-1 ring-[#9CA3AF]/20">Removed User</span> : "System"}
            </p>
          </div>

          {/* Action */}
          <div>
            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Action</span>
            <p className="mt-0.5 text-[0.8125rem] text-white capitalize">{actionLabel(eventType)}</p>
          </div>

          {/* Stage */}
          {meta?.stage && (
            <div>
              <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Stage</span>
              <p className="mt-0.5 text-[0.8125rem] text-white capitalize">{String(meta.stage).replace(/_/g, " ")}</p>
            </div>
          )}

          {/* Timestamp */}
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
                title="Click to trace all logs for this request"
                onClick={(e) => {
                  e.stopPropagation();
                  onTraceRequest(requestId);
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

      {/* Linked error */}
      {linkedError && (
        <div className="mt-4 rounded-lg border border-[#DC2626]/20 bg-[#DC2626]/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#DC2626]">Linked Error</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {(() => {
              const severity = linkedError.severity as string;
              const SevIcon = getSeverityIcon(severity);
              const sevStyle = getSeverityStyle(severity);
              return (
                <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${sevStyle.badge}`}>
                  <SevIcon className="h-3 w-3" />
                  {severity}
                </span>
              );
            })()}
            <span className="min-w-0 truncate text-[0.75rem] text-[#B8BFC8]">{linkedError.message as string}</span>
          </div>
        </div>
      )}
    </div>
  );
}
