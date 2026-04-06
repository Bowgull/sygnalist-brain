"use client";

import { useState, useEffect } from "react";

interface IngestResult {
  messages_scanned: number;
  messages_skipped: number;
  jobs_found: number;
  jobs_new: number;
  jobs_duplicate: number;
  jobs_capped: boolean;
  jobs_cap_limit: number;
  queue_remaining: number;
  backlog_detected: boolean;
}

interface Receipt {
  type: string;
  metadata: Record<string, unknown>;
  success: boolean | null;
  created_at: string;
}

export default function AdminIngestPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [pendingReview, setPendingReview] = useState(0);

  useEffect(() => {
    loadReceipts();
  }, []);

  async function loadReceipts() {
    const res = await fetch("/api/admin/ingest/receipts");
    if (res.ok) {
      const data = await res.json();
      setReceipts(data.receipts ?? []);
      setPendingReview(data.pending_review ?? 0);
    }
  }

  async function handleGmailIngest(reprocess = false) {
    setRunning(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/gmail-ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reprocess ? { reprocess: true } : {}),
    });
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      await loadReceipts();
    } else {
      const data = await res.json();
      setError(data.error || "Ingest failed");
    }
    setRunning(false);
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Gmail Ingest</h1>

      {/* Review queue banner */}
      {pendingReview > 0 && (
        <a
          href="/admin/review"
          className="flex items-center gap-3 rounded-2xl border border-[#FAD76A]/20 bg-[#FAD76A]/5 px-4 py-3 transition hover:bg-[#FAD76A]/10"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAD76A]/15">
            <span className="text-[14px] font-bold text-[#FAD76A]">{pendingReview}</span>
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#FAD76A]">
              {pendingReview} job{pendingReview !== 1 ? "s" : ""} pending review
            </p>
            <p className="text-[11px] text-[#9CA3AF]">Go to Review Queue to verify and approve</p>
          </div>
          <svg viewBox="0 0 24 24" className="ml-auto h-4 w-4 text-[#FAD76A]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>
      )}

      {/* Gmail Ingest Card */}
      <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28]">
        <div className="bg-gradient-to-r from-[#6AD7A3]/10 via-[#5EF2C7]/10 to-[#39D6FF]/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6AD7A3]/15">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold">Gmail Email Ingest</h2>
              <p className="text-[12px] text-[#9CA3AF]">
                Scan labeled emails and add jobs to the review queue
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <button
            onClick={handleGmailIngest}
            disabled={running}
            className="w-full rounded-xl bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-3 text-sm font-bold text-[#0C1016] transition hover:opacity-90 disabled:opacity-50"
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0C1016] border-t-transparent" />
                Scanning Gmail...
              </span>
            ) : (
              "Run Gmail Ingest"
            )}
          </button>

          <button
            onClick={() => handleGmailIngest(true)}
            disabled={running}
            className="mt-2 w-full rounded-xl border border-[#2A3544] py-2.5 text-[12px] font-medium text-[#9CA3AF] transition hover:border-[#6AD7A3]/50 hover:text-white disabled:opacity-50"
          >
            {running ? "..." : "Reprocess Already-Scanned Emails"}
          </button>

          {/* Ingest Result */}
          {result && (
            <div className="mt-3 rounded-xl bg-[#6AD7A3]/10 p-4">
              <div className="grid grid-cols-2 gap-y-2 text-[12px]">
                <div className="text-[#B8BFC8]">Messages scanned</div>
                <div className="text-right font-medium text-white">{result.messages_scanned}</div>
                <div className="text-[#B8BFC8]">Messages skipped</div>
                <div className="text-right font-medium text-white">{result.messages_skipped}</div>
                <div className="text-[#B8BFC8]">Jobs found</div>
                <div className="text-right font-medium text-white">{result.jobs_found}</div>
                <div className="text-[#B8BFC8]">New (added to queue)</div>
                <div className="text-right font-medium text-[#6AD7A3]">{result.jobs_new}</div>
                <div className="text-[#B8BFC8]">Duplicates (skipped)</div>
                <div className="text-right font-medium text-[#6B7280]">{result.jobs_duplicate}</div>
              </div>
              {result.jobs_capped && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#FAD76A]/10 px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-[#FAD76A]" />
                  <span className="text-[11px] font-medium text-[#FAD76A]">
                    Capped at {result.jobs_cap_limit} jobs per run - more available
                  </span>
                </div>
              )}
              {result.backlog_detected && !result.jobs_capped && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#FAD76A]/10 px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-[#FAD76A]" />
                  <span className="text-[11px] font-medium text-[#FAD76A]">
                    Backlog detected - ~{result.queue_remaining} more messages waiting
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl bg-[#DC2626]/10 p-3">
              <p className="text-[13px] text-[#DC2626]">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Runs */}
      {receipts.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28]">
          <div className="px-5 py-3">
            <h2 className="text-[13px] font-semibold text-[#B8BFC8]">Recent Runs</h2>
          </div>
          <div className="divide-y divide-[#2A3544]/50 px-5">
            {receipts.map((r, i) => (
              <ReceiptRow key={i} receipt={r} timeAgo={timeAgo} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptRow({ receipt, timeAgo }: { receipt: Receipt; timeAgo: (d: string) => string }) {
  const meta = receipt.metadata as Record<string, number | string | boolean>;

  if (receipt.type === "gmail.ingest_completed") {
    return (
      <div className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#6AD7A3]" />
            <span className="text-[12px] font-medium text-white">Gmail Ingest</span>
          </div>
          <span className="text-[10px] text-[#4B5563]">{timeAgo(receipt.created_at)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-4 text-[11px] text-[#6B7280]">
          <span>Scanned: {meta.messages_scanned ?? 0}</span>
          <span>Found: {meta.jobs_found ?? 0}</span>
          <span className="text-[#6AD7A3]">New: {meta.jobs_new ?? 0}</span>
          <span>Dupes: {meta.jobs_duplicate ?? 0}</span>
          {meta.backlog_detected && <span className="text-[#FAD76A]">Backlog</span>}
          {meta.jobs_capped && <span className="text-[#FAD76A]">Capped</span>}
        </div>
      </div>
    );
  }

  if (receipt.type === "cron.fetch_completed") {
    return (
      <div className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#38BDF8]" />
            <span className="text-[12px] font-medium text-white">Fetch Pipeline</span>
          </div>
          <span className="text-[10px] text-[#4B5563]">{timeAgo(receipt.created_at)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-4 text-[11px] text-[#6B7280]">
          <span>Profiles: {meta.profiles_processed ?? 0}</span>
          <span className="text-[#6AD7A3]">Jobs: {meta.total_jobs ?? 0}</span>
          {Number(meta.profiles_failed) > 0 && (
            <span className="text-[#DC2626]">Failed: {meta.profiles_failed}</span>
          )}
        </div>
      </div>
    );
  }

  if (receipt.type === "admin.review_approve") {
    return (
      <div className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#22C55E]" />
            <span className="text-[12px] font-medium text-white">
              Approved {meta.count ?? 0} jobs
            </span>
          </div>
          <span className="text-[10px] text-[#4B5563]">{timeAgo(receipt.created_at)}</span>
        </div>
      </div>
    );
  }

  if (receipt.type === "admin.review_reject") {
    return (
      <div className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#DC2626]" />
            <span className="text-[12px] font-medium text-white">Rejected {meta.count ?? 0} jobs</span>
          </div>
          <span className="text-[10px] text-[#4B5563]">{timeAgo(receipt.created_at)}</span>
        </div>
      </div>
    );
  }

  return null;
}
