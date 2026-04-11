"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

/* ------------------------------------------------------------------ */
/*  Custom SVG icons                                                    */
/* ------------------------------------------------------------------ */

function IconRadarSweep() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" opacity="0.35" />
      <circle cx="10" cy="10" r="5" opacity="0.55" />
      <circle cx="10" cy="10" r="2" />
      <line x1="10" y1="10" x2="16" y2="4" />
    </svg>
  );
}

function IconCrosshair() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
      <line x1="10" y1="2" x2="10" y2="5" />
      <line x1="10" y1="15" x2="10" y2="18" />
      <line x1="2" y1="10" x2="5" y2="10" />
      <line x1="15" y1="10" x2="18" y2="10" />
    </svg>
  );
}

function IconArrowLaunch() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="17" x2="17" y2="17" />
      <polyline points="7 11 12 4 17 4" />
      <polyline points="13 8 17 4 17 8" />
      <line x1="12" y1="4" x2="5" y2="13" opacity="0.4" />
    </svg>
  );
}

function IconSpeechBubbles() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7l-3 2.5V12H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M14 8h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v2.5L13 16h-2" opacity="0.55" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v4M10 14v4M2 10h4M14 10h4" />
      <path d="M4.5 4.5l2.5 2.5M13 13l2.5 2.5M15.5 4.5l-2.5 2.5M7 13l-2.5 2.5" opacity="0.5" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPersonArc() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="7" r="3" />
      <path d="M4 18v-1a6 6 0 0 1 12 0v1" />
      <path d="M14.5 3.5a6 6 0 0 1 0 7" opacity="0.45" />
      <path d="M17 2a9 9 0 0 1 0 10" opacity="0.25" />
    </svg>
  );
}

function IconBrokenSignal() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14l3-4 2.5 3" />
      <path d="M12.5 9L15 6l3 4" opacity="0.5" />
      <line x1="8" y1="11" x2="11" y2="11" strokeDasharray="1.5 2" opacity="0.35" />
      <circle cx="10" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.FC> = {
  radar_sweep: IconRadarSweep,
  crosshair: IconCrosshair,
  arrow_launch: IconArrowLaunch,
  speech_bubbles: IconSpeechBubbles,
  sparkle: IconSparkle,
  person_arc: IconPersonArc,
  broken_signal: IconBrokenSignal,
};

/* ------------------------------------------------------------------ */
/*  Types & metric definitions                                         */
/* ------------------------------------------------------------------ */

interface MetricDef {
  label: string;
  key: string;
  color: string;
  icon: string;
  href: string;
}

const CLIENT_METRICS: MetricDef[] = [
  { label: "Open Signals", key: "inbox_count", color: "#6AD7A3", icon: "radar_sweep", href: "/inbox" },
  { label: "In Tracker", key: "tracker_total", color: "#1DD3B0", icon: "crosshair", href: "/tracker" },
  { label: "Applied", key: "applied", color: "#3B82F6", icon: "arrow_launch", href: "/tracker?status=applied" },
  { label: "Interviewing", key: "interviewing", color: "#8B5CF6", icon: "speech_bubbles", href: "/tracker?status=interviewing" },
  { label: "Added This Week", key: "added_7d", color: "#FFFFFF", icon: "sparkle", href: "/inbox" },
];

const ADMIN_METRICS: MetricDef[] = [
  { label: "Profiles", key: "total_profiles", color: "#B8BFC8", icon: "person_arc", href: "/admin/clients" },
  { label: "Errors", key: "unresolved_errors", color: "#DC2626", icon: "broken_signal", href: "/admin/logs" },
];

/* ------------------------------------------------------------------ */
/*  MetricIcon                                                         */
/* ------------------------------------------------------------------ */

function MetricIcon({ icon, color }: { icon: string; color: string }) {
  const IconComponent = ICON_MAP[icon];
  if (!IconComponent) return null;

  const style = {
    color,
    backgroundColor: `${color}15`,
    borderLeft: `2px solid ${color}`,
    boxShadow: `0 0 12px ${color}20`,
  };

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded" style={style}>
      <IconComponent />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
            {stats ? getValue(m.key) : "-"}
          </p>
        </button>
      ))}
    </aside>
  );
}
