"use client";

import { useState, useEffect } from "react";

interface ReviewJob {
  id: string;
  job_id: string | null;
  title: string | null;
  company: string | null;
  url: string | null;
  source: string | null;
  location: string | null;
  work_mode: string | null;
  created_at: string;
  gmail_message_id: string | null;
}

interface ReviewCounts {
  pending: number;
  approved: number;
  rejected: number;
}

interface ApprovalReceipt {
  action: string;
  count: number;
  lane_key?: string;
  bank_inserted?: number;
  enriched?: number;
}

export default function AdminReviewPage() {
  const [jobs, setJobs] = useState<ReviewJob[]>([]);
  const [lanes, setLanes] = useState<string[]>([]);
  const [counts, setCounts] = useState<ReviewCounts>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedLane, setSelectedLane] = useState("");
  const [acting, setActing] = useState(false);
  const [receipt, setReceipt] = useState<ApprovalReceipt | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadQueue() {
    setLoading(true);
    const res = await fetch("/api/admin/review");
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setLanes(data.lanes ?? []);
      setCounts(data.counts ?? { pending: 0, approved: 0, rejected: 0 });
    }
    setLoading(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === jobs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(jobs.map((j) => j.id)));
    }
  }

  async function handleAction(action: "approve" | "reject") {
    if (selected.size === 0) return;
    if (action === "approve" && !selectedLane) {
      showToast("Select a lane before approving");
      return;
    }

    setActing(true);
    setReceipt(null);

    const res = await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        job_ids: [...selected],
        lane_key: action === "approve" ? selectedLane : undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setReceipt(data);
      setSelected(new Set());
      await loadQueue();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? `Failed to ${action}`);
    }

    setActing(false);
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

  const sourceBadgeColor: Record<string, string> = {
    ziprecruiter_email: "bg-[#6366F1]/10 text-[#818CF8] ring-[#6366F1]/20",
    linkedin_email: "bg-[#0A66C2]/10 text-[#38BDF8] ring-[#0A66C2]/20",
    indeed_email: "bg-[#2557A7]/10 text-[#60A5FA] ring-[#2557A7]/20",
    glassdoor_email: "bg-[#0CAA41]/10 text-[#6AD7A3] ring-[#0CAA41]/20",
    email_generic: "bg-[#6B7280]/10 text-[#9CA3AF] ring-[#6B7280]/20",
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#171F28]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#6AD7A3] px-4 py-2 text-[0.8125rem] font-semibold text-[#0C1016] shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Review Queue</h1>
          <div className="mt-1 flex gap-3 text-[11px] text-[#6B7280]">
            <span className="text-[#FAD76A]">{counts.pending} pending</span>
            <span className="text-[#6AD7A3]">{counts.approved} approved</span>
            <span className="text-[#DC2626]">{counts.rejected} rejected</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] px-4 py-3">
          {/* Select All */}
          <label className="flex items-center gap-2 text-[12px] text-[#9CA3AF] cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === jobs.length && jobs.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-[#2A3544] bg-[#0C1016] text-[#6AD7A3] focus:ring-[#6AD7A3]"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>

          <div className="h-5 w-px bg-[#2A3544]" />

          {/* Lane dropdown */}
          <select
            value={selectedLane}
            onChange={(e) => setSelectedLane(e.target.value)}
            className="rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-1.5 text-[12px] text-white outline-none focus:border-[#6AD7A3]"
          >
            <option value="">Assign Lane...</option>
            {lanes.map((lane) => (
              <option key={lane} value={lane}>
                {lane.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          {/* Approve button */}
          <button
            onClick={() => handleAction("approve")}
            disabled={acting || selected.size === 0}
            className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016] disabled:opacity-40"
          >
            {acting ? "Processing..." : `Approve (${selected.size})`}
          </button>

          {/* Reject button */}
          <button
            onClick={() => handleAction("reject")}
            disabled={acting || selected.size === 0}
            className="rounded-full border border-[#DC2626]/30 px-4 py-1.5 text-[12px] font-medium text-[#DC2626] hover:bg-[#DC2626]/10 disabled:opacity-40"
          >
            Reject ({selected.size})
          </button>
        </div>
      )}

      {/* Receipt */}
      {receipt && (
        <div className={`rounded-2xl border p-4 ${
          receipt.action === "approve"
            ? "border-[#6AD7A3]/20 bg-[#6AD7A3]/5"
            : "border-[#DC2626]/20 bg-[#DC2626]/5"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${receipt.action === "approve" ? "bg-[#6AD7A3]" : "bg-[#DC2626]"}`} />
            <span className="text-[13px] font-medium">
              {receipt.action === "approve"
                ? `Approved ${receipt.count} jobs → "${receipt.lane_key}" lane`
                : `Rejected ${receipt.count} jobs`}
            </span>
          </div>
          {receipt.action === "approve" && (
            <div className="mt-2 flex gap-4 text-[11px] text-[#6B7280]">
              <span>Added to bank: {receipt.bank_inserted}</span>
              <span>Enriched: {receipt.enriched}</span>
            </div>
          )}
        </div>
      )}

      {/* Job List */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
          <p className="text-sm font-medium text-[#B8BFC8]">Review queue is empty</p>
          <p className="mt-1 text-[11px] text-[#6B7280]">
            Run Gmail ingest to populate the queue with candidate jobs
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => toggleSelect(job.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                selected.has(job.id)
                  ? "border-[#6AD7A3]/30 bg-[#6AD7A3]/5"
                  : "border-[rgba(255,255,255,0.06)] bg-[#171F28] hover:border-[rgba(255,255,255,0.12)]"
              }`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(job.id)}
                onChange={() => toggleSelect(job.id)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 shrink-0 rounded border-[#2A3544] bg-[#0C1016] text-[#6AD7A3] focus:ring-[#6AD7A3]"
              />

              {/* Job info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-white">
                    {job.title || "Untitled"}
                  </span>
                  <span className="text-[12px] text-[#6B7280]">
                    — {job.company || "Unknown"}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex shrink-0 items-center gap-2">
                {job.source && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                    sourceBadgeColor[job.source] ?? "bg-[#151C24] text-[#6B7280] ring-[#2A3544]"
                  }`}>
                    {job.source.replace(/_email$/, "")}
                  </span>
                )}
                {job.work_mode && (
                  <span className="rounded-full bg-[#38BDF8]/10 px-2 py-0.5 text-[10px] text-[#38BDF8] ring-1 ring-[#38BDF8]/20">
                    {job.work_mode}
                  </span>
                )}
                {job.location && (
                  <span className="hidden text-[10px] text-[#6B7280] sm:inline">
                    {job.location}
                  </span>
                )}
                <span className="text-[10px] text-[#4B5563]">
                  {timeAgo(job.created_at)}
                </span>
              </div>

              {/* Link */}
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-[#38BDF8] hover:text-[#60A5FA]"
                  title="Open listing"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
