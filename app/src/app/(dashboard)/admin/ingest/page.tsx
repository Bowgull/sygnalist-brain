"use client";

import { useState, useEffect } from "react";

/* ── Interfaces ───────────────────────────────────────── */

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

interface ReviewJob {
  id: string;
  title: string | null;
  company: string | null;
  url: string | null;
  source: string | null;
  location: string | null;
  work_mode: string | null;
  lane_key: string | null;
  notes: string | null;
  review_status: string;
  created_at: string;
}

/* ── Helpers ──────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function urlDomain(url: string | null): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; }
}

/* ── Main Page ────────────────────────────────────────── */

export default function AdminIngestPage() {
  /* ingest state */
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  /* review state */
  const [jobs, setJobs] = useState<ReviewJob[]>([]);
  const [lanes, setLanes] = useState<string[]>([]);
  const [counts, setCounts] = useState({ pending: 0, rejected: 0 });
  const [reviewLoading, setReviewLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  /* load on mount */
  useEffect(() => {
    loadReceipts();
    loadQueue();
  }, []);

  /* ── Ingest Handlers ──────────────────────────────── */

  async function loadReceipts() {
    const res = await fetch("/api/admin/ingest/receipts");
    if (res.ok) {
      const data = await res.json();
      setReceipts(data.receipts ?? []);
    }
  }

  async function handleGmailIngest() {
    setRunning(true);
    setIngestError(null);
    setResult(null);

    const res = await fetch("/api/admin/gmail-ingest", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      await loadReceipts();
      await loadQueue();
    } else {
      const data = await res.json();
      setIngestError(data.error || "Ingest failed");
    }
    setRunning(false);
  }

  /* ── Review Handlers ──────────────────────────────── */

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadQueue() {
    setReviewLoading(true);
    const res = await fetch("/api/admin/review");
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setLanes(data.lanes ?? []);
      setCounts(data.counts ?? { pending: 0, rejected: 0 });
    }
    setReviewLoading(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev: Set<string>) => {
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
      setSelected(new Set(jobs.map((j: ReviewJob) => j.id)));
    }
  }

  async function handleBatchAction(action: string) {
    if (selected.size === 0) return;
    setActing(true);

    const res = await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, job_ids: [...selected] }),
    });

    if (res.ok) {
      const data = await res.json();
      if (action === "approve") {
        showToast(`Approved ${data.count} jobs -> Job Bank`);
      } else if (action === "reject") {
        showToast(`Rejected ${data.count} jobs`);
      }
      setSelected(new Set());
      await loadQueue();
      await loadReceipts();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Action failed");
    }
    setActing(false);
  }

  async function handleSingleAction(jobId: string, action: "approve" | "reject") {
    // Optimistic removal
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setSelected((prev) => { const next = new Set(prev); next.delete(jobId); return next; });

    const res = await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, job_ids: [jobId] }),
    });

    if (res.ok) {
      showToast(action === "approve" ? "Approved -> Job Bank" : "Rejected");
      await loadQueue();
      await loadReceipts();
    } else {
      showToast("Action failed");
      await loadQueue();
    }
  }

  async function handleResetRejected() {
    setResetting(true);
    const res = await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_rejected" }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`Reset ${data.count} jobs back to review`);
      await loadQueue();
    } else {
      showToast("Failed to reset");
    }
    setResetting(false);
  }

  async function handleSaveJob(id: string, patch: Record<string, unknown>) {
    setJobs((prev) => prev.map((j: ReviewJob) => (j.id === id ? { ...j, ...patch } : j)));

    const res = await fetch("/api/admin/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch }),
    });

    if (!res.ok) {
      showToast("Failed to save");
      await loadQueue();
    }
  }

  /* ── Render ───────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#6AD7A3] px-4 py-2 text-[0.8125rem] font-semibold text-[#0C1016] shadow-lg">
          {toast}
        </div>
      )}

      {/* ═══ GMAIL INGEST SECTION ═══ */}
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
              <p className="text-[12px] text-[#9CA3AF]">Scan labeled emails and add jobs to the review queue</p>
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
            ) : "Run Gmail Ingest"}
          </button>

          {result && (
            <div className="mt-3 rounded-xl bg-[#6AD7A3]/10 p-4">
              <div className="grid grid-cols-2 gap-y-2 text-[12px]">
                <div className="text-[#B8BFC8]">Messages scanned</div>
                <div className="text-right font-medium text-white">{result.messages_scanned}</div>
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
                  <span className="text-[11px] font-medium text-[#FAD76A]">Capped at {result.jobs_cap_limit} — more available</span>
                </div>
              )}
            </div>
          )}

          {ingestError && (
            <div className="mt-3 rounded-xl bg-[#DC2626]/10 p-3">
              <p className="text-[13px] text-[#DC2626]">{ingestError}</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ INGESTED JOBS ═══ */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">
            Ingested Jobs
            {counts.pending > 0 && <span className="ml-2 text-[12px] font-normal text-[#6B7280]">{counts.pending} to review</span>}
          </h2>
        </div>

        {/* Batch Action Bar */}
        {jobs.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] px-4 py-2.5">
            <label className="flex items-center gap-2 text-[12px] text-[#9CA3AF] cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === jobs.length && jobs.length > 0}
                onChange={toggleSelectAll}
                className="h-3.5 w-3.5 rounded border-[#2A3544] bg-[#0C1016] text-[#6AD7A3] focus:ring-[#6AD7A3]"
              />
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </label>

            <div className="h-4 w-px bg-[#2A3544]" />

            <button
              onClick={() => handleBatchAction("approve")}
              disabled={acting || selected.size === 0}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#0C1016] disabled:opacity-40"
              style={{ background: "linear-gradient(to right, #A9FFB5, #5EF2C7, #39D6FF)" }}
            >
              {acting ? "..." : `Approve (${selected.size})`}
            </button>
            <button
              onClick={() => handleBatchAction("reject")}
              disabled={acting || selected.size === 0}
              className="rounded-full border border-[#DC2626]/30 px-3 py-1.5 text-[11px] font-medium text-[#DC2626] hover:bg-[#DC2626]/10 disabled:opacity-40"
            >
              Reject ({selected.size})
            </button>
          </div>
        )}

        {/* Desktop Table Header */}
        {jobs.length > 0 && (
          <div className="mb-1 hidden md:grid md:grid-cols-[2rem_1fr_1fr_6rem_6rem_8rem_5.5rem] gap-3 px-4 text-[10px] font-semibold uppercase text-[#6B7280]">
            <div />
            <div>Title</div>
            <div>Company</div>
            <div>Source</div>
            <div>Location</div>
            <div>URL</div>
            <div className="text-right">Actions</div>
          </div>
        )}

        {/* Job Cards / Rows */}
        {reviewLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#171F28]" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-10 text-center">
            <p className="text-sm font-medium text-[#B8BFC8]">No jobs pending review</p>
            <p className="mt-1 text-[11px] text-[#6B7280]">Run Gmail ingest to populate the queue</p>
            {counts.rejected > 0 && (
              <button
                onClick={handleResetRejected}
                disabled={resetting}
                className="mt-4 w-full rounded-xl bg-[#FAD76A]/10 px-4 py-3 text-[13px] font-medium text-[#FAD76A] transition hover:bg-[#FAD76A]/20 disabled:opacity-40"
              >
                {resetting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#FAD76A] border-t-transparent" />
                    Resetting...
                  </span>
                ) : `Reset ${counts.rejected} rejected jobs back to review`}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {jobs.map((job) => (
              <ReviewCard
                key={job.id}
                job={job}
                lanes={lanes}
                isSelected={selected.has(job.id)}
                isExpanded={expanded === job.id}
                onToggleSelect={() => toggleSelect(job.id)}
                onToggleExpand={() => setExpanded(expanded === job.id ? null : job.id)}
                onSave={(patch) => handleSaveJob(job.id, patch)}
                onApprove={() => handleSingleAction(job.id, "approve")}
                onReject={() => handleSingleAction(job.id, "reject")}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══ RECENT RUNS ═══ */}
      {receipts.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28]">
          <div className="px-5 py-3">
            <h2 className="text-[13px] font-semibold text-[#B8BFC8]">Recent Runs</h2>
          </div>
          <div className="divide-y divide-[#2A3544]/50 px-5">
            {receipts.map((r, i) => (
              <ReceiptRow key={i} receipt={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Receipt Row ──────────────────────────────────────── */

function ReceiptRow({ receipt }: { receipt: Receipt }) {
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
            <span className="text-[12px] font-medium text-white">Approved {meta.count ?? 0} jobs</span>
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

/* ── Review Card ──────────────────────────────────────── */

function ReviewCard({
  job, lanes, isSelected, isExpanded, onToggleSelect, onToggleExpand, onSave, onApprove, onReject,
}: {
  job: ReviewJob; lanes: string[]; isSelected: boolean; isExpanded: boolean;
  onToggleSelect: () => void; onToggleExpand: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  onApprove: () => void; onReject: () => void;
}) {
  const [title, setTitle] = useState(job.title ?? "");
  const [company, setCompany] = useState(job.company ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [workMode, setWorkMode] = useState(job.work_mode ?? "");
  const [laneKey, setLaneKey] = useState(job.lane_key ?? "");
  const [url, setUrl] = useState(job.url ?? "");
  const [description, setDescription] = useState(job.notes ?? "");
  const [dirty, setDirty] = useState(false);
  const [laneSearch, setLaneSearch] = useState("");
  const [laneOpen, setLaneOpen] = useState(false);

  useEffect(() => {
    setTitle(job.title ?? ""); setCompany(job.company ?? "");
    setLocation(job.location ?? ""); setWorkMode(job.work_mode ?? "");
    setLaneKey(job.lane_key ?? ""); setUrl(job.url ?? "");
    setDescription(job.notes ?? ""); setDirty(false);
  }, [job.title, job.company, job.location, job.work_mode, job.lane_key, job.url, job.notes]);

  function markDirty() { setDirty(true); }

  const filteredLanes = laneSearch
    ? lanes.filter((l) => l.toLowerCase().includes(laneSearch.toLowerCase()))
    : lanes;
  const showCreateOption = laneSearch && !lanes.some((l) => l.toLowerCase() === laneSearch.toLowerCase());

  function selectLane(value: string) {
    setLaneKey(value); setLaneSearch(""); setLaneOpen(false); markDirty();
  }

  function handleSave() {
    onSave({ title: title || null, company: company || null, location: location || null, work_mode: workMode || null, lane_key: laneKey || null, url: url || null, notes: description || null });
    setDirty(false);
  }

  function handleCancel() {
    setTitle(job.title ?? ""); setCompany(job.company ?? "");
    setLocation(job.location ?? ""); setWorkMode(job.work_mode ?? "");
    setLaneKey(job.lane_key ?? ""); setUrl(job.url ?? "");
    setDescription(job.notes ?? ""); setDirty(false);
  }

  const sourceBadge: Record<string, string> = {
    ziprecruiter_email: "text-[#818CF8]", linkedin_email: "text-[#38BDF8]",
    indeed_email: "text-[#60A5FA]", glassdoor_email: "text-[#6AD7A3]",
    wellfound_email: "text-[#F97316]", email_generic: "text-[#9CA3AF]",
  };
  const sourceLabel = (s: string | null) => s?.replace(/_email$/, "") ?? "";

  const inputClass = "w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[12px] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]";

  return (
    <div className={`rounded-xl border transition ${isSelected ? "border-[#6AD7A3]/30 bg-[#6AD7A3]/5" : "border-[rgba(255,255,255,0.06)] bg-[#171F28] hover:border-[rgba(255,255,255,0.12)]"}`}>
      {/* ── Mobile collapsed ── */}
      <div className="flex items-center gap-3 px-4 py-3 md:hidden">
        <input type="checkbox" checked={isSelected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 shrink-0 rounded border-[#2A3544] bg-[#0C1016] text-[#6AD7A3] focus:ring-[#6AD7A3]" />

        <div className="min-w-0 flex-1 cursor-pointer" onClick={onToggleExpand}>
          <div className="truncate text-[13px] font-medium text-white">{job.title || "Untitled — tap to edit"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[11px] text-[#6B7280]">{job.company || "Unknown"}</span>
            {job.source && <span className={`text-[9px] font-medium ${sourceBadge[job.source] ?? "text-[#6B7280]"}`}>{sourceLabel(job.source)}</span>}
            <span className="text-[9px] text-[#4B5563]">{timeAgo(job.created_at)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-1.5 text-[#38BDF8] hover:bg-[#38BDF8]/10" title="Open link">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
            </a>
          )}
          <button onClick={(e) => { e.stopPropagation(); onApprove(); }} className="rounded p-1.5 text-[#6AD7A3] hover:bg-[#6AD7A3]/10" title="Approve">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onReject(); }} className="rounded p-1.5 text-[#DC2626] hover:bg-[#DC2626]/10" title="Reject">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          <button onClick={onToggleExpand} className="p-1.5 text-[#4B5563] hover:text-[#9CA3AF]">
            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
      </div>

      {/* ── Desktop row ── */}
      <div className="hidden md:grid md:grid-cols-[2rem_1fr_1fr_6rem_6rem_8rem_5.5rem] items-center gap-3 px-4 py-2.5">
        <input type="checkbox" checked={isSelected} onChange={onToggleSelect}
          className="h-3.5 w-3.5 rounded border-[#2A3544] bg-[#0C1016] text-[#6AD7A3] focus:ring-[#6AD7A3]" />

        <div className="truncate text-[12px] font-medium text-white cursor-pointer" onClick={onToggleExpand}>
          {job.title || <span className="text-[#4B5563] italic">Untitled</span>}
        </div>
        <div className="truncate text-[12px] text-[#9CA3AF]">{job.company || "Unknown"}</div>
        <span className={`text-[10px] font-medium ${sourceBadge[job.source ?? ""] ?? "text-[#6B7280]"}`}>{sourceLabel(job.source)}</span>
        <div className="truncate text-[11px] text-[#6B7280]">{job.location || "—"}</div>
        <div className="truncate text-[10px] text-[#4B5563]">{urlDomain(job.url)}</div>

        <div className="flex items-center justify-end gap-1">
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-[#38BDF8] hover:bg-[#38BDF8]/10">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
            </a>
          )}
          <button onClick={onApprove} className="rounded p-1 text-[#6AD7A3] hover:bg-[#6AD7A3]/10" title="Approve">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></svg>
          </button>
          <button onClick={onReject} className="rounded p-1 text-[#DC2626] hover:bg-[#DC2626]/10" title="Reject">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          <button onClick={onToggleExpand} className="p-1 text-[#4B5563] hover:text-[#9CA3AF]">
            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
      </div>

      {/* ── Expanded edit form ── */}
      {isExpanded && (
        <div className="border-t border-[#2A3544]/50 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Title</label>
              <input value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Company</label>
              <input value={company} onChange={(e) => { setCompany(e.target.value); markDirty(); }} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Location</label>
              <input value={location} onChange={(e) => { setLocation(e.target.value); markDirty(); }} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Work Mode</label>
              <select value={workMode} onChange={(e) => { setWorkMode(e.target.value); markDirty(); }} className={inputClass}>
                <option value="">-</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>
            <div className="relative">
              <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Lane</label>
              <div onClick={() => setLaneOpen(!laneOpen)} className={`${inputClass} cursor-pointer flex items-center justify-between`}>
                <span className={laneKey ? "text-white" : "text-[#4B5563]"}>{laneKey ? laneKey.replace(/_/g, " ") : "Select or type lane..."}</span>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#4B5563]" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>
              </div>
              {laneOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-[#2A3544] bg-[#0C1016] shadow-lg">
                  <input autoFocus value={laneSearch} onChange={(e) => setLaneSearch(e.target.value)} placeholder="Type to search or create..."
                    className="w-full border-b border-[#2A3544] bg-transparent px-3 py-2 text-[12px] text-white placeholder-[#4B5563] outline-none" />
                  <div className="max-h-40 overflow-y-auto">
                    {filteredLanes.map((l) => (
                      <button key={l} onClick={() => selectLane(l)} className={`w-full px-3 py-2 text-left text-[12px] hover:bg-[#171F28] ${laneKey === l ? "text-[#6AD7A3]" : "text-[#B8BFC8]"}`}>{l.replace(/_/g, " ")}</button>
                    ))}
                    {showCreateOption && (
                      <button onClick={() => selectLane(laneSearch.toLowerCase().replace(/\s+/g, "_"))} className="w-full px-3 py-2 text-left text-[12px] text-[#FAD76A] hover:bg-[#171F28]">+ Create &ldquo;{laneSearch}&rdquo;</button>
                    )}
                    {filteredLanes.length === 0 && !showCreateOption && (
                      <div className="px-3 py-2 text-[11px] text-[#4B5563]">No lanes found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">URL</label>
              <div className="flex gap-2">
                <input value={url} onChange={(e) => { setUrl(e.target.value); markDirty(); }} className={inputClass} />
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center rounded-lg border border-[#2A3544] px-2 text-[#38BDF8] hover:border-[#38BDF8]/50">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Notes / Description</label>
            <textarea value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} rows={3} className={inputClass} placeholder="Paste job description or notes" />
          </div>
          {dirty && (
            <div className="mt-3 flex gap-2">
              <button onClick={handleSave} className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[11px] font-semibold text-[#0C1016]">Save</button>
              <button onClick={handleCancel} className="rounded-full border border-[#2A3544] px-4 py-1.5 text-[11px] text-[#9CA3AF]">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
