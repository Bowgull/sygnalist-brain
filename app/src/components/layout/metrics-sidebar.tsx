"use client";

import { useState, useEffect } from "react";

interface DashboardStats {
  inbox_count: number;
  tracker_total: number;
  prospect: number;
  applied: number;
  interview_1: number;
  interview_2: number;
  final: number;
  offer: number;
  rejected: number;
  ghosted: number;
  withdrawn: number;
  added_7d: number;
  admin?: {
    total_profiles: number;
    active_profiles: number;
    locked_profiles: number;
    unresolved_errors: number;
  };
}

interface MetricDef {
  label: string;
  key: string;
  color: string;
  icon: string;
}

const CLIENT_METRICS: MetricDef[] = [
  { label: "Open Signals", key: "inbox_count", color: "#6AD7A3", icon: "radar" },
  { label: "In Tracker", key: "tracker_total", color: "#1DD3B0", icon: "target" },
  { label: "Applied", key: "applied", color: "#3B82F6", icon: "send" },
  { label: "Interviewing", key: "interviewing", color: "#8B5CF6", icon: "mic" },
  { label: "Added This Week", key: "added_7d", color: "#FFFFFF", icon: "plus" },
];

const ADMIN_METRICS: MetricDef[] = [
  { label: "Profiles", key: "total_profiles", color: "#B8BFC8", icon: "users" },
  { label: "Errors", key: "unresolved_errors", color: "#DC2626", icon: "alert" },
];

function MetricIcon({ icon, color }: { icon: string; color: string }) {
  const style = {
    color,
    backgroundColor: `${color}15`,
    borderLeft: `2px solid ${color}`,
    boxShadow: `0 0 12px ${color}20`,
  };

  return (
    <div className="flex h-6 w-6 items-center justify-center rounded" style={style}>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
        {icon === "radar" && (
          <>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 8L12 5" strokeLinecap="round" />
            <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
          </>
        )}
        {icon === "target" && (
          <>
            <circle cx="8" cy="8" r="5.5" />
            <circle cx="8" cy="8" r="2.5" />
            <circle cx="8" cy="8" r="0.8" fill="currentColor" stroke="none" />
          </>
        )}
        {icon === "send" && <path d="M3 8h10M10 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />}
        {icon === "mic" && <><path d="M8 2v8M5 7a3 3 0 006 0" strokeLinecap="round" /><path d="M6 13h4" strokeLinecap="round" /></>}
        {icon === "plus" && <path d="M8 3v10M3 8h10" strokeLinecap="round" />}
        {icon === "users" && <><circle cx="6" cy="5" r="2" /><circle cx="11" cy="5" r="1.5" opacity="0.5" /><path d="M2 12c0-2 2-3 4-3s4 1 4 3" strokeLinecap="round" /></>}
        {icon === "alert" && <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3" strokeLinecap="round" /><circle cx="8" cy="10.5" r="0.5" fill="currentColor" stroke="none" /></>}
      </svg>
    </div>
  );
}

export default function MetricsSidebar() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, []);

  function getValue(key: string): number {
    if (!stats) return 0;
    if (key === "interviewing") return (stats.interview_1 ?? 0) + (stats.interview_2 ?? 0);
    if (key === "total_profiles") return stats.admin?.total_profiles ?? 0;
    if (key === "unresolved_errors") return stats.admin?.unresolved_errors ?? 0;
    return (stats as unknown as Record<string, number>)[key] ?? 0;
  }

  const metrics = stats?.admin
    ? [...CLIENT_METRICS, ...ADMIN_METRICS]
    : CLIENT_METRICS;

  return (
    <aside className="hidden md:flex flex-col gap-5 sticky top-[calc(var(--header-height)+var(--space-6))] max-h-[calc(100vh-var(--header-height)-var(--space-10))] overflow-y-auto w-[var(--sidebar-width)]">
      {metrics.map((m) => (
        <div
          key={m.key}
          className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 transition-shadow hover:shadow-[var(--shadow-elevated)] hover:border-[rgba(255,255,255,0.12)]"
        >
          <MetricIcon icon={m.icon} color={m.color} />
          <p className="mt-2 text-[0.9375rem] font-medium uppercase tracking-[0.04em] text-[#9CA3AF]">
            {m.label}
          </p>
          <p className="text-[2.25rem] font-bold leading-tight text-white">
            {stats ? getValue(m.key) : "—"}
          </p>
        </div>
      ))}
    </aside>
  );
}
