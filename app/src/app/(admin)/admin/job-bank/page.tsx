"use client";

import { useState, useEffect } from "react";

interface JobBankEntry {
  id: string;
  url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  salary: string | null;
  work_mode: string | null;
  source: string;
  created_at: string;
}

export default function JobBankPage() {
  const [jobs, setJobs] = useState<JobBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    const res = await fetch("/api/admin/job-bank?limit=100");
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }

  async function handleDelete(url: string) {
    const res = await fetch("/api/admin/job-bank", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.url !== url));
      setTotal((prev) => prev - 1);
    }
  }

  async function handleAdd(job: { url: string; title?: string; company?: string; location?: string }) {
    const res = await fetch("/api/admin/job-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs: [{ ...job, source: "admin" }] }),
    });
    if (res.ok) {
      setShowAdd(false);
      loadJobs();
    }
  }

  const filtered = search
    ? jobs.filter((j) =>
        [j.title, j.company, j.location, j.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Job Bank ({total})</h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="btn-gradient rounded-full px-3 py-1.5 text-[12px]"
        >
          + Add Job
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search jobs..."
        className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
      />

      {/* Add form */}
      {showAdd && <AddJobForm onAdd={handleAdd} onClose={() => setShowAdd(false)} />}

      {/* Job list */}
      <div className="stagger-children space-y-2">
        {filtered.length === 0 ? (
          <div className="glass-card flex flex-col items-center py-16 text-center">
            <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="2" y="3" width="20" height="18" rx="3" />
              <line x1="8" y1="9" x2="16" y2="9" />
              <line x1="8" y1="13" x2="12" y2="13" />
            </svg>
            <p className="text-sm text-[#B8BFC8]">No jobs in the bank yet</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">Add jobs manually or run an ingest</p>
          </div>
        ) : (
          filtered.map((job) => (
            <div key={job.id ?? job.url} className="glass-card-flat p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14px] font-semibold text-white">
                    {job.title || "Untitled"}
                  </h3>
                  <p className="truncate text-[12px] text-[#B8BFC8]">
                    {job.company || "Unknown company"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {job.location && (
                      <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[10px] text-[#B8BFC8] ring-1 ring-[#2A3544]">
                        {job.location}
                      </span>
                    )}
                    {job.work_mode && (
                      <span className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[10px] text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20">
                        {job.work_mode}
                      </span>
                    )}
                    {job.salary && (
                      <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[10px] text-[#B8BFC8] ring-1 ring-[#2A3544]">
                        {job.salary}
                      </span>
                    )}
                    <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[10px] text-[#9CA3AF] ring-1 ring-[#2A3544]">
                      {job.source}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-[#2A3544] px-2 py-1 text-[10px] text-[#B8BFC8] hover:border-[#6AD7A3]/50"
                    >
                      View
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(job.url)}
                    className="rounded-full border border-[#DC2626]/20 px-2 py-1 text-[10px] text-[#DC2626] hover:bg-[#DC2626]/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddJobForm({
  onAdd,
  onClose,
}: {
  onAdd: (job: { url: string; title?: string; company?: string; location?: string }) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");

  return (
    <div className="glass-card glow-green-soft p-4">
      <h2 className="mb-3 text-sm font-semibold">Add Job to Bank</h2>
      <div className="space-y-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="Job URL *"
          className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (!url) return;
              onAdd({ url, title: title || undefined, company: company || undefined, location: location || undefined });
            }}
            className="btn-gradient rounded-full px-4 py-1.5 text-[12px]"
          >
            Add
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-[#2A3544] px-4 py-1.5 text-[12px] text-[#9CA3AF]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
