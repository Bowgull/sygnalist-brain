"use client";

import { useState, useEffect } from "react";
import type { Database } from "@/types/database";

type Job = Database["public"]["Tables"]["global_job_bank"]["Row"];

export default function JobBankPanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/job-bank?limit=${limit}&offset=${offset}`)
      .then((r) => (r.ok ? r.json() : { jobs: [], total: 0 }))
      .then((data) => { setJobs(data.jobs ?? []); setTotal(data.total ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [offset]);

  async function handleRemove(url: string) {
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

  if (loading) {
    return <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2A3544] bg-[#151C24] px-4 py-2.5">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
          {total} jobs in bank
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="rounded px-2 py-1 text-[0.6875rem] text-[#9CA3AF] hover:text-white disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-[0.6875rem] tabular-nums text-[#9CA3AF]">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            className="rounded px-2 py-1 text-[0.6875rem] text-[#9CA3AF] hover:text-white disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b border-[#2A3544] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Location</th>
              <th className="px-4 py-2.5">Source</th>
              <th className="px-4 py-2.5">Work Mode</th>
              <th className="px-4 py-2.5">Added</th>
              <th className="px-4 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-[#2A3544]/50 hover:bg-[#222D3D]/30 transition-colors">
                <td className="px-4 py-2.5">
                  {j.url ? (
                    <a href={j.url} target="_blank" rel="noopener noreferrer" className="font-medium text-white hover:text-[#6AD7A3]">
                      {j.title || "Untitled"}
                    </a>
                  ) : (
                    <span className="text-white">{j.title || "Untitled"}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#B8BFC8]">{j.company || "—"}</td>
                <td className="px-4 py-2.5 text-[#B8BFC8]">{j.location || "—"}</td>
                <td className="px-4 py-2.5 text-[#9CA3AF]">{j.source || "—"}</td>
                <td className="px-4 py-2.5 text-[#9CA3AF]">{j.work_mode || "—"}</td>
                <td className="px-4 py-2.5 text-[0.75rem] tabular-nums text-[#9CA3AF]">
                  {new Date(j.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5">
                  {j.url && (
                    <button
                      type="button"
                      onClick={() => handleRemove(j.url!)}
                      className="rounded px-2 py-1 text-[0.6875rem] text-[#DC2626] hover:bg-[#DC2626]/10"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jobs.length === 0 && (
        <p className="py-10 text-center text-[0.8125rem] text-[#9CA3AF]">Job bank is empty</p>
      )}
    </div>
  );
}
