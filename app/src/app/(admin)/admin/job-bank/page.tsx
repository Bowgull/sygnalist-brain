"use client";

import { useState, useEffect } from "react";

interface JobBankEntry {
  id: string;
  title: string | null;
  company: string | null;
  url: string | null;
  source: string | null;
  location: string | null;
  work_mode: string | null;
  job_family: string | null;
  description_snippet: string | null;
  job_summary: string | null;
  created_at: string;
}

export default function AdminJobBankPage() {
  const [jobs, setJobs] = useState<JobBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    const res = await fetch("/api/admin/job-bank");
    if (res.ok) setJobs(await res.json());
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/job-bank?id=${id}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  const filtered = search
    ? jobs.filter(
        (j) =>
          (j.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (j.company ?? "").toLowerCase().includes(search.toLowerCase()),
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
        <h1 className="text-lg font-semibold">Job Bank ({jobs.length})</h1>
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
          placeholder="Search job bank..."
          className="w-full rounded-xl border border-[#2A3544] bg-[#171F28] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]"
        />
      </div>

      {/* Add form */}
      {showAdd && <AddJobForm onAdded={() => { loadJobs(); setShowAdd(false); }} />}

      {/* Jobs grid */}
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
            Jobs get added here when promoted from the inbox
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 transition hover:border-[rgba(255,255,255,0.15)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold leading-tight">{job.title || "Untitled"}</h3>
                  <p className="mt-0.5 text-[12px] text-[#9CA3AF]">{job.company || "Unknown Company"}</p>
                </div>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="rounded-lg p-1.5 text-[#6B7280] transition hover:bg-[#DC2626]/10 hover:text-[#DC2626]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
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
          ))}
        </div>
      )}
    </div>
  );
}

function AddJobForm({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        work_mode: workMode || null,
      }),
    });

    if (res.ok) onAdded();
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[#6AD7A3]/30 bg-[#171F28] p-4">
      <h2 className="mb-3 text-sm font-semibold">Add to Job Bank</h2>
      <div className="grid grid-cols-2 gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job Title" className="rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]" />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className="rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]" />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]" />
        <select value={workMode} onChange={(e) => setWorkMode(e.target.value)} className="rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]">
          <option value="">Work Mode</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016] disabled:opacity-50">
          {submitting ? "Adding..." : "Add Job"}
        </button>
      </div>
    </form>
  );
}
