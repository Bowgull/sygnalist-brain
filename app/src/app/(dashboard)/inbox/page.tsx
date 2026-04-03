"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import JobCard from "@/components/inbox/job-card";
import SkeletonCard from "@/components/inbox/skeleton-card";
import type { Database } from "@/types/database";

type InboxJob = Database["public"]["Tables"]["inbox_jobs"]["Row"];

export default function InboxPage() {
  const [jobs, setJobs] = useState<InboxJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLane, setActiveLane] = useState("All");
  const [lanes, setLanes] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const supabase = createClient();

  const fetchJobs = useCallback(
    async (lane: string) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "50" });
      if (lane !== "All") params.set("lane", lane);

      const res = await fetch(`/api/inbox?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs ?? []);
        setTotal(data.total ?? 0);

        // Extract unique lanes from jobs
        if (lane === "All" && data.jobs) {
          const uniqueLanes = [
            ...new Set(
              data.jobs
                .map((j: InboxJob) => j.lane_label)
                .filter(Boolean) as string[]
            ),
          ];
          setLanes(uniqueLanes);
        }
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    fetchJobs(activeLane);
  }, [activeLane, fetchJobs]);

  async function handlePromote(id: string) {
    const res = await fetch(`/api/inbox/${id}/promote`, { method: "POST" });
    if (res.ok) {
      // Optimistic: keep card visible but show "In Tracker" state
    }
  }

  async function handleDismiss(id: string) {
    // Optimistic remove
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setTotal((prev) => prev - 1);

    await fetch(`/api/inbox/${id}/dismiss`, { method: "POST" });
  }

  async function handleFetch() {
    setLoading(true);
    await fetch("/api/fetch", { method: "POST" });
    // Refresh inbox after fetch
    await fetchJobs(activeLane);
  }

  return (
    <div className="relative">
      {/* Stat bar */}
      <div className="border-b border-[#2A3544] px-4 py-2">
        <div className="flex items-center gap-4 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" opacity={0.4} />
              <path d="M12 12L18 8" strokeLinecap="round" />
            </svg>
            <span className="text-[#9CA3AF]">Open Sygnals</span>
            <span className="font-semibold text-white">{total}</span>
          </div>
        </div>
      </div>

      {/* Lane filters */}
      {lanes.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2.5 scrollbar-none">
          {["All", ...lanes].map((lane) => (
            <button
              key={lane}
              type="button"
              onClick={() => setActiveLane(lane)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                activeLane === lane
                  ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                  : "bg-[#151C24] text-[#9CA3AF] ring-1 ring-[#2A3544] hover:text-[#B8BFC8]"
              }`}
            >
              {lane}
            </button>
          ))}
        </div>
      )}

      {/* Job list */}
      <div className="stagger-children mx-auto max-w-2xl space-y-3 px-4 py-3 lg:px-0">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg viewBox="0 0 64 64" className="mb-4 h-12 w-12 text-[#2A3544]">
              <circle cx="32" cy="32" r="17" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="32" cy="32" r="4" fill="currentColor" opacity="0.3" />
              <path d="M32 32 L49 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
            </svg>
            <p className="text-sm font-medium text-[#B8BFC8]">No fresh sygnals yet</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Run Scan or check back after the next run.
            </p>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPromote={handlePromote}
              onDismiss={handleDismiss}
            />
          ))
        )}
      </div>

      {/* Floating Action Button — Fetch */}
      <button
        type="button"
        onClick={handleFetch}
        disabled={loading}
        className="btn-press animate-pulse-glow fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] shadow-lg shadow-[#6AD7A3]/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 lg:bottom-8 lg:right-8"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#0C1016]" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" opacity={0.4} />
          <path d="M12 12L18 8" strokeLinecap="round" />
          <circle cx="18" cy="8" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>
  );
}
