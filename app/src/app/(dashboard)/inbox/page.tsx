"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import JobCard from "@/components/inbox/job-card";
import SkeletonCard from "@/components/inbox/skeleton-card";
import ManualAddDialog from "@/components/ui/manual-add-dialog";
import type { Database } from "@/types/database";

type InboxJob = Database["public"]["Tables"]["inbox_jobs"]["Row"];

export default function InboxPage() {
  const [jobs, setJobs] = useState<InboxJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLane, setActiveLane] = useState("All");
  const [lanes, setLanes] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [profileLocked, setProfileLocked] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);

  // Check profile status on mount
  useEffect(() => {
    fetch("/api/profile").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setProfileLocked(data.status === "inactive_soft_locked");
      }
    });
  }, []);

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

  async function handleScan() {
    if (scanning || profileLocked) return;
    setScanning(true);
    try {
      const res = await fetch("/api/fetch", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const count = data.jobs_delivered ?? 0;
        toast.success(`${count} new role${count !== 1 ? "s" : ""} found`, {
          description: `${data.total_raw ?? 0} scanned, ${data.after_dedupe ?? 0} unique, ${count} delivered (${((data.duration_ms ?? 0) / 1000).toFixed(1)}s)`,
        });
        fetchJobs(activeLane);
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Scan failed");
      }
    } catch {
      toast.error("Scan failed — check your connection");
    } finally {
      setScanning(false);
    }
  }

  async function handlePromote(id: string) {
    const res = await fetch(`/api/inbox/${id}/promote`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      toast.success("Added to Tracker");
    } else if (res.status === 409) {
      toast.error("Already in Tracker");
    } else {
      toast.error(data?.error ?? "Failed to promote");
    }
  }

  async function handleDismiss(id: string) {
    const prevJobs = jobs;
    const prevTotal = total;
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setTotal((prev) => prev - 1);
    const res = await fetch(`/api/inbox/${id}/dismiss`, { method: "POST" });
    if (!res.ok) {
      setJobs(prevJobs);
      setTotal(prevTotal);
      toast.error("Failed to dismiss");
    }
  }

  async function handleManualAdd(data: { title: string; company: string; url?: string; location?: string; notes?: string; status?: string }) {
    const res = await fetch("/api/tracker/manual-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowManualAdd(false);
      toast.success("Added to Tracker");
    } else if (res.status === 409) {
      toast.error("Job with this URL already tracked");
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error ?? "Failed to add");
    }
  }

  return (
    <div>
      {/* Filter row */}
      <div className="sticky top-0 z-10 border-b border-[#2A3544] bg-[#151C24] px-4 md:px-6 py-2.5">
        <div className="flex items-center gap-4 text-xs">
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

          {/* Action buttons */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning || profileLocked}
              title={profileLocked ? "Scan disabled (profile inactive)" : "Scan for new roles"}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold transition-all ${
                scanning
                  ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                  : profileLocked
                    ? "opacity-40 cursor-not-allowed text-[#9CA3AF] ring-1 ring-[#2A3544]"
                    : "text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30 hover:bg-[#6AD7A3]/10"
              }`}
            >
              <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="8.5" opacity={0.35} />
                <circle cx="12" cy="12" r="4.5" opacity={0.55} />
                <path d="M12 12L19 9" strokeLinecap="round" opacity={0.9} />
              </svg>
              {scanning ? "Scanning..." : "Scan"}
            </button>

            <button
              type="button"
              onClick={() => fetchJobs(activeLane)}
              title="Refresh inbox"
              className="flex items-center justify-center rounded-full p-1.5 text-[#9CA3AF] ring-1 ring-[#2A3544] hover:text-[#B8BFC8] hover:bg-[#171F28]"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12a9 9 0 11-2.2-5.9" strokeLinecap="round" />
                <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setShowManualAdd(true)}
              className="flex items-center gap-1 rounded-full bg-[#171F28] px-3 py-1.5 text-[0.6875rem] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20 hover:bg-[#6AD7A3]/10"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
              Add
            </button>
          </div>
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
              {profileLocked ? "Your profile is inactive — contact your coach." : "Scan now to search for new roles."}
            </p>
            {!profileLocked && (
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning}
                className="mt-4 flex items-center gap-2 rounded-full border border-[#6AD7A3]/30 bg-[#6AD7A3]/10 px-5 py-2 text-sm font-semibold text-[#6AD7A3] transition-all hover:bg-[#6AD7A3]/15"
              >
                <svg viewBox="0 0 24 24" className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="8.5" opacity={0.35} />
                  <circle cx="12" cy="12" r="4.5" opacity={0.55} />
                  <path d="M12 12L19 9" strokeLinecap="round" opacity={0.9} />
                </svg>
                {scanning ? "Scanning..." : "Scan Now"}
              </button>
            )}
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

      {showManualAdd && <ManualAddDialog onClose={() => setShowManualAdd(false)} onSubmit={handleManualAdd} />}
    </div>
  );
}
