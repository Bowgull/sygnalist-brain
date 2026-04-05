"use client";

import { useState, useEffect } from "react";

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
    "Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer",
    "Rejected", "Ghosted", "Withdrawn",
  ];
  const pipelineTotal = Object.values(analytics?.pipeline ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Active Clients" value={analytics?.profiles.active_clients ?? 0} color="#6AD7A3" />
        <MetricCard label="Total Pipeline" value={pipelineTotal} color="#38BDF8" />
        <MetricCard label="Fetches (7d)" value={analytics?.fetches.week ?? 0} color="#FAD76A" />
        <MetricCard label="Errors" value={analytics?.errors.unresolved ?? 0} color={(analytics?.errors.unresolved ?? 0) > 0 ? "#DC2626" : "#6AD7A3"} />
      </div>

      {/* System Health */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <span
            className={`h-2.5 w-2.5 rounded-full ${health?.status === "healthy" ? "bg-[#6AD7A3]" : "bg-[#DC2626]"}`}
          />
          System Health
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <StatBox
            label="Database"
            value={health?.database.connected ? "Connected" : "Down"}
            color={health?.database.connected ? "green" : "red"}
          />
          <StatBox
            label="DB Latency"
            value={health?.database.latency_ms ? `${health.database.latency_ms}ms` : "-"}
            color="default"
          />
          <StatBox
            label="Unresolved Errors"
            value={String(analytics?.errors.unresolved ?? 0)}
            color={analytics?.errors.unresolved ? "red" : "green"}
          />
          <StatBox
            label="Last Check"
            value={health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "-"}
            color="default"
          />
        </div>
      </div>

      {/* Profile Overview */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4">
        <h2 className="mb-3 text-sm font-semibold">Profiles</h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <StatBox label="Total" value={String(analytics?.profiles.total ?? 0)} color="default" />
          <StatBox label="Active Clients" value={String(analytics?.profiles.active_clients ?? 0)} color="green" />
          <StatBox label="Locked" value={String(analytics?.profiles.locked ?? 0)} color={analytics?.profiles.locked ? "red" : "default"} />
          <StatBox label="Admins" value={String(analytics?.profiles.admins ?? 0)} color="default" />
        </div>
      </div>

      {/* Pipeline */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4">
        <h2 className="mb-3 text-sm font-semibold">Pipeline ({pipelineTotal} total)</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 mb-4">
          {pipelineStages.map((stage) => {
            const count = analytics?.pipeline[stage] ?? 0;
            return (
              <div key={`grid-${stage}`} className="text-center">
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-[11px] text-[#9CA3AF]">{stage}</p>
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          {pipelineStages.map((stage) => {
            const count = analytics?.pipeline[stage] ?? 0;
            const pct = pipelineTotal > 0 ? (count / pipelineTotal) * 100 : 0;
            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-24 text-xs text-[#B8BFC8]">{stage}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-[#151C24]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#6AD7A3] to-[#39D6FF]"
                    style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium text-white">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fetch Activity */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4">
        <h2 className="mb-3 text-sm font-semibold">Fetch Activity</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <StatBox label="This Week" value={String(analytics?.fetches.week ?? 0)} color="default" />
          <StatBox label="This Month" value={String(analytics?.fetches.month ?? 0)} color="default" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4 text-center">
      <p className="text-3xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">{label}</p>
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
