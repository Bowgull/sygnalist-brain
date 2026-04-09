"use client";

import { getDomainIcon } from "./log-icons";
import { getDomainStyle, domainFromEventType, actionLabel, relativeTime } from "./log-utils";

type Props = {
  log: Record<string, unknown>;
  isExpanded: boolean;
  onToggle: () => void;
  profileMap: Record<string, string>;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onLongPress?: () => void;
  onTicketClick?: (ticketId: string) => void;
};

export default function EventRow({ log, isExpanded, onToggle, profileMap, selectionMode, isSelected, onSelect, onLongPress, onTicketClick }: Props) {
  const eventType = (log.event_type as string) || "unknown";
  const meta = log.metadata as Record<string, unknown> | null;
  const success = log.success as boolean;
  const domain = domainFromEventType(eventType);
  const style = getDomainStyle(eventType);
  const DomainIcon = getDomainIcon(domain);
  const userId = log.user_id as string | null;
  const userName = userId ? profileMap[userId] : null;
  const rel = relativeTime(log.created_at as string);
  const failReason = !success && meta?.reason ? String(meta.reason) : null;
  const ticketId = log.ticket_id as string | null;
  const hasTicket = !!ticketId;

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  function handlePointerDown() {
    if (selectionMode || !onLongPress) return;
    longPressTimer = setTimeout(() => { onLongPress(); longPressTimer = null; }, 600);
  }
  function handlePointerUp() { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } }

  function handleClick() {
    if (selectionMode && onSelect) { onSelect(); return; }
    onToggle();
  }

  return (
    <div
      className={`cursor-pointer px-3 py-3 md:px-5 transition-colors hover:bg-[#222D3D]/20 ${
        hasTicket ? "border-l-2 border-l-[#F472B6]/40" : !success ? "border-l-2 border-l-[#DC2626]/40" : "border-l-2 border-l-transparent"
      } ${isSelected ? "bg-[#F472B6]/5" : ""}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Row: badge + action + meta */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Selection checkbox */}
        {selectionMode && (
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${isSelected ? "border-[#F472B6] bg-[#F472B6]" : "border-[#2A3544]"}`}>
            {isSelected && (
              <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>
            )}
          </span>
        )}

        {/* Status dot */}
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            success
              ? "bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.3)]"
              : "bg-[#DC2626] shadow-[0_0_6px_rgba(220,38,38,0.4)]"
          }`}
        />

        {/* Domain badge with icon */}
        <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${style.badge}`}>
          <DomainIcon className="h-3 w-3" />
          {style.label}
        </span>

        {/* Action text */}
        <span className="min-w-0 truncate text-[0.8125rem] font-medium capitalize text-white">
          {actionLabel(eventType)}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Ticket badge */}
        {hasTicket && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTicketClick?.(ticketId); }}
            className="shrink-0 rounded bg-[#F472B6]/10 px-1.5 py-0.5 text-[0.5625rem] font-semibold text-[#F472B6] ring-1 ring-[#F472B6]/20 hover:bg-[#F472B6]/20 transition-colors"
            title="View linked ticket"
          >
            Ticket
          </button>
        )}

        {/* Relative time */}
        <span className="shrink-0 text-[0.75rem] tabular-nums text-[#9CA3AF]">{rel}</span>

        {/* Expand chevron */}
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 shrink-0 text-[#9CA3AF] transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Secondary line: failure reason + actor */}
      {(failReason || userName || userId) && (
        <div className="mt-1 flex items-center gap-2 pl-[18px]">
          {failReason && (
            <span className="min-w-0 truncate text-[0.75rem] text-[#DC2626]">{failReason}</span>
          )}
          {!failReason && userName && (
            <span className="text-[0.75rem] text-[#9CA3AF]">{userName}</span>
          )}
          {!failReason && !userName && userId && (
            <span className="rounded-full bg-[#9CA3AF]/10 px-2 py-0.5 text-[0.625rem] text-[#9CA3AF] ring-1 ring-[#9CA3AF]/20">Removed User</span>
          )}
        </div>
      )}
    </div>
  );
}
