"use client";

import { useState, useEffect } from "react";

interface AnalyticsData {
  profiles: { total: number; active_clients: number; locked: number; admins: number };
  pipeline: Record<string, number>;
  fetches: { week: number; month: number };
  errors: { unresolved: number };
  latest_health: { statuses: unknown; created_at: string } | null;
}

const pipelineColors: Record<string, string> = {
  Prospect: "#1DD3B0",
  Applied: "#3B82F6",
  "Interview 1": "#8B5CF6",
  "Interview 2": "#8B5CF6",
  Final: "#F59E0B",
  Offer: "#22C55E",
  Rejected: "#DC2626",
  Ghosted: "#4B5563",
  Withdrawn: "#6B7280",
};

export default function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg" />)}</div>;
  }

  if (!data) {
    return <p className="py-10 text-center text-[0.8125rem] text-[#9CA3AF]">Failed to load analytics</p>;
  }

  const kpis = [
    { label: "Total Profiles", value: data.profiles.total, color: "#B8BFC8" },
    { label: "Active Clients", value: data.profiles.active_clients, color: "#6AD7A3" },
    { label: "Locked", value: data.profiles.locked, color: "#F59E0B" },
    { label: "Admins", value: data.profiles.admins, color: "#FAD76A" },
    { label: "Fetches (7d)", value: data.fetches.week, color: "#3B82F6" },
    { label: "Fetches (30d)", value: data.fetches.month, color: "#3B82F6" },
    { label: "Unresolved Errors", value: data.errors.unresolved, color: data.errors.unresolved > 0 ? "#DC2626" : "#6AD7A3" },
  ];

  const pipelineTotal = Object.values(data.pipeline).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 space-y-6">
      {/* KPI grid */}
      <div>
        <h3 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-[#9CA3AF]">{k.label}</p>
              <p className="mt-1 text-[1.75rem] font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline distribution */}
      <div>
        <h3 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
          Pipeline Distribution ({pipelineTotal} total)
        </h3>
        <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4">
          {/* Bar chart */}
          {pipelineTotal > 0 && (
            <div className="mb-4 flex h-3 overflow-hidden rounded-full">
              {Object.entries(data.pipeline).map(([status, count]) => (
                <div
                  key={status}
                  style={{
                    width: `${(count / pipelineTotal) * 100}%`,
                    backgroundColor: pipelineColors[status] ?? "#4B5563",
                  }}
                  title={`${status}: ${count}`}
                />
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {Object.entries(data.pipeline).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 text-[0.8125rem]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pipelineColors[status] ?? "#4B5563" }} />
                <span className="text-[#B8BFC8]">{status}</span>
                <span className="font-semibold tabular-nums text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Health snapshot */}
      {data.latest_health && (
        <div>
          <h3 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Latest Health Snapshot</h3>
          <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4">
            <p className="text-[0.75rem] tabular-nums text-[#9CA3AF]">
              {new Date(data.latest_health.created_at).toLocaleString()}
            </p>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[#151C24] p-3 text-[0.75rem] text-[#B8BFC8]">
              {JSON.stringify(data.latest_health.statuses, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
