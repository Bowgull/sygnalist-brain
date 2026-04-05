"use client";

import { deriveBatchStatus, type BatchStatus } from "./log-utils";

type FetchLog = Record<string, unknown>;

type Props = {
  /** All batch groups: array of { batchId, logs } */
  batches: { batchId: string; logs: FetchLog[] }[];
};

export default function FetchSummaryStrip({ batches }: Props) {
  // Filter to last 24h based on the first log's created_at
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recentBatches = batches.filter((b) => {
    const ts = b.logs[0]?.created_at as string | undefined;
    return ts && new Date(ts).getTime() > cutoff;
  });

  if (recentBatches.length === 0) return null;

  // Derive status for each batch
  const counts: Record<BatchStatus, number> = { success: 0, warning: 0, failed: 0 };
  for (const batch of recentBatches) {
    const sourceLogs = batch.logs.filter((l) => l.source_name !== "summary");
    const status = deriveBatchStatus(sourceLogs);
    counts[status]++;
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
        <span className="font-medium text-[#9CA3AF]">Last 24h:</span>
        <span className="font-semibold tabular-nums text-white">{recentBatches.length}</span>
        <span className="text-[#9CA3AF]">batches</span>
        <span className="text-[#9CA3AF]">&middot;</span>
        <span className="font-semibold tabular-nums text-[#22C55E]">{counts.success}</span>
        <span className="text-[#9CA3AF]">healthy</span>
        <span className="text-[#9CA3AF]">&middot;</span>
        <span className={`font-semibold tabular-nums ${counts.warning > 0 ? "text-[#F59E0B]" : "text-[#9CA3AF]"}`}>{counts.warning}</span>
        <span className="text-[#9CA3AF]">warnings</span>
        <span className="text-[#9CA3AF]">&middot;</span>
        <span className={`font-semibold tabular-nums ${counts.failed > 0 ? "text-[#DC2626]" : "text-[#9CA3AF]"}`}>{counts.failed}</span>
        <span className="text-[#9CA3AF]">failures</span>
      </div>
    </div>
  );
}
