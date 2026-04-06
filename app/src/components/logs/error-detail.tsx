"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircleIcon, getSeverityIcon, getDomainIcon } from "./log-icons";
import { getSeverityStyle, fullTime, relativeTime, domainFromEventType, getDomainStyle, actionLabel } from "./log-utils";

type Props = {
  log: Record<string, unknown>;
  profileMap: Record<string, string>;
  onTraceRequest: (requestId: string) => void;
  onResolve: (errorId: string, note?: string) => void;
};

/** Resolve icon — shield with checkmark, Sygnalist-style */
function ResolveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .5-.87l7-4a1 1 0 0 1 1 0l7 4A1 1 0 0 1 20 6z" />
      <polyline points="9 12 11.5 14.5 15.5 9.5" />
    </svg>
  );
}

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
  const [copiedTrace, setCopiedTrace] = useState(false);
  const [showResolveInput, setShowResolveInput] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Draggable stack trace — resizes both height and width
  const [traceHeight, setTraceHeight] = useState(160);
  const [traceWidth, setTraceWidth] = useState<number | null>(null);
  const traceContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const containerW = traceContainerRef.current?.offsetWidth ?? 400;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW: traceWidth ?? containerW, startH: traceHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = ev.clientY - dragRef.current.startY;
      const dx = ev.clientX - dragRef.current.startX;
      setTraceHeight(Math.max(80, Math.min(1200, dragRef.current.startH + dy)));
      setTraceWidth(Math.max(280, dragRef.current.startW + dx));
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [traceHeight, traceWidth]);

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
    <div className="border-t border-[#2A3544]/40 px-3 py-3 md:px-5 md:py-4">
      <div className="ml-0 md:ml-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0C1016]/80 p-3 md:p-4">
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

          {/* Stack trace — soft green, word-wrapped on mobile, draggable resize on desktop */}
          {stackTrace && (
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowStack(!showStack); }}
                  className="text-[0.6875rem] text-[#38BDF8] hover:underline"
                >
                  {showStack ? "Hide stack trace" : "Show stack trace"}
                </button>
                {showStack && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(stackTrace).then(() => {
                        setCopiedTrace(true);
                        setTimeout(() => setCopiedTrace(false), 1500);
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[0.6875rem] text-[#38BDF8] hover:underline"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    {copiedTrace ? "Copied!" : "Copy trace"}
                  </button>
                )}
              </div>
              {showStack && (
                <div ref={traceContainerRef} className="mt-2 relative" style={{ width: traceWidth ?? "100%" }}>
                  <pre
                    className="overflow-y-auto whitespace-pre-wrap break-all md:whitespace-pre md:break-normal md:overflow-auto rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0C1016] p-3 font-mono text-[0.6875rem] leading-relaxed text-[#6AD7A3]/70 max-h-[400px] md:max-h-none"
                    style={{ minHeight: 120 }}
                  >
                    {stackTrace}
                  </pre>
                  {/* Corner resize handle — desktop only */}
                  <div
                    className="hidden md:flex absolute bottom-0 right-0 h-6 w-6 cursor-nwse-resize items-end justify-end rounded-br-lg p-1 hover:bg-[rgba(255,255,255,0.06)]"
                    onMouseDown={handleDragStart}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" className="text-[#9CA3AF]/40">
                      <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M9 5v4H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
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

      {/* ── Resolve section ── */}
      <div className="mt-5">
        {resolved ? (
          <div className="space-y-3">
            {/* Status banner */}
            <div className="flex items-center gap-3 rounded-lg border border-[#6AD7A3]/20 bg-gradient-to-r from-[#6AD7A3]/10 to-[#6AD7A3]/5 px-4 py-3">
              <CheckCircleIcon className="h-5 w-5 shrink-0 text-[#6AD7A3]" />
              <div className="flex-1 min-w-0">
                <span className="text-[0.875rem] font-bold text-[#6AD7A3]">Resolved</span>
                {resolverName && <span className="ml-2 text-[0.8125rem] text-[#B8BFC8]">by {resolverName}</span>}
              </div>
              {/* Time-to-fix badge */}
              {resolvedAt && (() => {
                const diffMs = new Date(resolvedAt).getTime() - new Date(log.created_at as string).getTime();
                const mins = Math.floor(diffMs / 60000);
                let label = "";
                let color = "text-[#6AD7A3] border-[#6AD7A3]/20 bg-[#6AD7A3]/10";
                if (mins < 1) label = "<1m";
                else if (mins < 60) label = `${mins}m`;
                else {
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) label = `${hrs}h ${mins % 60}m`;
                  else {
                    const days = Math.floor(hrs / 24);
                    label = `${days}d ${hrs % 24}h`;
                    color = "text-[#F59E0B] border-[#F59E0B]/20 bg-[#F59E0B]/10";
                  }
                }
                return (
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums ${color}`}>
                    Fixed in {label}
                  </span>
                );
              })()}
            </div>

            {/* Resolve note — boxed, prominent */}
            {resolveNote && (
              <div className="rounded-lg border border-[#6AD7A3]/15 bg-[#0C1016] p-3 md:p-4">
                <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#6AD7A3]">Resolution Note</span>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-[#B8BFC8]">{resolveNote}</p>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] tabular-nums text-[#9CA3AF]">
              <span>Occurred: {fullTime(log.created_at as string)}</span>
              {resolvedAt && <span>Resolved: {fullTime(resolvedAt)}</span>}
            </div>
          </div>
        ) : showResolveInput ? (
          <div className="flex w-full items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="What was done to resolve this..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-[0.8125rem] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3] transition-colors"
              onKeyDown={(e) => { if (e.key === "Enter") onResolve(id, noteText || undefined); }}
            />
            <button
              type="button"
              onClick={() => onResolve(id, noteText || undefined)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#6AD7A3]/15 px-4 py-2.5 text-[0.8125rem] font-semibold text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30 hover:bg-[#6AD7A3]/25 transition-colors"
            >
              <ResolveIcon className="h-4 w-4" />
              Confirm
            </button>
            <button
              type="button"
              onClick={() => { setShowResolveInput(false); setNoteText(""); }}
              className="shrink-0 text-[0.75rem] text-[#9CA3AF] hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowResolveInput(true); }}
            className="inline-flex items-center gap-2 rounded-full bg-[#6AD7A3]/10 px-5 py-2.5 text-[0.8125rem] font-semibold text-[#6AD7A3] ring-1 ring-[#6AD7A3]/25 hover:bg-[#6AD7A3]/20 hover:ring-[#6AD7A3]/40 transition-all"
          >
            <ResolveIcon className="h-5 w-5" />
            Resolve
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
