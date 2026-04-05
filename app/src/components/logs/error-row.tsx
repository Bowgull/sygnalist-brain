"use client";

import { getSeverityIcon, getStatusIcon } from "./log-icons";
import { getSeverityStyle, relativeTime, shortBatchId } from "./log-utils";

type Props = {
  log: Record<string, unknown>;
  isExpanded: boolean;
  onToggle: () => void;
  batchContext?: { profileName: string; batchId: string } | null;
};

export default function ErrorRow({ log, isExpanded, onToggle, batchContext }: Props) {
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
      className={`cursor-pointer px-3 py-3 md:px-5 md:py-4 transition-colors hover:bg-[#222D3D]/20 ${sevStyle.row}`}
      onClick={onToggle}
    >
      {/* Line 1: severity, source, time, chevron */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Severity badge with icon */}
        <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${sevStyle.badge}`}>
          <SevIcon className="h-3 w-3" />
          {severity}
        </span>

        {/* Source system */}
        <span className="shrink-0 text-[0.8125rem] font-medium text-[#B8BFC8]">{source}</span>

        {/* Message — 2-line clamp on mobile, single truncate on desktop */}
        <span className="min-w-0 flex-1 text-[0.8125rem] text-white line-clamp-2 md:line-clamp-1">{message}</span>

        {/* Time */}
        <span className="shrink-0 text-[0.75rem] tabular-nums text-[#9CA3AF]">{rel}</span>

        {/* Expand chevron */}
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Line 2: batch context + status */}
      <div className="mt-1.5 flex items-center gap-2 md:gap-3 pl-0 md:pl-[calc(0.625rem+1rem+0.625rem)]">
        {batchContext && (
          <span className="text-[0.75rem] text-[#9CA3AF]">
            Batch: {batchContext.profileName} &middot; {shortBatchId(batchContext.batchId)}
          </span>
        )}

        {/* Resolved status */}
        <span className={`inline-flex items-center gap-1 text-[0.75rem] font-semibold ${resolved ? "text-[#6AD7A3]/50" : "text-[#F59E0B]"}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {resolved ? "Resolved" : "Open"}
        </span>
      </div>
    </div>
  );
}
