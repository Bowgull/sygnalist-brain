"use client";

import { useState, useEffect } from "react";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
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

  if (!data) return <p className="text-[#9CA3AF]">Failed to load analytics.</p>;

  const profiles = data.profiles as { total: number; active_clients: number; locked: number; admins: number };
  const pipeline = data.pipeline as Record<string, number>;
  const fetches = data.fetches as { week: number; month: number };
  const errors = data.errors as { unresolved: number };

  const pipelineTotal = Object.values(pipeline).reduce((a, b) => a + b, 0);

  return (
    <div className="stagger-children space-y-4">
      <h1 className="text-lg font-semibold">Analytics Overview</h1>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Active Clients" value={profiles.active_clients} color="#6AD7A3" />
        <MetricCard label="Total Pipeline" value={pipelineTotal} color="#38BDF8" />
        <MetricCard label="Fetches (7d)" value={fetches.week} color="#FAD76A" />
        <MetricCard label="Errors" value={errors.unresolved} color={errors.unresolved > 0 ? "#DC2626" : "#6AD7A3"} />
      </div>

      {/* Pipeline breakdown */}
      <div className="glass-card p-4">
        <h2 className="mb-4 text-sm font-semibold">Pipeline Distribution</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {Object.entries(pipeline).map(([stage, count]) => (
            <div key={stage} className="text-center">
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-[11px] text-[#9CA3AF]">{stage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion funnel */}
      <div className="glass-card p-4">
        <h2 className="mb-4 text-sm font-semibold">Funnel</h2>
        {["Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer"].map((stage) => {
          const count = pipeline[stage] ?? 0;
          const pct = pipelineTotal > 0 ? Math.round((count / pipelineTotal) * 100) : 0;
          return (
            <div key={stage} className="mb-2 flex items-center gap-3">
              <span className="w-24 text-xs text-[#B8BFC8]">{stage}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-[#151C24]">
                <div
                  className="flex h-full items-center rounded-lg bg-gradient-to-r from-[#6AD7A3]/60 to-[#39D6FF]/60 px-2"
                  style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                >
                  {pct > 10 && (
                    <span className="text-[10px] font-medium text-white">{pct}%</span>
                  )}
                </div>
              </div>
              <span className="w-10 text-right text-xs font-medium text-white">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass-card p-4 text-center">
      <p className="text-3xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">{label}</p>
    </div>
  );
}
