"use client";

import { useState, useEffect } from "react";
import { CheckCircleIcon, getSeverityIcon, getDomainIcon } from "./log-icons";
import { getSeverityStyle, fullTime, relativeTime, domainFromEventType, getDomainStyle, actionLabel } from "./log-utils";

type Props = {
  log: Record<string, unknown>;
  profileMap: Record<string, string>;
  onTraceRequest: (requestId: string) => void;
  onResolve: (errorId: string, note?: string) => void;
};

export default function ErrorDetail({ log, profileMap, onTraceRequest, onResolve }: Props) {
  const id = log.id as string;
  const severity = log.severity as string;
  const message = log.message as string;
  const stackTrace = log.stack_trace as string | null;
  const meta = log.metadata as Record<string, unknown> | null;
  const requestId = log.request_id as string | null;
  const userId = log.user_id as string | null;
  const userName = userId ? profileMap[userId] : null;
  const resolved = log.resolved as boolean;
  const resolvedAt = log.resolved_at as string | null;
  const resolvedBy = log.resolved_by as string | null;
  const resolverName = resolvedBy ? profileMap[resolvedBy] : null;
  const resolveNote = meta?.resolve_note as string | null;

  const [showStack, setShowStack] = useState(false);
  const [showResolveInput, setShowResolveInput] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Fetch related events
  const [relatedEvents, setRelatedEvents] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    if (!requestId) return;
    fetch(`/api/admin/logs?request_id=${requestId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRelatedEvents(data.filter((e) => e._type === "event"));
        }
      })
      .catch(() => {});
  }, [requestId]);

  return (
    <div className="border-t border-[#2A3544]/40 px-5 py-4">
      <div className="ml-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0C1016]/80 p-4">
      {/* Summary line */}
      {meta?.cause != null && (
        <p className="mb-3 text-[0.8125rem] text-[#F59E0B]">
          {String(meta.cause)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Left: Message + Stack + Metadata */}
        <div className="space-y-3">
          {/* Full message */}
          <div>
            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Message</span>
            <p className="mt-0.5 text-[0.8125rem] text-white">{message}</p>
          </div>

          {/* Stack trace */}
          {stackTrace && (
            <div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowStack(!showStack); }}
                className="text-[0.6875rem] text-[#38BDF8] hover:underline"
              >
                {showStack ? "Hide stack trace" : "Show stack trace"}
              </button>
              {showStack && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-[#0C1016] p-2 text-[0.6875rem] text-[#9CA3AF]">
                  {stackTrace}
                </pre>
              )}
            </div>
          )}

          {/* Affected user */}
          {userId && (
            <div>
              <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Affected User</span>
              <p className="mt-0.5 text-[0.8125rem] text-white">
                {userName ?? <span className="rounded-full bg-[#9CA3AF]/10 px-2 py-0.5 text-[0.6875rem] text-[#9CA3AF] ring-1 ring-[#9CA3AF]/20">Removed User</span>}
              </p>
            </div>
          )}

          {/* Timestamp */}
          <div>
            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Timestamp</span>
            <p className="mt-0.5 text-[0.8125rem] tabular-nums text-white">{fullTime(log.created_at as string)}</p>
          </div>
        </div>

        {/* Right: Context + IDs */}
        <div className="space-y-3">
          {/* Metadata (excluding internal keys) */}
          {meta && Object.keys(meta).filter((k) => k !== "resolve_note").length > 0 && (
            <div>
              <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Context</span>
              <div className="mt-1.5 space-y-1">
                {Object.entries(meta)
                  .filter(([k]) => k !== "resolve_note")
                  .map(([k, v]) => (
                    <div key={k} className="flex items-baseline gap-2">
                      <span className="shrink-0 text-[0.6875rem] font-medium text-[#9CA3AF]">{k}</span>
                      <span className="min-w-0 break-all text-[0.75rem] text-[#B8BFC8]">
                        {typeof v === "object" ? JSON.stringify(v) : String(v ?? "-")}
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
                onClick={(e) => { e.stopPropagation(); onTraceRequest(requestId); }}
              >
                {requestId}
              </p>
            </div>
          )}

          {/* Error ID */}
          <div>
            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Error ID</span>
            <p className="mt-0.5 font-mono text-[0.6875rem] text-[#9CA3AF]">{id}</p>
          </div>
        </div>
      </div>

      {/* Related events timeline */}
      {relatedEvents.length > 0 && (
        <div className="mt-4">
          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Related Events</span>
          <div className="mt-2 space-y-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#171F28] p-2">
            {relatedEvents.map((evt) => {
              const et = (evt.event_type as string) || "";
              const d = domainFromEventType(et);
              const ds = getDomainStyle(et);
              const DIcon = getDomainIcon(d);
              return (
                <div key={evt.id as string} className="flex items-center gap-2 py-1">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${(evt.success as boolean) ? "bg-[#22C55E]" : "bg-[#DC2626]"}`} />
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase ${ds.badge}`}>
                    <DIcon className="h-2.5 w-2.5" />
                    {ds.label}
                  </span>
                  <span className="text-[0.6875rem] capitalize text-[#B8BFC8]">{actionLabel(et)}</span>
                  <span className="ml-auto text-[0.625rem] tabular-nums text-[#9CA3AF]">{relativeTime(evt.created_at as string)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolve action */}
      <div className="mt-4 flex items-center gap-3">
        {resolved ? (
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-[#6AD7A3]/60" />
            <span className="text-[0.75rem] text-[#6AD7A3]/60">
              Resolved {resolvedAt ? fullTime(resolvedAt) : ""}{resolverName ? ` by ${resolverName}` : ""}
            </span>
            {resolveNote && (
              <span className="ml-2 text-[0.75rem] text-[#9CA3AF]">&mdash; {resolveNote}</span>
            )}
          </div>
        ) : showResolveInput ? (
          <div className="flex flex-1 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="Optional note (what you did to fix it)"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[0.75rem] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]"
              onKeyDown={(e) => { if (e.key === "Enter") onResolve(id, noteText || undefined); }}
            />
            <button
              type="button"
              onClick={() => onResolve(id, noteText || undefined)}
              className="shrink-0 rounded-full bg-[#6AD7A3]/15 px-3 py-2 text-[0.6875rem] font-semibold text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30 hover:bg-[#6AD7A3]/25"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => { setShowResolveInput(false); setNoteText(""); }}
              className="shrink-0 text-[0.6875rem] text-[#9CA3AF] hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowResolveInput(true); }}
            className="rounded-full border border-[#6AD7A3]/30 px-3 py-2 text-[0.6875rem] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
          >
            Resolve
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
