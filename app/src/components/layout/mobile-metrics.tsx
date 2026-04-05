"use client";

import { useState, useEffect } from "react";

interface Stats {
  inbox_count: number;
  tracker_total: number;
  applied: number;
  interview_1: number;
  interview_2: number;
  added_7d: number;
}

const metrics = [
  { label: "Signals", key: "inbox_count", color: "#6AD7A3" },
  { label: "Tracked", key: "tracker_total", color: "#1DD3B0" },
  { label: "Applied", key: "applied", color: "#3B82F6" },
  { label: "Interview", key: "interviewing", color: "#8B5CF6" },
  { label: "This Week", key: "added_7d", color: "#FFFFFF" },
];

export default function MobileMetrics() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, []);

  function getValue(key: string): number {
    if (!stats) return 0;
    if (key === "interviewing") return (stats.interview_1 ?? 0) + (stats.interview_2 ?? 0);
    return (stats as unknown as Record<string, number>)[key] ?? 0;
  }

  return (
    <div className="md:hidden border-b border-[#2A3544]/50 bg-[#0C1016]">
      <div className="flex items-center gap-4 overflow-x-auto px-4 py-2 scrollbar-none">
        {metrics.map((m) => (
          <div key={m.key} className="flex items-center gap-1.5 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.color }} />
            <span className="text-[0.6875rem] text-[#9CA3AF]">{m.label}</span>
            <span className="text-[0.8125rem] font-bold tabular-nums" style={{ color: m.color }}>
              {stats ? getValue(m.key) : "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
