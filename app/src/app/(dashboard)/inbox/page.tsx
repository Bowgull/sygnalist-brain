"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Plus } from "lucide-react";
import JobCard from "@/components/inbox-ds/job-card";
import SkeletonCard from "@/components/inbox-ds/skeleton-card";
import ManualAddDialog from "@/components/ui/manual-add-dialog";
import RadarMark from "@/components/inbox-ds/radar-mark";
import { Button, EmptyState } from "@/components/design-system";
import { useProfileLock } from "@/hooks/use-profile-lock";
import type { Database } from "@/types/database";

type InboxJob = Database["public"]["Tables"]["inbox_jobs"]["Row"];

export default function InboxPage() {
  const searchParams = useSearchParams();
  const viewAsId = searchParams.get("view_as");

  const [jobs, setJobs] = useState<InboxJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLane, setActiveLane] = useState("All");
  const [lanes, setLanes] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [scanning, setScanning] = useState(false);
  const { locked: profileLocked } = useProfileLock();
  const [showManualAdd, setShowManualAdd] = useState(false);

  const fetchJobs = useCallback(
    async (lane: string) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "50" });
      if (lane !== "All") params.set("lane", lane);

      const url = viewAsId
        ? `/api/admin/view-as/inbox?client_id=${viewAsId}&${params}`
        : `/api/inbox?${params}`;

      const res = await fetch(url);
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
    [viewAsId],
  );

  useEffect(() => {
    fetchJobs(activeLane);
  }, [activeLane, fetchJobs]);

  async function handleScan() {
    if (scanning || profileLocked) return;
    setScanning(true);
    try {
      const url = viewAsId ? `/api/admin/view-as/fetch?client_id=${viewAsId}` : "/api/fetch";
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const count = data.jobs_delivered ?? 0;
        const duration = ((data.duration_ms ?? 0) / 1000).toFixed(1);
        if (count > 0) {
          toast.success(`${count} fresh sygnal${count !== 1 ? "s" : ""}`, {
            description: `${data.total_raw ?? 0} scanned · ${data.after_dedupe ?? 0} unique · ${duration}s`,
            duration: 5000,
          });
        } else {
          toast(`Signal was quiet`, {
            description: `${data.total_raw ?? 0} scanned · nothing new · ${duration}s`,
            duration: 5000,
          });
        }
        fetchJobs(activeLane);
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Scan failed", { duration: 5000 });
      }
    } catch {
      toast.error("Scan failed — check your connection", { duration: 5000 });
    } finally {
      setScanning(false);
    }
  }

  async function handlePromote(id: string) {
    const prevJobs = jobs;
    const prevTotal = total;
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setTotal((prev) => prev - 1);
    const url = viewAsId
      ? `/api/admin/view-as/inbox/${id}/promote?client_id=${viewAsId}`
      : `/api/inbox/${id}/promote`;
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      toast.success("Added to Tracker");
    } else {
      setJobs(prevJobs);
      setTotal(prevTotal);
      if (res.status === 409) {
        toast.error("Already in Tracker");
      } else {
        toast.error(data?.error ?? "Failed to promote");
      }
    }
  }

  async function handleDismiss(id: string) {
    const prevJobs = jobs;
    const prevTotal = total;
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setTotal((prev) => prev - 1);
    const url = viewAsId
      ? `/api/admin/view-as/inbox/${id}/dismiss?client_id=${viewAsId}`
      : `/api/inbox/${id}/dismiss`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      setJobs(prevJobs);
      setTotal(prevTotal);
      toast.error("Failed to dismiss");
    }
  }

  async function handleManualAdd(data: {
    title: string;
    company: string;
    url?: string;
    location?: string;
    notes?: string;
    status?: string;
  }) {
    const url = viewAsId
      ? `/api/admin/view-as/tracker/manual-add?client_id=${viewAsId}`
      : "/api/tracker/manual-add";
    const res = await fetch(url, {
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
    <div className="font-[family-name:var(--font-ds-sans)] text-[var(--ds-text-1)]">
      {/* Filter row */}
      <div className="sticky top-0 z-10 border-b border-[var(--ds-border-1)] bg-[var(--ds-bg-1)] px-4 md:px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <RadarMark size={14} color="var(--ds-accent)" />
            <span className="text-[12px] text-[var(--ds-text-2)]">Open sygnals</span>
            <span className="font-[family-name:var(--font-ds-mono)] text-[12px] font-semibold text-[var(--ds-text-0)] tabular-nums">
              {total}
            </span>
          </div>

          {/* Lane filter pills */}
          {lanes.length > 0 ? (
            <div
              className="flex gap-1 overflow-x-auto scrollbar-none min-w-0"
              style={{
                maskImage: "linear-gradient(to right, black calc(100% - 24px), transparent)",
                WebkitMaskImage: "linear-gradient(to right, black calc(100% - 24px), transparent)",
              }}
            >
              {["All", ...lanes].map((lane) => {
                const isActive = activeLane === lane;
                return (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => setActiveLane(lane)}
                    className={[
                      "whitespace-nowrap rounded-[var(--ds-radius-full)] px-3 py-1 text-[12px] font-medium transition-colors",
                      isActive
                        ? "bg-[var(--ds-accent-soft)] text-[var(--ds-accent-bright)] ring-1 ring-inset ring-[rgba(132,191,160,0.35)]"
                        : "text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)] hover:bg-[var(--ds-bg-2)]",
                    ].join(" ")}
                  >
                    {lane}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={handleScan}
              disabled={scanning || profileLocked}
              title={profileLocked ? "Scan disabled (profile inactive)" : "Scan for new roles"}
              icon={<RadarMark size={14} color="currentColor" active={scanning} />}
            >
              {scanning ? "Scanning…" : "Scan"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchJobs(activeLane)}
              title="Refresh inbox"
              aria-label="Refresh inbox"
              icon={<RefreshCw size={14} strokeWidth={2} />}
            >
              <span className="sr-only">Refresh</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowManualAdd(true)}
              icon={<Plus size={14} strokeWidth={2} />}
            >
              Add
            </Button>
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
          <EmptyState
            icon={<RadarMark size={22} color="currentColor" />}
            title="No fresh sygnals yet"
            description={
              profileLocked
                ? "Your profile is inactive — contact your coach."
                : "Run a Scan to pull new roles from your lanes."
            }
            primaryAction={
              profileLocked
                ? undefined
                : {
                    label: scanning ? "Scanning…" : "Scan now",
                    icon: <RadarMark size={14} color="currentColor" active={scanning} />,
                    onClick: handleScan,
                  }
            }
          />
        ) : (
          jobs.map((job) => (
            <JobCard key={job.id} job={job} onPromote={handlePromote} onDismiss={handleDismiss} />
          ))
        )}
      </div>

      {showManualAdd && (
        <ManualAddDialog onClose={() => setShowManualAdd(false)} onSubmit={handleManualAdd} />
      )}
    </div>
  );
}
