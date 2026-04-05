"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Radar, Target, Send, Mic, Plus, Users, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  icon: LucideIcon;
  href: string;
}

const CLIENT_METRICS: MetricDef[] = [
  { label: "Open Signals", key: "inbox_count", color: "#6AD7A3", icon: Radar, href: "/inbox" },
  { label: "In Tracker", key: "tracker_total", color: "#1DD3B0", icon: Target, href: "/tracker" },
  { label: "Applied", key: "applied", color: "#3B82F6", icon: Send, href: "/tracker" },
  { label: "Interviewing", key: "interviewing", color: "#8B5CF6", icon: Mic, href: "/tracker" },
  { label: "Added This Week", key: "added_7d", color: "#FFFFFF", icon: Plus, href: "/inbox" },
];

const ADMIN_METRICS: MetricDef[] = [
  { label: "Profiles", key: "total_profiles", color: "#B8BFC8", icon: Users, href: "/admin/clients" },
  { label: "Errors", key: "unresolved_errors", color: "#DC2626", icon: AlertTriangle, href: "/admin/logs" },
];

function MetricIcon({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  const style = {
    color,
    backgroundColor: `${color}15`,
    borderLeft: `2px solid ${color}`,
    boxShadow: `0 0 12px ${color}20`,
  };

  return (
    <div className="flex h-6 w-6 items-center justify-center rounded" style={style}>
      <Icon size={14} strokeWidth={2} />
    </div>
  );
}

export default function MetricsSidebar() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const router = useRouter();

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
        <button
          key={m.key}
          type="button"
          onClick={() => router.push(m.href)}
          className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 transition-all hover:shadow-[var(--shadow-elevated)] hover:border-[rgba(255,255,255,0.15)] hover:-translate-y-[1px] text-left cursor-pointer"
        >
          <MetricIcon icon={m.icon} color={m.color} />
          <p className="mt-2 text-[0.9375rem] font-medium uppercase tracking-[0.04em] text-[#9CA3AF]">
            {m.label}
          </p>
          <p className="text-[2.25rem] font-bold leading-tight text-white">
            {stats ? getValue(m.key) : "—"}
          </p>
        </button>
      ))}
    </aside>
  );
}
