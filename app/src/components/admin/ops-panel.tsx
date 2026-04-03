"use client";

import { useState, useEffect } from "react";

interface HealthStatus {
  status: string;
  database: { connected: boolean; latency_ms?: number; error?: string };
  timestamp: string;
}

export default function OpsPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);

  useEffect(() => {
    checkHealth();
  }, []);

  async function checkHealth() {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/admin/health");
      if (res.ok) setHealth(await res.json());
    } catch {
      setHealth({ status: "error", database: { connected: false, error: "fetch failed" }, timestamp: new Date().toISOString() });
    }
    setHealthLoading(false);
  }

  async function triggerIngest() {
    setIngestLoading(true);
    setIngestResult(null);
    try {
      const res = await fetch("/api/admin/gmail-ingest", { method: "POST" });
      const data = await res.json();
      setIngestResult(data.message ?? `Ingested ${data.jobs_ingested} jobs`);
    } catch {
      setIngestResult("Ingest request failed");
    }
    setIngestLoading(false);
  }

  return (
    <div className="p-4 space-y-6">
      {/* System Health */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">System Health</h3>
          <button
            type="button"
            onClick={checkHealth}
            disabled={healthLoading}
            className="flex items-center gap-1 rounded-full bg-[#171F28] px-3 py-1.5 text-[0.6875rem] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20 hover:bg-[#6AD7A3]/10 disabled:opacity-50"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 8A6 6 0 112 8" strokeLinecap="round" />
              <path d="M2 8A6 6 0 0114 8" strokeLinecap="round" strokeDasharray="2 3" />
              <path d="M14 2v4h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4">
          {healthLoading ? (
            <div className="h-16 animate-pulse rounded-lg" />
          ) : health ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${health.status === "healthy" ? "bg-[#6AD7A3] shadow-[0_0_8px_rgba(106,215,163,0.5)]" : "bg-[#DC2626] shadow-[0_0_8px_rgba(220,38,38,0.5)]"}`} />
                <span className="text-[0.9375rem] font-semibold text-white uppercase">{health.status}</span>
                <span className="text-[0.75rem] tabular-nums text-[#9CA3AF]">{new Date(health.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="flex gap-4 text-[0.8125rem]">
                <span className="text-[#B8BFC8]">
                  Database: {health.database.connected ? (
                    <span className="text-[#6AD7A3]">Connected ({health.database.latency_ms}ms)</span>
                  ) : (
                    <span className="text-[#DC2626]">{health.database.error || "Disconnected"}</span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[0.8125rem] text-[#DC2626]">Health check failed</p>
          )}
        </div>
      </div>

      {/* Gmail Ingest */}
      <div>
        <h3 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Gmail Ingest</h3>
        <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 space-y-3">
          <p className="text-[0.8125rem] text-[#B8BFC8]">
            Trigger email ingest to scan for new job postings from newsletter subscriptions.
          </p>
          <button
            type="button"
            onClick={triggerIngest}
            disabled={ingestLoading}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] px-4 text-[0.8125rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.1)] disabled:opacity-50"
          >
            {ingestLoading ? "Running..." : "Run Ingest"}
          </button>
          {ingestResult && (
            <p className="text-[0.8125rem] text-[#6AD7A3]">{ingestResult}</p>
          )}
        </div>
      </div>
    </div>
  );
}
