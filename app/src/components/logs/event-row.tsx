"use client";

import { getDomainIcon } from "./log-icons";
import { getDomainStyle, domainFromEventType, actionLabel, formatMetaPreview, relativeTime } from "./log-utils";

type Props = {
  log: Record<string, unknown>;
  isExpanded: boolean;
  onToggle: () => void;
  profileMap: Record<string, string>;
};

export default function EventRow({ log, isExpanded, onToggle, profileMap }: Props) {
  const eventType = (log.event_type as string) || "unknown";
  const meta = log.metadata as Record<string, unknown> | null;
  const success = log.success as boolean;
  const domain = domainFromEventType(eventType);
  const style = getDomainStyle(eventType);
  const DomainIcon = getDomainIcon(domain);
  const userId = log.user_id as string | null;
  const userName = userId ? profileMap[userId] : null;
  const rel = relativeTime(log.created_at as string);
  const previews = formatMetaPreview(meta);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors hover:bg-[#222D3D]/20 md:flex-nowrap md:gap-3 ${
        !success ? "border-l-2 border-l-[#DC2626]/60" : "border-l-2 border-l-transparent"
      }`}
      onClick={onToggle}
    >
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
      <span className="shrink-0 text-[0.75rem] font-medium capitalize text-white">
        {actionLabel(eventType)}
      </span>

      {/* Metadata preview (up to 3 items) */}
      <span className="min-w-0 flex-1 truncate text-[0.75rem] text-[#9CA3AF]">
        {previews.length > 0 ? previews.join(" · ") : ""}
      </span>

      {/* Actor */}
      {userName ? (
        <span className="shrink-0 text-[0.6875rem] text-[#9CA3AF]">{userName}</span>
      ) : userId ? (
        <span className="shrink-0 rounded-full bg-[#9CA3AF]/10 px-2 py-0.5 text-[0.625rem] text-[#9CA3AF] ring-1 ring-[#9CA3AF]/20">Removed User</span>
      ) : null}

      {/* Relative time */}
      <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{rel}</span>

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
  );
}
