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
  const [fullScreenTrace, setFullScreenTrace] = useState(false);
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

          {/* Stack trace — soft green, draggable resize (desktop) / full-screen (mobile) */}
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
                    onClick={(e) => { e.stopPropagation(); setFullScreenTrace(true); }}
                    className="md:hidden text-[0.6875rem] text-[#9CA3AF] hover:text-white"
                  >
                    Full screen
                  </button>
                )}
              </div>
              {showStack && (
                <div ref={traceContainerRef} className="mt-2 relative" style={{ width: traceWidth ?? "100%" }}>
                  <pre
                    className="overflow-auto rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0C1016] p-3 font-mono text-[0.75rem] md:text-[0.6875rem] leading-relaxed text-[#6AD7A3]/70"
                    style={{ height: traceHeight }}
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

              {/* Full-screen trace overlay (mobile) */}
              {fullScreenTrace && (
                <div className="fixed inset-0 z-50 flex flex-col bg-[#0C1016]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between border-b border-[#2A3544] px-4 py-3">
                    <span className="text-[0.8125rem] font-semibold text-white">Stack Trace</span>
                    <button
                      type="button"
                      onClick={() => setFullScreenTrace(false)}
                      className="rounded-lg p-2 text-[#9CA3AF] hover:bg-[#222D3D] hover:text-white"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <pre className="flex-1 overflow-auto p-4 font-mono text-[0.75rem] leading-relaxed text-[#6AD7A3]/70">
                    {stackTrace}
                  </pre>
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

      {/* ── Resolve action — right-aligned, prominent ── */}
      <div className="mt-5 flex items-center justify-end gap-3">
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
