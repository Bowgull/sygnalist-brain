"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import EventRow from "@/components/logs/event-row";
import EventDetail from "@/components/logs/event-detail";
import ErrorRow from "@/components/logs/error-row";
import ErrorDetail from "@/components/logs/error-detail";
import FetchBatchGroup from "@/components/logs/fetch-batch-group";
import FetchSummaryStrip from "@/components/logs/fetch-summary-strip";
import LogFilterBar from "@/components/logs/log-filter-bar";
import { getDomainIcon, getSeverityIcon } from "@/components/logs/log-icons";
import { domainFromEventType, getDomainStyle, actionLabel, relativeTime, fullTime, getSeverityStyle, shortBatchId } from "@/components/logs/log-utils";

type LogType = "activity" | "errors" | "fetches";
type Filters = { domain?: string; severity?: string; success?: string; resolved?: string; search?: string };

export default function AdminLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial state from URL (accept "events" for backward compat)
  const rawTab = searchParams.get("tab") || "activity";
  const initialTab: LogType = rawTab === "events" ? "activity" : (rawTab as LogType);

  const [logType, setLogType] = useState<LogType>(initialTab);
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

  // Debounced filters for API calls
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(debounceRef.current);
  }, [filters]);

  // Request ID trace modal
  const [traceRequestId, setTraceRequestId] = useState<string | null>(null);
  const [traceLogs, setTraceLogs] = useState<Record<string, unknown>[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);

  // Highlight a specific batch (from Activity tab navigation)
  const [highlightBatchId, setHighlightBatchId] = useState<string | null>(null);

  // Batch context map for errors tab (request_id -> { profileName, batchId })
  const [batchContextMap, setBatchContextMap] = useState<Record<string, { profileName: string; batchId: string }>>({});

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

    // Map "activity" back to "events" for API
    const apiType = logType === "activity" ? "events" : logType;
    const params = new URLSearchParams({ type: apiType, limit: "100" });
    if (debouncedFilters.domain && logType === "activity") params.set("domain", debouncedFilters.domain);
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

  // ── Fetch batch context for errors tab ────────────────────────────────
  useEffect(() => {
    if (logType !== "errors") return;
    fetch("/api/admin/logs?type=fetches&limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const map: Record<string, { profileName: string; batchId: string }> = {};
        for (const row of data) {
          const reqId = row.request_id as string | null;
          const bId = row.batch_id as string | null;
          const pId = row.profile_id as string | null;
          if (reqId && bId && pId) {
            map[reqId] = { profileName: profileMap[pId] ?? "Unknown", batchId: bId };
          }
        }
        setBatchContextMap(map);
      })
      .catch(() => {});
  }, [logType, profileMap]);

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
    setHighlightBatchId(null);
    updateUrl(tab, {});
  }

  // ── Navigate from Activity to Fetches for a specific batch ────────────
  function navigateToFetchBatch() {
    setLogType("fetches");
    setHighlightBatchId(null);
    setFilters({});
    updateUrl("fetches", {});
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

  // ── Group consecutive events by event_type ────────────────────────────
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  function groupConsecutiveEvents(events: Record<string, unknown>[]) {
    const groups: Array<{ key: string; eventType: string; logs: Record<string, unknown>[] }> = [];
    for (const log of events) {
      const et = log.event_type as string;
      const last = groups[groups.length - 1];
      if (last && last.eventType === et) {
        last.logs.push(log);
      } else {
        groups.push({ key: log.id as string, eventType: et, logs: [log] });
      }
    }
    return groups;
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

  // ── Build batch data for summary strip ────────────────────────────────
  function buildBatchData(fetchLogs: Record<string, unknown>[]) {
    const { groups, standalone } = groupFetchesByBatch(fetchLogs);
    const batches: { batchId: string; logs: Record<string, unknown>[] }[] = [];
    for (const [batchId, batchLogs] of groups.entries()) {
      batches.push({ batchId, logs: batchLogs });
    }
    for (const log of standalone) {
      batches.push({ batchId: log.id as string, logs: [log] });
    }
    return batches;
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Tab pills */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {(["activity", "errors", "fetches"] as LogType[]).map((t) => (
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
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-[#171F28]" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[0.8125rem] text-[#9CA3AF]">No {logType} logs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* ── ACTIVITY TAB ── */}
          {logType === "activity" && (
            <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.06)] bg-[#171F28] overflow-hidden">
              {groupConsecutiveEvents(logs).map((group, groupIdx) => {
                const isFetchDomain = domainFromEventType(group.eventType) === "fetch" || domainFromEventType(group.eventType) === "cron";

                // Groups of 3+ collapse
                if (group.logs.length >= 3) {
                  const firstLog = group.logs[0];
                  const isGroupExpanded = expandedGroupId === group.key;
                  const domain = domainFromEventType(group.eventType);
                  const ds = getDomainStyle(group.eventType);
                  const DIcon = getDomainIcon(domain);
                  return (
                    <div key={group.key} className={groupIdx > 0 ? "border-t border-[#2A3544]/30" : ""}>
                      <button
                        type="button"
                        onClick={() => setExpandedGroupId(isGroupExpanded ? null : group.key)}
                        className="flex w-full items-center gap-2.5 px-5 py-3 text-left transition-colors hover:bg-[#222D3D]/20"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ds.dot }} />
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${ds.badge}`}>
                          <DIcon className="h-3 w-3" />
                          {ds.label}
                        </span>
                        <span className="text-[0.8125rem] capitalize text-[#B8BFC8]">{actionLabel(group.eventType)}</span>
                        <span className="rounded-full bg-[#2A3544] px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-[#9CA3AF]">
                          {group.logs.length}x
                        </span>
                        <span className="ml-auto text-[0.75rem] tabular-nums text-[#9CA3AF]">{relativeTime(firstLog.created_at as string)}</span>
                        <svg viewBox="0 0 24 24" className={`h-4 w-4 text-[#9CA3AF] transition-transform ${isGroupExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {isGroupExpanded && group.logs.map((log) => {
                        const id = log.id as string;
                        const isExpanded = expandedId === id;
                        return (
                          <div key={id} className="border-t border-[#2A3544]/20">
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
                    </div>
                  );
                }

                // Single or double events — render individually
                return group.logs.map((log, logIdx) => {
                  const id = log.id as string;
                  const isExpanded = expandedId === id;
                  const showBorder = groupIdx > 0 || logIdx > 0;

                  // Fetch/cron events get elevated card treatment
                  if (isFetchDomain) {
                    const success = log.success as boolean;
                    const meta = log.metadata as Record<string, unknown> | null;
                    const userId = log.user_id as string | null;
                    const userName = userId ? profileMap[userId] : null;
                    return (
                      <div key={id} className={showBorder ? "border-t border-[#2A3544]/30" : ""}>
                        <div
                          className="flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-[#222D3D]/20 bg-[#151C24]/40"
                          onClick={() => navigateToFetchBatch()}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${success ? "bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.3)]" : "bg-[#DC2626] shadow-[0_0_6px_rgba(220,38,38,0.4)]"}`} />
                          <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[#22C55E]/30 bg-[#22C55E]/10 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-[#22C55E]">
                            Fetch
                          </span>
                          <span className="text-[0.8125rem] font-medium capitalize text-white">{actionLabel(log.event_type as string)}</span>
                          {userName && <span className="text-[0.75rem] text-[#9CA3AF]">{userName}</span>}
                          {meta?.total_jobs != null && (
                            <span className="text-[0.75rem] font-semibold tabular-nums text-[#6AD7A3]">{String(meta.total_jobs)} jobs</span>
                          )}
                          {meta?.profiles_processed != null && (
                            <span className="text-[0.75rem] text-[#9CA3AF]">{String(meta.profiles_processed)} profiles</span>
                          )}
                          <span className="flex-1" />
                          <span className="shrink-0 text-[0.75rem] tabular-nums text-[#9CA3AF]">{relativeTime(log.created_at as string)}</span>
                          {/* Arrow to indicate navigation */}
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" fill="none" stroke="currentColor" strokeWidth={2}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>
                    );
                  }

                  // Standard event row
                  return (
                    <div key={id} className={showBorder ? "border-t border-[#2A3544]/30" : ""}>
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
                });
              })}
            </div>
          )}

          {/* ── ERRORS TAB ── */}
          {logType === "errors" && (
            <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.06)] bg-[#171F28] overflow-hidden">
              {logs.map((log, idx) => {
                const id = log.id as string;
                const isExpanded = expandedId === id;
                const reqId = log.request_id as string | null;
                const ctx = reqId ? batchContextMap[reqId] ?? null : null;
                return (
                  <div key={id} className={idx > 0 ? "border-t border-[#2A3544]/30" : ""}>
                    <ErrorRow
                      log={log}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedId(isExpanded ? null : id)}
                      batchContext={ctx}
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
            </div>
          )}

          {/* ── FETCHES TAB ── */}
          {logType === "fetches" && (() => {
            const { groups, standalone } = groupFetchesByBatch(logs);
            const allBatches = buildBatchData(logs);
            const batchEntries = Array.from(groups.entries());

            return (
              <>
                {/* Summary strip */}
                <FetchSummaryStrip batches={allBatches} />

                {/* Batch cards */}
                <div className="space-y-3">
                  {batchEntries.map(([batchId, batchLogs], idx) => (
                    <FetchBatchGroup
                      key={batchId}
                      batchId={batchId}
                      logs={batchLogs}
                      profileMap={profileMap}
                      isInitiallyExpanded={highlightBatchId ? batchId === highlightBatchId : idx === 0}
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
                </div>
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
            className="w-full max-w-lg rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-5 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[0.875rem] font-semibold text-white">Request Trace</h3>
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

            <p className="mb-4 font-mono text-[0.6875rem] text-[#38BDF8]">{traceRequestId}</p>

            {traceLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-[#0C1016]" />)}
              </div>
            ) : traceLogs.length === 0 ? (
              <p className="text-[0.8125rem] text-[#9CA3AF]">No logs found for this request</p>
            ) : (
              <div className="space-y-1.5">
                {traceLogs.map((tl) => {
                  const type = tl._type as string;
                  const ts = tl.created_at as string;

                  if (type === "event") {
                    const et = (tl.event_type as string) || "";
                    const d = domainFromEventType(et);
                    const ds = getDomainStyle(et);
                    const DIcon = getDomainIcon(d);
                    return (
                      <div key={tl.id as string} className="flex items-center gap-2 rounded-lg bg-[#0C1016]/60 px-3 py-2.5">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${(tl.success as boolean) ? "bg-[#22C55E]" : "bg-[#DC2626]"}`} />
                        <span className="shrink-0 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase text-[#38BDF8] border-[#38BDF8]/30 bg-[#38BDF8]/10">Event</span>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase ${ds.badge}`}>
                          <DIcon className="h-2.5 w-2.5" />
                          {ds.label}
                        </span>
                        <span className="text-[0.75rem] capitalize text-[#B8BFC8]">{actionLabel(et)}</span>
                        <span className="ml-auto text-[0.6875rem] tabular-nums text-[#9CA3AF]">{fullTime(ts)}</span>
                      </div>
                    );
                  }

                  if (type === "error") {
                    const sev = tl.severity as string;
                    const sevStyle = getSeverityStyle(sev);
                    const SevIcon = getSeverityIcon(sev);
                    return (
                      <div key={tl.id as string} className="flex items-center gap-2 rounded-lg bg-[#0C1016]/60 px-3 py-2.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#DC2626]" />
                        <span className="shrink-0 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase text-[#DC2626] border-[#DC2626]/30 bg-[#DC2626]/10">Error</span>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase ${sevStyle.badge}`}>
                          <SevIcon className="h-2.5 w-2.5" />
                          {sev}
                        </span>
                        <span className="min-w-0 truncate text-[0.75rem] text-[#B8BFC8]">{tl.message as string}</span>
                        <span className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{fullTime(ts)}</span>
                      </div>
                    );
                  }

                  // fetch
                  return (
                    <div key={tl.id as string} className="flex items-center gap-2 rounded-lg bg-[#0C1016]/60 px-3 py-2.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${(tl.success as boolean) ? "bg-[#22C55E]" : "bg-[#DC2626]"}`} />
                      <span className="shrink-0 rounded border px-1 py-0.5 text-[0.5625rem] font-semibold uppercase text-[#22C55E] border-[#22C55E]/30 bg-[#22C55E]/10">Fetch</span>
                      <span className="text-[0.75rem] text-[#B8BFC8]">{tl.source_name as string}</span>
                      <span className="text-[0.75rem] font-semibold tabular-nums text-white">{tl.jobs_returned as number} jobs</span>
                      <span className="ml-auto text-[0.6875rem] tabular-nums text-[#9CA3AF]">{fullTime(ts)}</span>
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
