"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import EventRow from "@/components/logs/event-row";
import EventDetail from "@/components/logs/event-detail";
import ErrorRow from "@/components/logs/error-row";
import ErrorDetail from "@/components/logs/error-detail";
import FetchBatchGroup from "@/components/logs/fetch-batch-group";
import LogFilterBar from "@/components/logs/log-filter-bar";
import { getDomainIcon, getSeverityIcon } from "@/components/logs/log-icons";
import { domainFromEventType, getDomainStyle, actionLabel, relativeTime, fullTime, getSeverityStyle } from "@/components/logs/log-utils";

type LogType = "events" | "errors" | "fetches";
type Filters = { domain?: string; severity?: string; success?: string; resolved?: string; search?: string };

export default function AdminLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial state from URL
  const [logType, setLogType] = useState<LogType>((searchParams.get("tab") as LogType) || "events");
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    domain: searchParams.get("domain") ?? undefined,
    severity: searchParams.get("severity") ?? undefined,
    success: searchParams.get("success") ?? undefined,
    resolved: searchParams.get("resolved") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });

  // Debounced filters for API calls (avoids firing on every keystroke)
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(debounceRef.current);
  }, [filters]);

  // Request ID trace modal
  const [traceRequestId, setTraceRequestId] = useState<string | null>(null);
  const [traceLogs, setTraceLogs] = useState<Record<string, unknown>[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);

  // ── Persist filters in URL ────────────────────────────────────────────
  const updateUrl = useCallback((tab: LogType, f: Filters) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (f.domain) params.set("domain", f.domain);
    if (f.severity) params.set("severity", f.severity);
    if (f.success) params.set("success", f.success);
    if (f.resolved) params.set("resolved", f.resolved);
    if (f.search) params.set("search", f.search);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router]);

  // ── Fetch logs ────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setExpandedId(null);

    const params = new URLSearchParams({ type: logType, limit: "100" });
    if (debouncedFilters.domain && logType === "events") params.set("domain", debouncedFilters.domain);
    if (debouncedFilters.success && logType !== "errors") params.set("success", debouncedFilters.success);
    if (debouncedFilters.severity && logType === "errors") params.set("severity", debouncedFilters.severity);
    if (debouncedFilters.resolved && logType === "errors") params.set("resolved", debouncedFilters.resolved);
    if (debouncedFilters.search) params.set("search", debouncedFilters.search);

    fetch(`/api/admin/logs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (logType === "errors") {
          setLogs(Array.isArray(data.logs) ? data.logs : []);
          setUnresolvedCount(data.unresolved_count ?? 0);
        } else {
          setLogs(Array.isArray(data) ? data : []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [logType, debouncedFilters]);

  // ── Fetch profile names ───────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/profiles")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          for (const p of data) {
            if (p.id && p.display_name) map[p.id] = p.display_name;
          }
          setProfileMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // ── Tab change ────────────────────────────────────────────────────────
  function handleTabChange(tab: LogType) {
    setLogType(tab);
    setFilters({});
    updateUrl(tab, {});
  }

  // ── Filter change ─────────────────────────────────────────────────────
  function handleFilterChange(f: Filters) {
    setFilters(f);
    updateUrl(logType, f);
  }

  // ── Resolve error ─────────────────────────────────────────────────────
  async function handleResolve(errorId: string, note?: string) {
    const res = await fetch("/api/admin/logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error_id: errorId, resolve_note: note }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLogs((prev) => prev.map((l) => (l.id === errorId ? updated : l)));
      setUnresolvedCount((c) => Math.max(0, c - 1));
    }
  }

  // ── Request ID trace ──────────────────────────────────────────────────
  function handleTraceRequest(requestId: string) {
    setTraceRequestId(requestId);
    setTraceLoading(true);
    fetch(`/api/admin/logs?request_id=${requestId}`)
      .then((r) => r.json())
      .then((data) => {
        setTraceLogs(Array.isArray(data) ? data : []);
        setTraceLoading(false);
      })
      .catch(() => setTraceLoading(false));
  }

  // ── Group fetches by batch_id ─────────────────────────────────────────
  function groupFetchesByBatch(fetchLogs: Record<string, unknown>[]) {
    const groups: Map<string, Record<string, unknown>[]> = new Map();
    const standalone: Record<string, unknown>[] = [];
    for (const log of fetchLogs) {
      const batchId = log.batch_id as string | null;
      if (batchId) {
        if (!groups.has(batchId)) groups.set(batchId, []);
        groups.get(batchId)!.push(log);
      } else {
        standalone.push(log);
      }
    }
    return { groups, standalone };
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Tab pills */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {(["events", "errors", "fetches"] as LogType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTabChange(t)}
            className={`relative shrink-0 rounded-full px-3 py-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
              logType === t
                ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                : "text-[#9CA3AF] hover:text-[#B8BFC8]"
            }`}
          >
            {t}
            {/* Unresolved badge on errors tab */}
            {t === "errors" && unresolvedCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[0.5625rem] font-bold tabular-nums text-white">
                {unresolvedCount}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{logs.length} entries</span>
      </div>

      {/* Filter bar */}
      <LogFilterBar logType={logType} filters={filters} onFilterChange={handleFilterChange} />

      {/* Loading */}
      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#171F28]" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[0.8125rem] text-[#9CA3AF]">No {logType} logs found</p>
        </div>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.06)] bg-[#171F28] overflow-hidden divide-y divide-[#2A3544]/40">
          {/* ── EVENTS TAB ── */}
          {logType === "events" && logs.map((log) => {
            const id = log.id as string;
            const isExpanded = expandedId === id;
            return (
              <div key={id}>
                <EventRow
                  log={log}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : id)}
                  profileMap={profileMap}
                />
                {isExpanded && (
                  <EventDetail
                    log={log}
                    profileMap={profileMap}
                    onTraceRequest={handleTraceRequest}
                  />
                )}
              </div>
            );
          })}

          {/* ── ERRORS TAB ── */}
          {logType === "errors" && logs.map((log) => {
            const id = log.id as string;
            const isExpanded = expandedId === id;
            return (
              <div key={id}>
                <ErrorRow
                  log={log}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : id)}
                />
                {isExpanded && (
                  <ErrorDetail
                    log={log}
                    profileMap={profileMap}
                    onTraceRequest={handleTraceRequest}
                    onResolve={handleResolve}
                  />
                )}
              </div>
            );
          })}

          {/* ── FETCHES TAB ── */}
          {logType === "fetches" && (() => {
            const { groups, standalone } = groupFetchesByBatch(logs);
            return (
              <>
                {Array.from(groups.entries()).map(([batchId, batchLogs]) => (
                  <FetchBatchGroup
                    key={batchId}
                    batchId={batchId}
                    logs={batchLogs}
                    profileMap={profileMap}
                  />
                ))}
                {/* Standalone fetch rows (no batch_id) */}
                {standalone.map((log) => (
                  <FetchBatchGroup
                    key={log.id as string}
                    batchId={log.id as string}
                    logs={[log]}
                    profileMap={profileMap}
                  />
                ))}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Request ID Trace Modal ── */}
      {traceRequestId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setTraceRequestId(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[0.8125rem] font-semibold text-white">Request Trace</h3>
              <button
                type="button"
                onClick={() => setTraceRequestId(null)}
                className="text-[#9CA3AF] hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="mb-3 font-mono text-[0.625rem] text-[#38BDF8]">{traceRequestId}</p>

            {traceLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-[#0C1016]" />)}
              </div>
            ) : traceLogs.length === 0 ? (
              <p className="text-[0.8125rem] text-[#9CA3AF]">No logs found for this request</p>
            ) : (
              <div className="space-y-1">
                {traceLogs.map((tl) => {
                  const type = tl._type as string;
                  const ts = tl.created_at as string;

                  if (type === "event") {
                    const et = (tl.event_type as string) || "";
                    const d = domainFromEventType(et);
                    const ds = getDomainStyle(et);
                    const DIcon = getDomainIcon(d);
                    return (
                      <div key={tl.id as string} className="flex items-center gap-2 rounded-lg bg-[#0C1016]/60 px-3 py-2">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${(tl.success as boolean) ? "bg-[#22C55E]" : "bg-[#DC2626]"}`} />
                        <span className="shrink-0 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase text-[#38BDF8] border-[#38BDF8]/30 bg-[#38BDF8]/10">Event</span>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase ${ds.badge}`}>
                          <DIcon className="h-2.5 w-2.5" />
                          {ds.label}
                        </span>
                        <span className="text-[0.6875rem] capitalize text-[#B8BFC8]">{actionLabel(et)}</span>
                        <span className="ml-auto text-[0.625rem] tabular-nums text-[#9CA3AF]">{fullTime(ts)}</span>
                      </div>
                    );
                  }

                  if (type === "error") {
                    const sev = tl.severity as string;
                    const sevStyle = getSeverityStyle(sev);
                    const SevIcon = getSeverityIcon(sev);
                    return (
                      <div key={tl.id as string} className="flex items-center gap-2 rounded-lg bg-[#0C1016]/60 px-3 py-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#DC2626]" />
                        <span className="shrink-0 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase text-[#DC2626] border-[#DC2626]/30 bg-[#DC2626]/10">Error</span>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase ${sevStyle.badge}`}>
                          <SevIcon className="h-2.5 w-2.5" />
                          {sev}
                        </span>
                        <span className="min-w-0 truncate text-[0.6875rem] text-[#B8BFC8]">{tl.message as string}</span>
                        <span className="ml-auto shrink-0 text-[0.625rem] tabular-nums text-[#9CA3AF]">{fullTime(ts)}</span>
                      </div>
                    );
                  }

                  // fetch
                  return (
                    <div key={tl.id as string} className="flex items-center gap-2 rounded-lg bg-[#0C1016]/60 px-3 py-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${(tl.success as boolean) ? "bg-[#22C55E]" : "bg-[#DC2626]"}`} />
                      <span className="shrink-0 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase text-[#22C55E] border-[#22C55E]/30 bg-[#22C55E]/10">Fetch</span>
                      <span className="text-[0.6875rem] text-[#B8BFC8]">{tl.source_name as string}</span>
                      <span className="text-[0.6875rem] font-semibold tabular-nums text-white">{tl.jobs_returned as number} jobs</span>
                      <span className="ml-auto text-[0.625rem] tabular-nums text-[#9CA3AF]">{fullTime(ts)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
