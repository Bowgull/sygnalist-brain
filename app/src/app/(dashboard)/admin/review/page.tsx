"use client";

import { useState, useEffect } from "react";

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

const STAGES = [
  { key: "pending", label: "Needs Review", color: "#FAD76A" },
  { key: "ready", label: "Ready to Approve", color: "#3B82F6" },
];

export default function AdminReviewPage() {
  const [jobs, setJobs] = useState<ReviewJob[]>([]);
  const [lanes, setLanes] = useState<string[]>([]);
  const [counts, setCounts] = useState({ pending: 0, ready: 0 });
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const currentStage = STAGES[activeStage];
  const filtered = jobs.filter((j) => j.review_status === currentStage.key);

  useEffect(() => { loadQueue(); }, []);

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
      setCounts(data.counts ?? { pending: 0, ready: 0 });
    }
    setLoading(false);
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
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((j: ReviewJob) => j.id)));
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
        showToast(`Approved ${data.count} jobs → Job Bank (${data.enriched} enriched)`);
      } else if (action === "reject") {
        showToast(`Rejected ${data.count} jobs`);
      } else if (action === "move_to_ready") {
        showToast(`Moved ${data.count} jobs to Ready`);
      } else if (action === "back_to_review") {
        showToast(`Moved ${data.count} jobs back to Review`);
      }
      setSelected(new Set());
      await loadQueue();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? `Action failed`);
    }
    setActing(false);
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

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

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
        <h1 className="text-lg font-semibold">Review Queue</h1>
        <a href="/admin/ingest" className="rounded-full border border-[#2A3544] px-3 py-1 text-[11px] font-medium text-[#9CA3AF] hover:border-[#6AD7A3]/50 hover:text-white">
          Back to Ingest
        </a>
      </div>

      {/* Stage Pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {STAGES.map((stage, i) => {
          const count = stage.key === "pending" ? counts.pending : counts.ready;
          const isActive = i === activeStage;
          return (
            <button
              key={stage.key}
              onClick={() => { setActiveStage(i); setSelected(new Set()); setExpanded(null); }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[12px] font-medium transition-colors ${
                isActive ? "ring-1" : "opacity-60 hover:opacity-80"
              }`}
              style={{
                color: stage.color,
                backgroundColor: isActive ? `${stage.color}15` : "transparent",
                ...(isActive ? { boxShadow: `inset 0 0 0 1px ${stage.color}40` } : {}),
              }}
            >
              {stage.label}
              <span className="rounded-full bg-[#0C1016] px-2 py-0.5 text-[10px] font-bold" style={{ color: stage.color }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Batch Action Bar */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] px-4 py-2.5">
          <label className="flex items-center gap-2 text-[12px] text-[#9CA3AF] cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded border-[#2A3544] bg-[#0C1016] text-[#6AD7A3] focus:ring-[#6AD7A3]"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>

          <div className="h-4 w-px bg-[#2A3544]" />

          {currentStage.key === "pending" && (
            <>
              <button
                onClick={() => handleBatchAction("move_to_ready")}
                disabled={acting || selected.size === 0}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#0C1016] disabled:opacity-40"
                style={{ background: `linear-gradient(to right, #A9FFB5, #5EF2C7, #39D6FF)` }}
              >
                {acting ? "..." : `Move to Ready (${selected.size})`}
              </button>
              <button
                onClick={() => handleBatchAction("reject")}
                disabled={acting || selected.size === 0}
                className="rounded-full border border-[#DC2626]/30 px-3 py-1.5 text-[11px] font-medium text-[#DC2626] hover:bg-[#DC2626]/10 disabled:opacity-40"
              >
                Reject ({selected.size})
              </button>
            </>
          )}

          {currentStage.key === "ready" && (
            <>
              <button
                onClick={() => handleBatchAction("approve")}
                disabled={acting || selected.size === 0}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#0C1016] disabled:opacity-40"
                style={{ background: `linear-gradient(to right, #A9FFB5, #5EF2C7, #39D6FF)` }}
              >
                {acting ? "Approving..." : `Approve to Job Bank (${selected.size})`}
              </button>
              <button
                onClick={() => handleBatchAction("back_to_review")}
                disabled={acting || selected.size === 0}
                className="rounded-full border border-[#2A3544] px-3 py-1.5 text-[11px] font-medium text-[#9CA3AF] disabled:opacity-40"
              >
                Back to Review ({selected.size})
              </button>
            </>
          )}
        </div>
      )}

      {/* Job List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <p className="text-sm font-medium text-[#B8BFC8]">
            {currentStage.key === "pending" ? "No jobs pending review" : "No jobs ready to approve"}
          </p>
          <p className="mt-1 text-[11px] text-[#6B7280]">
            {currentStage.key === "pending"
              ? "Run Gmail ingest to populate the queue"
              : "Move jobs from Needs Review after editing"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((job) => (
            <ReviewCard
              key={job.id}
              job={job}
              lanes={lanes}
              isSelected={selected.has(job.id)}
              isExpanded={expanded === job.id}
              onToggleSelect={() => toggleSelect(job.id)}
              onToggleExpand={() => setExpanded(expanded === job.id ? null : job.id)}
              onSave={(patch) => handleSaveJob(job.id, patch)}
              timeAgo={timeAgo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  job, lanes, isSelected, isExpanded, onToggleSelect, onToggleExpand, onSave, timeAgo,
}: {
  job: ReviewJob; lanes: string[]; isSelected: boolean; isExpanded: boolean;
  onToggleSelect: () => void; onToggleExpand: () => void;
  onSave: (patch: Record<string, unknown>) => void; timeAgo: (d: string) => string;
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
    setLaneKey(value);
    setLaneSearch("");
    setLaneOpen(false);
    markDirty();
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
    indeed_email: "text-[#60A5FA]", glassdoor_email: "text-[#6AD7A3]", email_generic: "text-[#9CA3AF]",
  };

  const inputClass = "w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[12px] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]";

  return (
    <div className={`rounded-xl border transition ${isSelected ? "border-[#6AD7A3]/30 bg-[#6AD7A3]/5" : "border-[rgba(255,255,255,0.06)] bg-[#171F28] hover:border-[rgba(255,255,255,0.12)]"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <input type="checkbox" checked={isSelected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 shrink-0 rounded border-[#2A3544] bg-[#0C1016] text-[#6AD7A3] focus:ring-[#6AD7A3]" />

        <div className="min-w-0 flex-1 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-white">{job.title || "Untitled"}</span>
            <span className="shrink-0 text-[12px] text-[#6B7280]"> - {job.company || "Unknown"}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {job.lane_key && (
            <span className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[10px] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20">
              {job.lane_key.replace(/_/g, " ")}
            </span>
          )}
          {job.source && (
            <span className={`text-[10px] font-medium ${sourceBadge[job.source] ?? "text-[#6B7280]"}`}>
              {job.source.replace(/_email$/, "")}
            </span>
          )}
          <span className="text-[10px] text-[#4B5563]">{timeAgo(job.created_at)}</span>
          <button onClick={onToggleExpand} className="p-1 text-[#4B5563] hover:text-[#9CA3AF]">
            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

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
              <div
                onClick={() => setLaneOpen(!laneOpen)}
                className={`${inputClass} cursor-pointer flex items-center justify-between`}
              >
                <span className={laneKey ? "text-white" : "text-[#4B5563]"}>
                  {laneKey ? laneKey.replace(/_/g, " ") : "Select or type lane..."}
                </span>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#4B5563]" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
              {laneOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-[#2A3544] bg-[#0C1016] shadow-lg">
                  <input
                    autoFocus
                    value={laneSearch}
                    onChange={(e) => setLaneSearch(e.target.value)}
                    placeholder="Type to search or create..."
                    className="w-full border-b border-[#2A3544] bg-transparent px-3 py-2 text-[12px] text-white placeholder-[#4B5563] outline-none"
                  />
                  <div className="max-h-40 overflow-y-auto">
                    {filteredLanes.map((l) => (
                      <button
                        key={l}
                        onClick={() => selectLane(l)}
                        className={`w-full px-3 py-2 text-left text-[12px] hover:bg-[#171F28] ${laneKey === l ? "text-[#6AD7A3]" : "text-[#B8BFC8]"}`}
                      >
                        {l.replace(/_/g, " ")}
                      </button>
                    ))}
                    {showCreateOption && (
                      <button
                        onClick={() => selectLane(laneSearch.toLowerCase().replace(/\s+/g, "_"))}
                        className="w-full px-3 py-2 text-left text-[12px] text-[#FAD76A] hover:bg-[#171F28]"
                      >
                        + Create &ldquo;{laneSearch}&rdquo;
                      </button>
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
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Job Description</label>
            <textarea value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} rows={4} className={inputClass} placeholder="Paste the job description here - used for AI enrichment on approval" />
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
