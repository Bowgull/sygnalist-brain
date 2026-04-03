"use client";

import { useState, useEffect } from "react";
import StatRing from "@/components/ui/stat-ring";

interface HealthData {
  status: string;
  database: { connected: boolean; latency_ms?: number; error?: string };
  timestamp: string;
}

interface AnalyticsData {
  profiles: { total: number; active_clients: number; locked: number; admins: number };
  pipeline: Record<string, number>;
  fetches: { week: number; month: number };
  errors: { unresolved: number };
  latest_health: unknown;
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [h, a] = await Promise.all([
        fetch("/api/admin/health").then((r) => r.json()),
        fetch("/api/admin/analytics").then((r) => r.json()),
      ]);
      setHealth(h);
      setAnalytics(a);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#171F28]" />
        ))}
      </div>
    );
  }

  const pipelineStages = [
    { label: "Prospect", color: "#1DD3B0" },
    { label: "Applied", color: "#3B82F6" },
    { label: "Interview 1", color: "#8B5CF6" },
    { label: "Interview 2", color: "#8B5CF6" },
    { label: "Final", color: "#F59E0B" },
    { label: "Offer", color: "#22C55E" },
    { label: "Rejected", color: "#DC2626" },
    { label: "Ghosted", color: "#4B5563" },
    { label: "Withdrawn", color: "#6B7280" },
  ];
  const pipelineTotal = Object.values(analytics?.pipeline ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="stagger-children space-y-4">
      {/* Hero stats with gradient mesh */}
      <div className="glass-card relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-[#6AD7A3]/20 blur-3xl" />
          <div className="absolute -right-8 bottom-0 h-32 w-32 rounded-full bg-[#39D6FF]/15 blur-3xl" />
        </div>

        <div className="relative p-5">
          <div className="mb-4 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${health?.status === "healthy" ? "bg-[#6AD7A3] shadow-[0_0_8px_rgba(106,215,163,0.5)]" : "bg-[#DC2626]"}`}
            />
            <span className="text-sm font-semibold">
              {health?.status === "healthy" ? "All Systems Online" : "System Issues"}
            </span>
            <span className="ml-auto text-[11px] text-[#9CA3AF]">
              {health?.database.latency_ms ? `${health.database.latency_ms}ms` : ""}
            </span>
          </div>

          <div className="flex items-center justify-around gap-2">
            <StatRing
              value={analytics?.profiles.active_clients ?? 0}
              max={Math.max(analytics?.profiles.total ?? 1, 1)}
              label="Active"
              color="#6AD7A3"
              size={64}
            />
            <StatRing
              value={pipelineTotal}
              max={Math.max(pipelineTotal, 20)}
              label="Pipeline"
              color="#38BDF8"
              size={64}
            />
            <StatRing
              value={analytics?.fetches.week ?? 0}
              max={Math.max(analytics?.fetches.month ?? 1, 1)}
              label="Fetches"
              color="#FAD76A"
              size={64}
            />
            <StatRing
              value={analytics?.errors.unresolved ?? 0}
              max={Math.max(analytics?.errors.unresolved ?? 0, 5)}
              label="Errors"
              color={analytics?.errors.unresolved ? "#DC2626" : "#6AD7A3"}
              size={64}
            />
          </div>
        </div>
      </div>

      {/* Profile Overview */}
      <div className="glass-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Profiles</h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <StatBox label="Total" value={String(analytics?.profiles.total ?? 0)} color="default" />
          <StatBox label="Active Clients" value={String(analytics?.profiles.active_clients ?? 0)} color="green" />
          <StatBox label="Locked" value={String(analytics?.profiles.locked ?? 0)} color={analytics?.profiles.locked ? "red" : "default"} />
          <StatBox label="Admins" value={String(analytics?.profiles.admins ?? 0)} color="default" />
        </div>
      </div>

      {/* Pipeline */}
      <div className="glass-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Pipeline ({pipelineTotal} total)</h2>
        <div className="space-y-2">
          {pipelineStages.map((stage) => {
            const count = analytics?.pipeline[stage.label] ?? 0;
            const pct = pipelineTotal > 0 ? (count / pipelineTotal) * 100 : 0;
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="w-24 text-xs text-[#B8BFC8]">{stage.label}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-[#151C24]">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.max(pct, count > 0 ? 3 : 0)}%`,
                      backgroundColor: stage.color,
                      boxShadow: count > 0 ? `0 0 8px ${stage.color}40` : "none",
                    }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium text-white">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fetch Activity */}
      <div className="glass-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Fetch Activity</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <StatBox label="This Week" value={String(analytics?.fetches.week ?? 0)} color="default" />
          <StatBox label="This Month" value={String(analytics?.fetches.month ?? 0)} color="default" />
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "red" | "default";
}) {
  const valueColor =
    color === "green"
      ? "text-[#6AD7A3]"
      : color === "red"
        ? "text-[#DC2626]"
        : "text-white";

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}
