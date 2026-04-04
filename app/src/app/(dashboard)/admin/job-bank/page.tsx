"use client";

import { useState, useEffect } from "react";

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
  created_at: string;
}

export default function AdminJobBankPage() {
  const [jobs, setJobs] = useState<JobBankEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadJobs() {
    setLoading(true);
    const res = await fetch("/api/admin/job-bank?limit=200");
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setTotal(data.total ?? 0);
    } else {
      showToast("Failed to load job bank");
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/job-bank?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setTotal((prev) => prev - 1);
      showToast("Job removed");
    } else {
      showToast("Failed to remove job");
    }
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

  const filtered = search
    ? jobs.filter(
        (j) =>
          (j.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (j.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (j.job_family ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : jobs;

  if (loading) {
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

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Job Bank ({total})</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-3 py-1.5 text-[12px] font-semibold text-[#0C1016]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Job
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, company, or job family..."
          className="w-full rounded-xl border border-[#2A3544] bg-[#171F28] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]"
        />
      </div>

      {/* Add form */}
      {showAdd && (
        <AddJobForm
          onAdded={() => {
            loadJobs();
            setShowAdd(false);
            showToast("Job added to bank");
          }}
          onError={(msg) => showToast(msg)}
        />
      )}

      {/* Jobs list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <p className="text-sm font-medium text-[#B8BFC8]">
            {search ? "No matching jobs" : "Job bank is empty"}
          </p>
          <p className="mt-1 text-[11px] text-[#6B7280]">
            Add jobs manually, via Gmail ingest, or through API fetch
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <JobBankCard
              key={job.id}
              job={job}
              isEditing={editing === job.id}
              onEdit={() => setEditing(editing === job.id ? null : job.id)}
              onUpdate={(patch) => handleUpdate(job.id, patch)}
              onDelete={() => handleDelete(job.id)}
              onCancel={() => setEditing(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobBankCard({
  job,
  isEditing,
  onEdit,
  onUpdate,
  onDelete,
  onCancel,
}: {
  job: JobBankEntry;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(job.title ?? "");
  const [company, setCompany] = useState(job.company ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [salary, setSalary] = useState(job.salary ?? "");
  const [workMode, setWorkMode] = useState(job.work_mode ?? "");
  const [jobFamily, setJobFamily] = useState(job.job_family ?? "");
  const [url, setUrl] = useState(job.url ?? "");
  const [descSnippet, setDescSnippet] = useState(job.description_snippet ?? "");

  const inputClass = "w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[0.8125rem] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]";

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-[#6AD7A3]/30 bg-[#171F28] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
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
          <input value={jobFamily} onChange={(e) => setJobFamily(e.target.value)} placeholder="Job Family / Lane" className={inputClass} />
        </div>
        <textarea
          value={descSnippet}
          onChange={(e) => setDescSnippet(e.target.value)}
          placeholder="Description snippet (manual entry)"
          rows={3}
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
              })
            }
            className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016]"
          >
            Save
          </button>
          <button type="button" onClick={onCancel} className="rounded-full border border-[#2A3544] px-4 py-1.5 text-[12px] text-[#9CA3AF]">
            Cancel
          </button>
          <button type="button" onClick={onDelete} className="ml-auto rounded-full border border-[#DC2626]/30 px-3 py-1.5 text-[12px] text-[#DC2626] hover:bg-[#DC2626]/10">
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 transition hover:border-[rgba(255,255,255,0.15)]">
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
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-[#6B7280] transition hover:bg-[#DC2626]/10 hover:text-[#DC2626]"
            title="Delete"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {job.salary && (
          <span className="rounded-full bg-[rgba(0,245,212,0.08)] px-2 py-0.5 text-[11px] text-white ring-1 ring-[rgba(0,245,212,0.2)]">
            {job.salary}
          </span>
        )}
        {job.location && (
          <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#B8BFC8] ring-1 ring-[#2A3544]">
            {job.location}
          </span>
        )}
        {job.work_mode && (
          <span className="rounded-full bg-[#38BDF8]/10 px-2 py-0.5 text-[11px] text-[#38BDF8] ring-1 ring-[#38BDF8]/20">
            {job.work_mode}
          </span>
        )}
        {job.source && (
          <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#6B7280] ring-1 ring-[#2A3544]">
            {job.source}
          </span>
        )}
        {job.job_family && (
          <span className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[11px] text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20">
            {job.job_family}
          </span>
        )}
      </div>

      {job.job_summary && (
        <p className="mt-2 text-[12px] leading-relaxed text-[#9CA3AF] line-clamp-2">
          {job.job_summary}
        </p>
      )}

      {job.url && (
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#38BDF8] hover:underline"
        >
          View Listing
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      )}
    </div>
  );
}

function AddJobForm({ onAdded, onError }: { onAdded: () => void; onError: (msg: string) => void }) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [jobFamily, setJobFamily] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputClass = "rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]";

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
      <div className="grid grid-cols-2 gap-3">
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
        <input value={jobFamily} onChange={(e) => setJobFamily(e.target.value)} placeholder="Job Family / Lane" className={inputClass} />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016] disabled:opacity-50">
          {submitting ? "Adding..." : "Add Job"}
        </button>
      </div>
    </form>
  );
}
