"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, Section } from "@/components/design-system";

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

const FUNNEL_STAGES = ["Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer"];

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
          <div key={i} className="h-32 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <p className="text-[13px] text-[var(--ds-text-2)]">Failed to load analytics.</p>;
  }

  const profiles = data.profiles as {
    total: number;
    active_clients: number;
    locked: number;
    admins: number;
  };
  const pipeline = data.pipeline as Record<string, number>;
  const fetches = data.fetches as { week: number; month: number };
  const errors = data.errors as { unresolved: number };
  const pipelineTotal = Object.values(pipeline).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <Section eyebrow="Analytics · overview" title="Analytics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Active clients" value={profiles.active_clients} color="var(--ds-accent)" />
          <MetricCard label="Pipeline total" value={pipelineTotal} color="var(--ds-text-0)" />
          <MetricCard label="Fetches · 7d" value={fetches.week} color="var(--ds-signal)" />
          <MetricCard
            label="Open errors"
            value={errors.unresolved}
            color={errors.unresolved > 0 ? "var(--ds-err)" : "var(--ds-accent)"}
          />
        </div>
      </Section>

      <Section eyebrow="Pipeline" title="Distribution">
        <Card>
          <CardBody>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
              {Object.entries(pipeline).map(([stage, count]) => (
                <div key={stage} className="text-center">
                  <p className="font-[family-name:var(--font-ds-mono)] text-[22px] font-semibold tabular-nums text-[var(--ds-text-0)]">
                    {count}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-ds-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--ds-text-3)]">
                    {stage}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section eyebrow="Funnel" title="Conversion funnel">
        <Card>
          <CardBody>
            <div className="space-y-2.5">
              {FUNNEL_STAGES.map((stage) => {
                const count = pipeline[stage] ?? 0;
                const pct = pipelineTotal > 0 ? Math.round((count / pipelineTotal) * 100) : 0;
                const color = STAGE_COLOR[stage];
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
                    <div className="relative h-3 flex-1 overflow-hidden rounded-[var(--ds-radius-full)] bg-[var(--ds-bg-2)]">
                      <div
                        className="flex h-full items-center rounded-[var(--ds-radius-full)] px-2 transition-[width] duration-[var(--ds-duration-slow)]"
                        style={{
                          width: `${Math.max(pct, count > 0 ? 3 : 0)}%`,
                          backgroundColor: color,
                          opacity: 0.8,
                        }}
                      >
                        {pct >= 10 ? (
                          <span className="font-[family-name:var(--font-ds-mono)] text-[10px] font-semibold tabular-nums text-[var(--ds-bg-0)]">
                            {pct}%
                          </span>
                        ) : null}
                      </div>
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
