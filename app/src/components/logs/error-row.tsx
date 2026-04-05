"use client";

import { getSeverityIcon, getStatusIcon } from "./log-icons";
import { getSeverityStyle, relativeTime } from "./log-utils";

type Props = {
  log: Record<string, unknown>;
  isExpanded: boolean;
  onToggle: () => void;
};

export default function ErrorRow({ log, isExpanded, onToggle }: Props) {
  const severity = log.severity as string;
  const source = log.source_system as string;
  const message = log.message as string;
  const resolved = log.resolved as boolean;
  const rel = relativeTime(log.created_at as string);

  const sevStyle = getSeverityStyle(severity);
  const SevIcon = getSeverityIcon(severity);
  const StatusIcon = getStatusIcon(resolved ? "resolved" : "unresolved");

  return (
    <div
      className={`flex flex-wrap items-center gap-2 px-4 py-3 cursor-pointer transition-colors hover:bg-[#222D3D]/20 md:flex-nowrap md:gap-3 ${sevStyle.row}`}
      onClick={onToggle}
    >
      {/* Severity badge with icon */}
      <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${sevStyle.badge}`}>
        <SevIcon className="h-3 w-3" />
        {severity}
      </span>

      {/* Source system */}
      <span className="shrink-0 text-[0.75rem] font-medium text-[#B8BFC8]">{source}</span>

      {/* Message (truncated) */}
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-white">{message}</span>

      {/* Time */}
      <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{rel}</span>

      {/* Resolved status */}
      <span className={`inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-medium ${resolved ? "text-[#6AD7A3]/50" : "text-[#9CA3AF]"}`}>
        <StatusIcon className="h-3.5 w-3.5" />
        {resolved ? "Resolved" : "Open"}
      </span>

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
