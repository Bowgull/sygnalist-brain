"use client";

import { useState } from "react";
import { CheckCircleIcon, XCircleIcon, TriangleAlertIcon } from "./log-icons";
import { fullTime, formatDuration, relativeTime, deriveBatchStatus, getBatchStatusStyle, getWarningText } from "./log-utils";

type FetchLog = Record<string, unknown>;

type Props = {
  batchId: string;
  logs: FetchLog[];
  profileMap: Record<string, string>;
  isInitiallyExpanded?: boolean;
};

export default function FetchBatchGroup({ batchId, logs, profileMap, isInitiallyExpanded }: Props) {
  const [expanded, setExpanded] = useState(isInitiallyExpanded ?? false);

  // Find the summary row (source_name === "summary") or use the first log
  const summary = logs.find((l) => l.source_name === "summary") ?? logs[0];
  const sourceLogs = logs.filter((l) => l.source_name !== "summary");

  const profileId = summary.profile_id as string | null;
  const profileName = profileId ? profileMap[profileId] : null;
  const duration = formatDuration(summary.duration_ms as number);
  const rel = relativeTime(summary.created_at as string);

  const jobsReturned = summary.jobs_returned as number ?? 0;
  const jobsDedupe = summary.jobs_after_dedupe as number ?? 0;
  const jobsScored = summary.jobs_scored as number ?? 0;
  const jobsEnriched = summary.jobs_enriched as number ?? 0;
  const errorMessage = summary.error_message as string | null;

  // Derive batch status from source rows
  const status = deriveBatchStatus(sourceLogs);
  const statusStyle = getBatchStatusStyle(status);
  const warningText = getWarningText(sourceLogs);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] overflow-hidden">
      {/* Collapsed card header */}
      <div
        className="cursor-pointer px-5 py-4 transition-colors hover:bg-[#222D3D]/20"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Line 1: Status + profile + time */}
        <div className="flex items-center gap-3">
          {/* Status label */}
          <span className={`text-[0.8125rem] font-bold tracking-wide ${statusStyle.text}`}>
            {statusStyle.label}
          </span>

          {/* Profile name */}
          {profileName && (
            <span className="text-[0.8125rem] font-medium text-white">{profileName}</span>
          )}

          <span className="flex-1" />

          {/* Relative time */}
          <span className="shrink-0 text-[0.75rem] tabular-nums text-[#9CA3AF]">{rel}</span>

          {/* Chevron */}
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Line 2: Pipeline funnel */}
        <div className="mt-2 flex items-center gap-1.5 text-[0.8125rem] tabular-nums">
          <span className="font-semibold text-white">{jobsReturned}</span>
          <span className="text-[0.6875rem] text-[#9CA3AF]">fetched</span>
          <span className="text-[#9CA3AF]">&rarr;</span>
          <span className="text-[#B8BFC8]">{jobsDedupe}</span>
          <span className="text-[0.6875rem] text-[#9CA3AF]">deduped</span>
          <span className="text-[#9CA3AF]">&rarr;</span>
          <span className="text-[#B8BFC8]">{jobsScored}</span>
          <span className="text-[0.6875rem] text-[#9CA3AF]">scored</span>
          <span className="text-[#9CA3AF]">&rarr;</span>
          <span className="font-semibold text-[#6AD7A3]">{jobsEnriched}</span>
          <span className="text-[0.6875rem] text-[#9CA3AF]">enriched</span>
        </div>

        {/* Line 3: Sources + duration + warnings/error */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[0.75rem]">
          {sourceLogs.length > 0 && (
            <span className="text-[#9CA3AF]">{sourceLogs.length} sources</span>
          )}

          {duration && (
            <span className="rounded bg-[#6AD7A3]/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-[#6AD7A3]">
              {duration}
            </span>
          )}

          {/* Warning text */}
          {status === "warning" && warningText && (
            <span className="inline-flex items-center gap-1 text-[#F59E0B]">
              <TriangleAlertIcon className="h-3 w-3" />
              {warningText}
            </span>
          )}

          {/* Error message for failed batches */}
          {status === "failed" && errorMessage && (
            <span className="text-[#DC2626]">{errorMessage}</span>
          )}
        </div>
      </div>

      {/* Expanded: sectioned detail */}
      {expanded && (
        <div className="border-t border-[#2A3544]/40 bg-[#0C1016]/40 px-5 py-5 space-y-5">
          {/* Error banner if present */}
          {errorMessage && (
            <div className="rounded-lg border border-[#DC2626]/20 bg-[#DC2626]/5 px-4 py-3">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[#DC2626]">Error</span>
              <p className="mt-1 text-[0.8125rem] text-[#DC2626]">{errorMessage}</p>
            </div>
          )}

          {/* ── SOURCES ── */}
          {sourceLogs.length > 0 && (
            <div>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#9CA3AF]">Sources</span>
              <div className="mt-2 space-y-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#171F28] p-3">
                {sourceLogs.map((src) => {
                  const srcSuccess = src.success as boolean;
                  const srcError = src.error_message as string | null;
                  const srcJobs = src.jobs_returned as number;
                  const isZeroResult = srcSuccess && srcJobs === 0;
                  return (
                    <div key={src.id as string} className="flex flex-wrap items-center gap-2.5 py-1.5">
                      {/* Status icon */}
                      {!srcSuccess ? (
                        <XCircleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
                      ) : isZeroResult ? (
                        <TriangleAlertIcon className="h-4 w-4 shrink-0 text-[#F59E0B]" />
                      ) : (
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#22C55E]" />
                      )}

                      {/* Source name */}
                      <span className="shrink-0 rounded border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[0.6875rem] font-semibold uppercase text-[#B8BFC8]">
                        {src.source_name as string}
                      </span>

                      {/* Search term */}
                      {src.search_term != null && (
                        <span className="text-[0.75rem] text-[#9CA3AF] truncate">&ldquo;{String(src.search_term)}&rdquo;</span>
                      )}

                      {/* Job count */}
                      <span className={`text-[0.8125rem] font-semibold tabular-nums ${isZeroResult ? "text-[#F59E0B]" : "text-white"}`}>
                        {srcJobs} jobs
                      </span>

                      {/* Duration */}
                      {(src.duration_ms as number) > 0 && (
                        <span className="text-[0.6875rem] tabular-nums text-[#6AD7A3]">{formatDuration(src.duration_ms as number)}</span>
                      )}

                      {/* Zero result warning */}
                      {isZeroResult && (
                        <span className="text-[0.6875rem] text-[#F59E0B]">0 results</span>
                      )}

                      {/* Error for failed source */}
                      {srcError && (
                        <span className="w-full text-[0.75rem] text-[#DC2626] pl-7">{String(srcError)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PIPELINE ── */}
          <div>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#9CA3AF]">Pipeline</span>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.8125rem] tabular-nums">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-white">{jobsReturned}</span>
                <span className="text-[0.75rem] text-[#9CA3AF]">fetched</span>
              </div>
              <span className="text-[#9CA3AF]">&rarr;</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-[#B8BFC8]">{jobsDedupe}</span>
                <span className="text-[0.75rem] text-[#9CA3AF]">deduped</span>
              </div>
              <span className="text-[#9CA3AF]">&rarr;</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-[#B8BFC8]">{jobsScored}</span>
                <span className="text-[0.75rem] text-[#9CA3AF]">scored</span>
              </div>
              <span className="text-[#9CA3AF]">&rarr;</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-[#6AD7A3]">{jobsEnriched}</span>
                <span className="text-[0.75rem] text-[#9CA3AF]">enriched</span>
              </div>
            </div>
          </div>

          {/* ── DETAILS ── */}
          <div>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#9CA3AF]">Details</span>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-baseline gap-3">
                <span className="text-[0.6875rem] font-medium text-[#9CA3AF] w-20">Batch ID</span>
                <span className="font-mono text-[0.75rem] text-[#B8BFC8]">{batchId}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-[0.6875rem] font-medium text-[#9CA3AF] w-20">Timestamp</span>
                <span className="text-[0.75rem] tabular-nums text-[#B8BFC8]">{fullTime(summary.created_at as string)}</span>
              </div>
              {duration && (
                <div className="flex items-baseline gap-3">
                  <span className="text-[0.6875rem] font-medium text-[#9CA3AF] w-20">Duration</span>
                  <span className="text-[0.75rem] tabular-nums text-[#B8BFC8]">{duration}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
