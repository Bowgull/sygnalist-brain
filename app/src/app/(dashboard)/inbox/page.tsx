"use client";

import { useState, useEffect, useCallback } from "react";
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
    await fetch(`/api/inbox/${id}/promote`, { method: "POST" });
  }

  async function handleDismiss(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setTotal((prev) => prev - 1);
    await fetch(`/api/inbox/${id}/dismiss`, { method: "POST" });
  }

  return (
    <div>
      {/* Filter row */}
      <div className="sticky top-0 z-10 border-b border-[#2A3544] bg-[#151C24] px-4 md:px-6 py-2.5">
        <div className="flex items-center gap-4 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" opacity={0.4} />
              <path d="M12 12L18 8" strokeLinecap="round" />
            </svg>
            <span className="text-[#9CA3AF]">Open Sygnals</span>
            <span className="font-semibold text-white">{total}</span>
          </div>

          {/* Lane filter pills */}
          {lanes.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {["All", ...lanes].map((lane) => (
                <button
                  key={lane}
                  type="button"
                  onClick={() => setActiveLane(lane)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-[0.6875rem] font-medium transition-colors ${
                    activeLane === lane
                      ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                      : "bg-[#171F28] text-[#9CA3AF] ring-1 ring-[#2A3544] hover:text-[#B8BFC8]"
                  }`}
                >
                  {lane}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Job list */}
      <div className="space-y-3 md:space-y-4 p-3 md:p-6">
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
              Check back after the next run.
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
    </div>
  );
}
