"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, Section } from "@/components/design-system";

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

const PIPELINE_STAGES = [
  "Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer",
  "Rejected", "Ghosted", "Withdrawn",
];

const STAGE_COLOR: Record<string, string> = {
  Prospect: "#1DD3B0",
  Applied: "#3B82F6",
  "Interview 1": "#8B5CF6",
  "Interview 2": "#8B5CF6",
  Final: "#F59E0B",
  Offer: "#22C55E",
  Rejected: "#DC2626",
  Ghosted: "#6B7280",
  Withdrawn: "#6B7280",
};

export default function AdminOpsPage() {
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
          ))}
        </div>
        <div className="h-32 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
        <div className="h-48 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
      </div>
    );
  }

  const pipelineTotal = Object.values(analytics?.pipeline ?? {}).reduce((a, b) => a + b, 0);
  const errorCount = analytics?.errors.unresolved ?? 0;
  const dbConnected = health?.database.connected ?? false;

  return (
    <div className="space-y-8">
      {/* Key metrics */}
      <Section eyebrow="Ops · overview" title="System at a glance">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Active clients"
            value={analytics?.profiles.active_clients ?? 0}
            color="var(--ds-accent)"
          />
          <MetricCard
            label="Pipeline total"
            value={pipelineTotal}
            color="var(--ds-text-0)"
          />
          <MetricCard
            label="Fetches · 7d"
            value={analytics?.fetches.week ?? 0}
            color="var(--ds-signal)"
          />
          <MetricCard
            label="Open errors"
            value={errorCount}
            color={errorCount > 0 ? "var(--ds-err)" : "var(--ds-accent)"}
          />
        </div>
      </Section>

      {/* System health */}
      <Section eyebrow="Health" title="System health">
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-4">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    health?.status === "healthy" ? "var(--ds-ok)" : "var(--ds-err)",
                }}
                aria-hidden
              />
              <span className="text-[13px] text-[var(--ds-text-1)]">
                {health?.status === "healthy" ? "All systems operational" : "Degraded"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <StatBox
                label="Database"
                value={dbConnected ? "Connected" : "Down"}
                tone={dbConnected ? "ok" : "err"}
              />
              <StatBox
                label="DB latency"
                value={health?.database.latency_ms ? `${health.database.latency_ms}ms` : "—"}
                tone="neutral"
              />
              <StatBox
                label="Open errors"
                value={String(errorCount)}
                tone={errorCount > 0 ? "err" : "ok"}
              />
              <StatBox
                label="Last check"
                value={
                  health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "—"
                }
                tone="neutral"
              />
            </div>
          </CardBody>
        </Card>
      </Section>

      {/* Profiles */}
      <Section eyebrow="Profiles" title="Who's in the system">
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <StatBox label="Total" value={String(analytics?.profiles.total ?? 0)} tone="neutral" />
              <StatBox
                label="Active clients"
                value={String(analytics?.profiles.active_clients ?? 0)}
                tone="ok"
              />
              <StatBox
                label="Locked"
                value={String(analytics?.profiles.locked ?? 0)}
                tone={analytics?.profiles.locked ? "err" : "neutral"}
              />
              <StatBox label="Admins" value={String(analytics?.profiles.admins ?? 0)} tone="neutral" />
            </div>
          </CardBody>
        </Card>
      </Section>

      {/* Pipeline */}
      <Section eyebrow="Pipeline" title={`${pipelineTotal} entries across stages`}>
        <Card>
          <CardBody>
            <div className="space-y-2">
              {PIPELINE_STAGES.map((stage) => {
                const count = analytics?.pipeline[stage] ?? 0;
                const pct = pipelineTotal > 0 ? (count / pipelineTotal) * 100 : 0;
                const color = STAGE_COLOR[stage] ?? "var(--ds-text-2)";
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-28 shrink-0">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span className="text-[12px] text-[var(--ds-text-1)]">{stage}</span>
                    </div>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-[var(--ds-radius-full)] bg-[var(--ds-bg-2)]">
                      <div
                        className="h-full rounded-[var(--ds-radius-full)] transition-[width] duration-[var(--ds-duration-slow)]"
                        style={{
                          width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                          backgroundColor: color,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right font-[family-name:var(--font-ds-mono)] text-[12px] tabular-nums text-[var(--ds-text-1)]">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </Section>

      {/* Fetch activity */}
      <Section eyebrow="Scans" title="Fetch activity">
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 gap-5">
              <StatBox
                label="This week"
                value={String(analytics?.fetches.week ?? 0)}
                tone="neutral"
              />
              <StatBox
                label="This month"
                value={String(analytics?.fetches.month ?? 0)}
                tone="neutral"
              />
            </div>
          </CardBody>
        </Card>
      </Section>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardBody>
        <p
          className="font-[family-name:var(--font-ds-mono)] text-[28px] md:text-[32px] font-semibold tabular-nums leading-none"
          style={{ color }}
        >
          {value}
        </p>
        <p className="mt-2 font-[family-name:var(--font-ds-mono)] text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-3)]">
          {label}
        </p>
      </CardBody>
    </Card>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "err" | "neutral";
}) {
  const color =
    tone === "ok"
      ? "var(--ds-ok)"
      : tone === "err"
        ? "var(--ds-err)"
        : "var(--ds-text-0)";

  return (
    <div>
      <p className="font-[family-name:var(--font-ds-mono)] text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-3)]">
        {label}
      </p>
      <p
        className="mt-1 font-[family-name:var(--font-ds-mono)] text-[17px] font-semibold tabular-nums"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
