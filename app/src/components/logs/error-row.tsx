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
      {/* Row 1: severity badge + source + time + chevron */}
      <div className="flex items-center gap-2 md:gap-3">
        <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${sevStyle.badge}`}>
          <SevIcon className="h-3 w-3" />
          {severity}
        </span>
        <span className="min-w-0 truncate text-[0.75rem] md:text-[0.8125rem] font-medium text-[#B8BFC8]">{source}</span>
        <span className="flex-1" />
        <span className="shrink-0 text-[0.75rem] tabular-nums text-[#9CA3AF]">{rel}</span>
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

      {/* Row 2: message — full width, wraps naturally */}
      <p className="mt-1 text-[0.8125rem] text-white line-clamp-2 md:line-clamp-1">{message}</p>

      {/* Row 3: status pill + batch context */}
      <div className="mt-1.5 flex items-center gap-2">
        {resolved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#6AD7A3]/25 bg-[#6AD7A3]/10 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-[#6AD7A3]">
            <StatusIcon className="h-3 w-3" />
            Resolved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F59E0B]/25 bg-[#F59E0B]/10 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-[#F59E0B]">
            <StatusIcon className="h-3 w-3" />
            Open
          </span>
        )}
        {batchContext && (
          <span className="text-[0.6875rem] text-[#9CA3AF]">
            {batchContext.profileName} &middot; {shortBatchId(batchContext.batchId)}
          </span>
        )}
      </div>
    </div>
  );
}
