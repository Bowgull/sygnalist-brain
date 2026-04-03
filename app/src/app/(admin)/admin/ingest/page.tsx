"use client";

import { useState } from "react";

interface IngestResult {
  message: string;
  jobs_ingested: number;
}

interface FetchResult {
  ok: boolean;
  jobs_added?: number;
  sources?: { name: string; jobs: number; error?: string }[];
  error?: string;
}

export default function IngestPage() {
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);

  async function handleIngest() {
    setIngestLoading(true);
    setIngestResult(null);
    try {
      const res = await fetch("/api/admin/gmail-ingest", { method: "POST" });
      const data = await res.json();
      setIngestResult(data);
    } catch {
      setIngestResult({ message: "Ingest failed — check server logs", jobs_ingested: 0 });
    }
    setIngestLoading(false);
  }

  async function handleFetch() {
    setFetchLoading(true);
    setFetchResult(null);
    try {
      const res = await fetch("/api/fetch", { method: "POST" });
      const data = await res.json();
      setFetchResult({ ok: res.ok, ...data });
    } catch {
      setFetchResult({ ok: false, error: "Fetch pipeline failed" });
    }
    setFetchLoading(false);
  }

  return (
    <div className="stagger-children space-y-4">
      <h1 className="text-lg font-semibold">Ingest & Pipeline</h1>

      {/* Gmail Ingest */}
      <div className="glass-card p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DC2626]/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#DC2626]" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Gmail Ingest</h2>
            <p className="text-[11px] text-[#9CA3AF]">
              Pull jobs from emails labeled SYGN_INTAKE
            </p>
          </div>
        </div>

        <div className="mb-3 rounded-lg bg-[#151C24] p-3 text-[11px] text-[#9CA3AF]">
          <p className="font-medium text-[#B8BFC8]">Required env vars:</p>
          <code className="mt-1 block text-[#6AD7A3]">
            GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
          </code>
        </div>

        <button
          type="button"
          onClick={handleIngest}
          disabled={ingestLoading}
          className="btn-gradient rounded-full px-5 py-2 text-[12px] disabled:opacity-50"
        >
          {ingestLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0C1016] border-t-transparent" />
              Ingesting...
            </span>
          ) : (
            "Run Gmail Ingest"
          )}
        </button>

        {ingestResult && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${
            ingestResult.jobs_ingested > 0
              ? "bg-[#6AD7A3]/10 text-[#6AD7A3]"
              : "bg-[#151C24] text-[#B8BFC8]"
          }`}>
            <p className="font-medium">{ingestResult.message}</p>
            <p className="mt-1 text-[12px] opacity-80">
              {ingestResult.jobs_ingested} job{ingestResult.jobs_ingested !== 1 ? "s" : ""} ingested
            </p>
          </div>
        )}
      </div>

      {/* Fetch Pipeline */}
      <div className="glass-card p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6AD7A3]/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" opacity={0.4} />
              <path d="M12 12L18 8" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Fetch Pipeline</h2>
            <p className="text-[11px] text-[#9CA3AF]">
              Run the full fetch → score → enrich → inbox pipeline
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFetch}
          disabled={fetchLoading}
          className="btn-gradient rounded-full px-5 py-2 text-[12px] disabled:opacity-50"
        >
          {fetchLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0C1016] border-t-transparent" />
              Running Pipeline...
            </span>
          ) : (
            "Run Fetch Pipeline"
          )}
        </button>

        {fetchResult && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${
            fetchResult.ok
              ? "bg-[#6AD7A3]/10 text-[#6AD7A3]"
              : "bg-[#DC2626]/10 text-[#DC2626]"
          }`}>
            {fetchResult.ok ? (
              <>
                <p className="font-medium">
                  Pipeline complete — {fetchResult.jobs_added ?? 0} jobs added to inbox
                </p>
                {Array.isArray(fetchResult.sources) && fetchResult.sources.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {fetchResult.sources.map((s: { name: string; jobs: number; error?: string }) => (
                      <div key={s.name} className="flex items-center justify-between text-[12px]">
                        <span>{s.name}</span>
                        <span className={s.error ? "text-[#DC2626]" : ""}>
                          {s.error ? "Error" : `${s.jobs} jobs`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="font-medium">{fetchResult.error ?? "Pipeline failed"}</p>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="glass-card-flat p-4 text-[12px] text-[#9CA3AF]">
        <p className="mb-1 font-medium text-[#B8BFC8]">Automated Schedule</p>
        <p>Fetch runs Mon–Fri at 8:00 AM via Vercel Cron.</p>
        <p className="mt-1">Weekly digest emails send Mondays at 9:00 AM.</p>
      </div>
    </div>
  );
}
