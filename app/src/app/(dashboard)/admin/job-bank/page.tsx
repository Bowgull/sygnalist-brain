"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, ExternalLink, Search, Check, X,
  ChevronLeft, ChevronRight, ArrowUpDown, Sparkles, RotateCcw, Archive,
} from "lucide-react";
import { BoardPill } from "@/components/ui/board-pill";

interface JobBankEntry {
  id: string;
  title: string | null;
  company: string | null;
  url: string | null;
  source: string | null;
  location: string | null;
  salary: string | null;
  work_mode: string | null;
  job_family: string | null;
  description_snippet: string | null;
  job_summary: string | null;
  why_fit: string | null;
  stale_status?: string;
  stale_at?: string | null;
  created_at: string;
  updated_at?: string;
}

interface LaneOption {
  lane_key: string;
  role_name: string;
}

const PAGE_SIZE = 50;

export default function AdminJobBankPage() {
  const [jobs, setJobs] = useState<JobBankEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lanes, setLanes] = useState<LaneOption[]>([]);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterFamily, setFilterFamily] = useState("");
  const [filterWorkMode, setFilterWorkMode] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterStale, setFilterStale] = useState("");
  const [staleCounts, setStaleCounts] = useState<{ active: number; stale: number; archived: number }>({ active: 0, stale: 0, archived: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load lanes for dropdown
  useEffect(() => {
    fetch("/api/admin/lanes")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const seen = new Set<string>();
          const unique: LaneOption[] = [];
          for (const l of data) {
            if (!seen.has(l.lane_key)) {
              seen.add(l.lane_key);
              unique.push({ lane_key: l.lane_key, role_name: l.role_name });
            }
          }
          setLanes(unique);
        }
      })
      .catch(() => {});
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      sort_by: sortBy,
      order: sortOrder,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterFamily) params.set("job_family", filterFamily);
    if (filterWorkMode) params.set("work_mode", filterWorkMode);
    if (filterStale) params.set("stale_status", filterStale);

    const res = await fetch(`/api/admin/job-bank?${params}`);
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setTotal(data.total ?? 0);
    } else {
      showToast("Failed to load job bank");
    }
    setLoading(false);
  }, [page, sortBy, sortOrder, debouncedSearch, filterFamily, filterWorkMode, filterStale]);

  // Load stale counts for stats line (fails silently if column doesn't exist yet)
  const loadStaleCounts = useCallback(async () => {
    try {
      const counts = { active: 0, stale: 0, archived: 0 };
      for (const status of ["active", "stale", "archived"] as const) {
        const res = await fetch(`/api/admin/job-bank?limit=1&offset=0&stale_status=${status}`);
        if (res.ok) {
          const data = await res.json();
          counts[status] = data.total ?? 0;
        }
      }
      setStaleCounts(counts);
    } catch {
      // Column may not exist yet — ignore
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    loadStaleCounts();
  }, [loadStaleCounts]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/admin/job-bank?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setTotal((prev) => prev - 1);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast("Job removed");
    } else {
      showToast("Failed to remove job");
    }
    setDeleting(false);
    setDeleteConfirm(null);
  }

  async function handleBulkDelete() {
    setDeleting(true);
    let deleted = 0;
    for (const id of selected) {
      const res = await fetch(`/api/admin/job-bank?id=${id}`, { method: "DELETE" });
      if (res.ok) deleted++;
    }
    showToast(`Deleted ${deleted} job(s)`);
    setSelected(new Set());
    setBulkDeleteConfirm(false);
    setDeleting(false);
    loadJobs();
  }

  async function handleBulkLaneAssign(laneKey: string) {
    let updated = 0;
    for (const id of selected) {
      const res = await fetch("/api/admin/job-bank", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, job_family: laneKey }),
      });
      if (res.ok) updated++;
    }
    showToast(`Assigned lane to ${updated} job(s)`);
    setSelected(new Set());
    loadJobs();
  }

  async function handleStaleAction(id: string, action: "keep" | "archive") {
    const patch = action === "keep"
      ? { stale_status: "active", stale_at: null }
      : { stale_status: "archived" };
    const res = await fetch("/api/admin/job-bank", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (res.ok) {
      const updated = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
      showToast(action === "keep" ? "Job marked active" : "Job archived");
      loadStaleCounts();
    } else {
      showToast("Failed to update job");
    }
  }

  async function handleBulkStaleAction(action: "keep" | "archive") {
    let updated = 0;
    const patch = action === "keep"
      ? { stale_status: "active", stale_at: null }
      : { stale_status: "archived" };
    for (const id of selected) {
      const res = await fetch("/api/admin/job-bank", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (res.ok) updated++;
    }
    showToast(`${action === "keep" ? "Reactivated" : "Archived"} ${updated} job(s)`);
    setSelected(new Set());
    loadJobs();
    loadStaleCounts();
  }

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/admin/job-bank", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (res.ok) {
      const updated = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
      setEditing(null);
      showToast("Job updated");
    } else {
      showToast("Failed to update job");
    }
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

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading && jobs.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#171F28]" />
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[#2A3544] bg-[#151C24] p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DC2626]/20">
              <Trash2 className="h-6 w-6 text-[#DC2626]" strokeWidth={2} />
            </div>
            <h3 className="text-center text-[15px] font-semibold text-[#DC2626]">Delete Job?</h3>
            <p className="mt-2 text-center text-[13px] leading-relaxed text-[#9CA3AF]">
              Remove <span className="font-medium text-white">{deleteConfirm.title || "Untitled"}</span> from the bank?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-full border border-[#2A3544] py-2 text-[13px] font-medium text-[#9CA3AF] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm.id)}
                disabled={deleting}
                className="flex-1 rounded-full bg-[#DC2626] py-2 text-[13px] font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[#2A3544] bg-[#151C24] p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DC2626]/20">
              <Trash2 className="h-6 w-6 text-[#DC2626]" strokeWidth={2} />
            </div>
            <h3 className="text-center text-[15px] font-semibold text-[#DC2626]">Delete {selected.size} Jobs?</h3>
            <p className="mt-2 text-center text-[13px] leading-relaxed text-[#9CA3AF]">
              This will permanently remove {selected.size} selected job(s) from the bank.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(false)}
                className="flex-1 rounded-full border border-[#2A3544] py-2 text-[13px] font-medium text-[#9CA3AF] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex-1 rounded-full bg-[#DC2626] py-2 text-[13px] font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
              >
                {deleting ? "Deleting..." : `Delete ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Job Bank ({total})</h1>
          <p className="mt-0.5 text-[11px] text-[#6B7280]">
            <span className="text-[#6AD7A3]">{staleCounts.active} active</span>
            {staleCounts.stale > 0 && <span className="text-[#FBBF24]"> / {staleCounts.stale} stale</span>}
            {staleCounts.archived > 0 && <span className="text-[#DC2626]"> / {staleCounts.archived} archived</span>}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-3 py-1.5 text-[12px] font-semibold text-[#0C1016]"
        >
          <Plus size={16} strokeWidth={2.5} />
          Add Job
        </button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, company, or job family..."
            className="w-full rounded-xl border border-[#2A3544] bg-[#171F28] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterFamily}
            onChange={(e) => { setFilterFamily(e.target.value); setPage(0); }}
            className="rounded-lg border border-[#2A3544] bg-[#171F28] px-3 py-1.5 text-[12px] text-white outline-none focus:border-[#6AD7A3]"
          >
            <option value="">All Lanes</option>
            {lanes.map((l) => (
              <option key={l.lane_key} value={l.lane_key}>{l.role_name}</option>
            ))}
          </select>
          <select
            value={filterWorkMode}
            onChange={(e) => { setFilterWorkMode(e.target.value); setPage(0); }}
            className="rounded-lg border border-[#2A3544] bg-[#171F28] px-3 py-1.5 text-[12px] text-white outline-none focus:border-[#6AD7A3]"
          >
            <option value="">All Work Modes</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
          <select
            value={filterStale}
            onChange={(e) => { setFilterStale(e.target.value); setPage(0); }}
            className="rounded-lg border border-[#2A3544] bg-[#171F28] px-3 py-1.5 text-[12px] text-white outline-none focus:border-[#6AD7A3]"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="stale">Stale</option>
            <option value="archived">Archived</option>
          </select>
          {/* Sort buttons */}
          <div className="flex items-center gap-1 sm:ml-auto">
            {[
              { key: "created_at", label: "Date" },
              { key: "title", label: "Title" },
              { key: "company", label: "Company" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                  sortBy === key
                    ? "bg-[#6AD7A3]/10 text-[#6AD7A3]"
                    : "text-[#6B7280] hover:text-white"
                }`}
              >
                {label}
                {sortBy === key && (
                  <ArrowUpDown size={10} strokeWidth={2.5} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#6AD7A3]/30 bg-[#6AD7A3]/5 px-4 py-2">
          <span className="text-[12px] font-medium text-[#6AD7A3]">{selected.size} selected</span>
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleBulkLaneAssign(e.target.value);
                e.target.value = "";
              }
            }}
            className="rounded-lg border border-[#2A3544] bg-[#0C1016] px-2 py-1 text-[11px] text-white outline-none"
            defaultValue=""
          >
            <option value="" disabled>Assign Lane...</option>
            {lanes.map((l) => (
              <option key={l.lane_key} value={l.lane_key}>{l.role_name}</option>
            ))}
          </select>
          <button
            onClick={() => handleBulkStaleAction("keep")}
            className="flex items-center gap-1 rounded-full border border-[#6AD7A3]/30 px-3 py-1 text-[11px] text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
          >
            <RotateCcw size={12} strokeWidth={2} />
            Mark Active
          </button>
          <button
            onClick={() => handleBulkStaleAction("archive")}
            className="flex items-center gap-1 rounded-full border border-[#FBBF24]/30 px-3 py-1 text-[11px] text-[#FBBF24] hover:bg-[#FBBF24]/10"
          >
            <Archive size={12} strokeWidth={2} />
            Archive
          </button>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="flex items-center gap-1 rounded-full border border-[#DC2626]/30 px-3 py-1 text-[11px] text-[#DC2626] hover:bg-[#DC2626]/10"
          >
            <Trash2 size={12} strokeWidth={2} />
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-full border border-[#2A3544] px-3 py-1 text-[11px] text-[#9CA3AF] hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <AddJobForm
          lanes={lanes}
          onAdded={() => {
            loadJobs();
            setShowAdd(false);
            showToast("Job added to bank");
          }}
          onError={(msg) => showToast(msg)}
        />
      )}

      {/* Jobs list */}
      {jobs.length === 0 && !loading ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <p className="text-sm font-medium text-[#B8BFC8]">
            {debouncedSearch || filterFamily || filterWorkMode ? "No matching jobs" : "Job bank is empty"}
          </p>
          <p className="mt-1 text-[11px] text-[#6B7280]">
            Add jobs manually, via Gmail ingest, or through API fetch
          </p>
        </div>
      ) : (
        <>
          {/* Select all row */}
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={toggleSelectAll}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                selected.size === jobs.length && jobs.length > 0
                  ? "border-[#6AD7A3] bg-[#6AD7A3] text-[#0C1016]"
                  : "border-[#4B5563]"
              }`}
            >
              {selected.size === jobs.length && jobs.length > 0 && (
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span className="text-[11px] text-[#6B7280]">Select all</span>
          </div>

          <div className="space-y-2">
            {jobs.map((job) => (
              <JobBankCard
                key={job.id}
                job={job}
                lanes={lanes}
                isEditing={editing === job.id}
                isSelected={selected.has(job.id)}
                onSelect={() => toggleSelect(job.id)}
                onEdit={() => setEditing(editing === job.id ? null : job.id)}
                onUpdate={(patch) => handleUpdate(job.id, patch)}
                onDelete={() => setDeleteConfirm({ id: job.id, title: job.title ?? "Untitled" })}
                onCancel={() => setEditing(null)}
                onStaleAction={(action) => handleStaleAction(job.id, action)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 rounded-lg border border-[#2A3544] px-3 py-1.5 text-[12px] text-[#9CA3AF] hover:text-white disabled:opacity-30"
              >
                <ChevronLeft size={14} strokeWidth={2} />
                Prev
              </button>
              <span className="text-[12px] text-[#6B7280]">
                Page {page + 1} of {totalPages} ({total} total)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 rounded-lg border border-[#2A3544] px-3 py-1.5 text-[12px] text-[#9CA3AF] hover:text-white disabled:opacity-30"
              >
                Next
                <ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function JobBankCard({
  job,
  lanes,
  isEditing,
  isSelected,
  onSelect,
  onEdit,
  onUpdate,
  onDelete,
  onCancel,
  onStaleAction,
}: {
  job: JobBankEntry;
  lanes: LaneOption[];
  isEditing: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onCancel: () => void;
  onStaleAction: (action: "keep" | "archive") => void;
}) {
  const [title, setTitle] = useState(job.title ?? "");
  const [company, setCompany] = useState(job.company ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [salary, setSalary] = useState(job.salary ?? "");
  const [workMode, setWorkMode] = useState(job.work_mode ?? "");
  const [jobFamily, setJobFamily] = useState(job.job_family ?? "");
  const [url, setUrl] = useState(job.url ?? "");
  const [descSnippet, setDescSnippet] = useState(job.description_snippet ?? "");
  const [jobSummary, setJobSummary] = useState(job.job_summary ?? "");

  const inputClass =
    "w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[0.8125rem] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]";

  function formatDate(d: string) {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-[#6AD7A3]/30 bg-[#171F28] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job Title" className={inputClass} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className={inputClass} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className={inputClass} />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className={inputClass} />
          <input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Salary (e.g. $80k-$120k)" className={inputClass} />
          <select value={workMode} onChange={(e) => setWorkMode(e.target.value)} className={inputClass}>
            <option value="">Work Mode</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
          <select value={jobFamily} onChange={(e) => setJobFamily(e.target.value)} className={inputClass}>
            <option value="">Job Family / Lane</option>
            {lanes.map((l) => (
              <option key={l.lane_key} value={l.lane_key}>{l.role_name}</option>
            ))}
          </select>
        </div>
        <textarea
          value={descSnippet}
          onChange={(e) => setDescSnippet(e.target.value)}
          placeholder="Description snippet"
          rows={2}
          className={inputClass}
        />
        <textarea
          value={jobSummary}
          onChange={(e) => setJobSummary(e.target.value)}
          placeholder="Job summary (AI-generated or manual)"
          rows={2}
          className={inputClass}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onUpdate({
                title: title || null,
                company: company || null,
                url: url || null,
                location: location || null,
                salary: salary || null,
                work_mode: workMode || null,
                job_family: jobFamily || null,
                description_snippet: descSnippet || null,
                job_summary: jobSummary || null,
              })
            }
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016]"
          >
            <Check size={14} strokeWidth={2} />
            Save
          </button>
          <button type="button" onClick={onCancel} className="rounded-full border border-[#2A3544] px-4 py-1.5 text-[12px] text-[#9CA3AF]">
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#DC2626]/30 px-3 py-1.5 text-[12px] text-[#DC2626] hover:bg-[#DC2626]/10"
          >
            <Trash2 size={14} strokeWidth={2} />
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border bg-[#171F28] p-4 transition ${
        isSelected
          ? "border-[#6AD7A3]/40 bg-[#6AD7A3]/5"
          : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onSelect}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            isSelected ? "border-[#6AD7A3] bg-[#6AD7A3] text-[#0C1016]" : "border-[#4B5563]"
          }`}
        >
          {isSelected && (
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold leading-tight">{job.title || "Untitled"}</h3>
              <p className="mt-0.5 text-[12px] text-[#9CA3AF]">{job.company || "Unknown Company"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="rounded-lg p-1.5 text-[#6B7280] transition hover:bg-[#6AD7A3]/10 hover:text-[#6AD7A3]"
                title="Edit"
              >
                <Pencil size={16} strokeWidth={2} />
              </button>
              <button
                onClick={onDelete}
                className="rounded-lg p-1.5 text-[#6B7280] transition hover:bg-[#DC2626]/10 hover:text-[#DC2626]"
                title="Delete"
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.salary && (
              <span className="max-w-[11rem] truncate rounded-full bg-[rgba(0,245,212,0.08)] px-2 py-0.5 text-[11px] text-white ring-1 ring-[rgba(0,245,212,0.2)]" title={job.salary}>
                {job.salary}
              </span>
            )}
            {job.location && (
              <span className="max-w-[10rem] truncate rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#B8BFC8] ring-1 ring-[#2A3544]" title={job.location}>
                {job.location}
              </span>
            )}
            {job.work_mode && (
              <span className="rounded-full bg-[#38BDF8]/10 px-2 py-0.5 text-[11px] text-[#38BDF8] ring-1 ring-[#38BDF8]/20">
                {job.work_mode}
              </span>
            )}
            <BoardPill url={job.url} source={job.source} />
            {job.job_family && (
              <span className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[11px] text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20">
                {job.job_family}
              </span>
            )}
            {/* Enrichment indicator */}
            {job.job_summary ? (
              <span className="rounded-full bg-[#A78BFA]/10 px-2 py-0.5 text-[11px] text-[#A78BFA] ring-1 ring-[#A78BFA]/20" title="AI enriched">
                <Sparkles size={10} className="mr-0.5 inline" strokeWidth={2} />
                enriched
              </span>
            ) : (
              <span className="rounded-full bg-[#FBBF24]/10 px-2 py-0.5 text-[11px] text-[#FBBF24] ring-1 ring-[#FBBF24]/20">
                raw
              </span>
            )}
            {/* Stale status badge */}
            {job.stale_status === "stale" && (
              <span
                className="rounded-full bg-[#FBBF24]/10 px-2 py-0.5 text-[11px] font-medium text-[#FBBF24] ring-1 ring-[#FBBF24]/20"
                title={job.stale_at ? `Stale since ${formatDate(job.stale_at)}` : "Stale"}
              >
                Stale
              </span>
            )}
            {job.stale_status === "archived" && (
              <span className="rounded-full bg-[#DC2626]/10 px-2 py-0.5 text-[11px] font-medium text-[#DC2626] ring-1 ring-[#DC2626]/20">
                Archived
              </span>
            )}
          </div>

          {job.job_summary && (
            <p className="mt-2 text-[12px] leading-relaxed text-[#9CA3AF] line-clamp-2">
              {job.job_summary}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#38BDF8] hover:underline"
              >
                View Listing
                <ExternalLink size={12} strokeWidth={2} />
              </a>
            )}
            <span className="text-[10px] text-[#4B5563]">
              Added {formatDate(job.created_at)}
            </span>
            {/* Quick stale actions */}
            {(job.stale_status === "stale" || job.stale_status === "archived") && (
              <button
                onClick={() => onStaleAction("keep")}
                className="ml-auto flex items-center gap-1 rounded-full border border-[#6AD7A3]/30 px-2 py-0.5 text-[10px] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
              >
                <RotateCcw size={10} strokeWidth={2} />
                Keep
              </button>
            )}
            {job.stale_status === "stale" && (
              <button
                onClick={() => onStaleAction("archive")}
                className="flex items-center gap-1 rounded-full border border-[#FBBF24]/30 px-2 py-0.5 text-[10px] font-medium text-[#FBBF24] hover:bg-[#FBBF24]/10"
              >
                <Archive size={10} strokeWidth={2} />
                Archive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddJobForm({
  lanes,
  onAdded,
  onError,
}: {
  lanes: LaneOption[];
  onAdded: () => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [jobFamily, setJobFamily] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputClass =
    "rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/admin/job-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || null,
        company: company || null,
        url: url || null,
        location: location || null,
        salary: salary || null,
        work_mode: workMode || null,
        job_family: jobFamily || null,
        source: "admin",
      }),
    });

    if (res.ok) {
      onAdded();
    } else {
      const data = await res.json().catch(() => ({}));
      onError(data.error ?? "Failed to add job");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[#6AD7A3]/30 bg-[#171F28] p-4">
      <h2 className="mb-3 text-sm font-semibold">Add to Job Bank</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job Title" className={inputClass} />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className={inputClass} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className={inputClass} />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className={inputClass} />
        <input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Salary (e.g. $80k-$120k)" className={inputClass} />
        <select value={workMode} onChange={(e) => setWorkMode(e.target.value)} className={inputClass}>
          <option value="">Work Mode</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>
        <select value={jobFamily} onChange={(e) => setJobFamily(e.target.value)} className={inputClass}>
          <option value="">Job Family / Lane</option>
          {lanes.map((l) => (
            <option key={l.lane_key} value={l.lane_key}>{l.role_name}</option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016] disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add Job"}
        </button>
      </div>
    </form>
  );
}
