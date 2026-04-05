"use client";

import { useState } from "react";
import { ArrowDownIcon, CheckCircleIcon, XCircleIcon } from "./log-icons";
import { fullTime, formatDuration, relativeTime } from "./log-utils";

type FetchLog = Record<string, unknown>;

type Props = {
  batchId: string;
  logs: FetchLog[];
  profileMap: Record<string, string>;
};

export default function FetchBatchGroup({ batchId, logs, profileMap }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Find the summary row (source_name === "summary") or use the first log
  const summary = logs.find((l) => l.source_name === "summary") ?? logs[0];
  const sourceLogs = logs.filter((l) => l.source_name !== "summary");

  const profileId = summary.profile_id as string | null;
  const profileName = profileId ? profileMap[profileId] : null;
  const success = summary.success as boolean;
  const duration = formatDuration(summary.duration_ms as number);
  const rel = relativeTime(summary.created_at as string);

  const jobsReturned = summary.jobs_returned as number ?? 0;
  const jobsDedupe = summary.jobs_after_dedupe as number ?? 0;
  const jobsScored = summary.jobs_scored as number ?? 0;
  const jobsEnriched = summary.jobs_enriched as number ?? 0;
  const errorMessage = summary.error_message as string | null;

  return (
    <div>
      {/* Batch header row */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors hover:bg-[#222D3D]/20 md:flex-nowrap md:gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status dot */}
        <span className={`h-2 w-2 shrink-0 rounded-full ${success ? "bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.3)]" : "bg-[#DC2626] shadow-[0_0_6px_rgba(220,38,38,0.4)]"}`} />

        {/* Batch badge */}
        <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[#22C55E] bg-[#22C55E]/12 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-[#22C55E]">
          <ArrowDownIcon className="h-3 w-3" />
          Batch
        </span>

        {/* Profile name */}
        {profileName && (
          <span className="shrink-0 text-[0.75rem] font-medium text-white">{profileName}</span>
        )}

        {/* Pipeline numbers */}
        <div className="flex shrink-0 items-center gap-1 text-[0.6875rem] tabular-nums">
          <span className="font-semibold text-white">{jobsReturned}</span>
          <span className="text-[#9CA3AF]">&rarr;</span>
          <span className="text-[#B8BFC8]">{jobsDedupe}</span>
          <span className="text-[#9CA3AF]">&rarr;</span>
          <span className="text-[#B8BFC8]">{jobsScored}</span>
          <span className="text-[#9CA3AF]">&rarr;</span>
          <span className="font-semibold text-[#6AD7A3]">{jobsEnriched}</span>
        </div>

        {/* Duration */}
        {duration && (
          <span className="shrink-0 rounded bg-[#6AD7A3]/10 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-[#6AD7A3]">
            {duration}
          </span>
        )}

        {/* Sources count */}
        {sourceLogs.length > 0 && (
          <span className="shrink-0 text-[0.6875rem] text-[#9CA3AF]">{sourceLogs.length} sources</span>
        )}

        {/* Time */}
        <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF] md:ml-auto">{rel}</span>

        {/* Chevron */}
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 shrink-0 text-[#9CA3AF] transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded: per-source rows + details */}
      {expanded && (
        <div className="border-t border-[#2A3544]/40 bg-[#0C1016]/60 px-4 py-3 space-y-2">
          {/* Error message if present */}
          {errorMessage && (
            <div className="rounded-lg border border-[#DC2626]/20 bg-[#DC2626]/5 px-3 py-2">
              <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#DC2626]">Error</span>
              <p className="mt-0.5 text-[0.75rem] text-[#DC2626]">{errorMessage}</p>
            </div>
          )}

          {/* Batch details */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Batch ID</span>
                <span className="font-mono text-[0.6875rem] text-[#B8BFC8]">{batchId}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Timestamp</span>
                <span className="text-[0.6875rem] tabular-nums text-[#B8BFC8]">{fullTime(summary.created_at as string)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Pipeline</span>
                <span className="text-[0.6875rem] tabular-nums text-[#B8BFC8]">
                  {jobsReturned} fetched &rarr; {jobsDedupe} deduped &rarr; {jobsScored} scored &rarr; {jobsEnriched} enriched
                </span>
              </div>
            </div>
          </div>

          {/* Per-source rows */}
          {sourceLogs.length > 0 && (
            <div>
              <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[#9CA3AF]">Sources</span>
              <div className="mt-1.5 space-y-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#171F28] p-2">
                {sourceLogs.map((src) => {
                  const srcSuccess = src.success as boolean;
                  const srcError = src.error_message as string | null;
                  return (
                    <div key={src.id as string} className="flex flex-wrap items-center gap-2 py-1">
                      {srcSuccess ? (
                        <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-[#22C55E]" />
                      ) : (
                        <XCircleIcon className="h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
                      )}
                      <span className="shrink-0 rounded border border-[#22C55E]/30 bg-[#22C55E]/10 px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase text-[#22C55E]">
                        {src.source_name as string}
                      </span>
                      {src.search_term != null && (
                        <span className="text-[0.6875rem] text-[#9CA3AF] truncate">&ldquo;{String(src.search_term)}&rdquo;</span>
                      )}
                      <span className="text-[0.6875rem] font-semibold tabular-nums text-white">{src.jobs_returned as number} jobs</span>
                      {(src.duration_ms as number) > 0 && (
                        <span className="text-[0.625rem] tabular-nums text-[#6AD7A3]">{formatDuration(src.duration_ms as number)}</span>
                      )}
                      {srcError && (
                        <span className="w-full text-[0.6875rem] text-[#DC2626] pl-6">{String(srcError)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
