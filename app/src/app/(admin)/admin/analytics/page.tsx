"use client";

import { useState, useEffect } from "react";
import StatRing from "@/components/ui/stat-ring";

const STAGE_COLORS: Record<string, string> = {
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

  // Active pipeline (exclude closed stages)
  const activePipeline = ["Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer"];
  const activeTotal = activePipeline.reduce((sum, s) => sum + (pipeline[s] ?? 0), 0);

  return (
    <div className="stagger-children space-y-4">
      <h1 className="text-lg font-semibold">Analytics Overview</h1>

      {/* Key metrics with rings */}
      <div className="glass-card relative overflow-hidden p-5">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#38BDF8]/20 blur-3xl" />
          <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-[#FAD76A]/15 blur-3xl" />
        </div>
        <div className="relative flex items-center justify-around gap-2">
          <StatRing value={profiles.active_clients} max={Math.max(profiles.total, 1)} label="Clients" color="#6AD7A3" size={72} />
          <StatRing value={activeTotal} max={Math.max(activeTotal, 10)} label="Pipeline" color="#38BDF8" size={72} />
          <StatRing value={fetches.week} max={Math.max(fetches.month, 1)} label="Fetches 7d" color="#FAD76A" size={72} />
          <StatRing value={errors.unresolved} max={Math.max(errors.unresolved, 5)} label="Errors" color={errors.unresolved > 0 ? "#DC2626" : "#6AD7A3"} size={72} />
        </div>
      </div>

      {/* Pipeline breakdown — visual bars with stage colors */}
      <div className="glass-card p-4">
        <h2 className="mb-4 text-sm font-semibold">Pipeline Distribution</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {Object.entries(pipeline).map(([stage, count]) => (
            <div key={stage} className="text-center">
              <p className="text-2xl font-bold" style={{ color: STAGE_COLORS[stage] ?? "#9CA3AF" }}>
                {count}
              </p>
              <p className="text-[11px] text-[#9CA3AF]">{stage}</p>
              {/* Mini bar indicator */}
              <div className="mx-auto mt-1.5 h-1 w-full max-w-[48px] overflow-hidden rounded-full bg-[#151C24]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pipelineTotal > 0 ? Math.max((count / pipelineTotal) * 100, count > 0 ? 10 : 0) : 0}%`,
                    backgroundColor: STAGE_COLORS[stage] ?? "#9CA3AF",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion funnel */}
      <div className="glass-card p-4">
        <h2 className="mb-4 text-sm font-semibold">Conversion Funnel</h2>
        {activePipeline.map((stage) => {
          const count = pipeline[stage] ?? 0;
          const pct = pipelineTotal > 0 ? Math.round((count / pipelineTotal) * 100) : 0;
          const color = STAGE_COLORS[stage] ?? "#9CA3AF";
          return (
            <div key={stage} className="mb-2 flex items-center gap-3">
              <span className="w-24 text-xs text-[#B8BFC8]">{stage}</span>
              <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-[#151C24]">
                <div
                  className="flex h-full items-center rounded-lg px-2 transition-all duration-700"
                  style={{
                    width: `${Math.max(pct, count > 0 ? 4 : 0)}%`,
                    backgroundColor: `${color}30`,
                    boxShadow: count > 0 ? `inset 0 0 12px ${color}20` : "none",
                  }}
                >
                  {pct > 10 && (
                    <span className="text-[10px] font-medium" style={{ color }}>{pct}%</span>
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
