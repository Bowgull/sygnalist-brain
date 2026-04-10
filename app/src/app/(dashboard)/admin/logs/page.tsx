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
import TicketsPanel from "@/components/logs/tickets-panel";
import TicketPickerModal from "@/components/logs/ticket-picker-modal";
import { getDomainIcon, getSeverityIcon } from "@/components/logs/log-icons";
import { domainFromEventType, getDomainStyle, actionLabel, relativeTime, fullTime, getSeverityStyle, shortBatchId } from "@/components/logs/log-utils";
import { toast } from "sonner";

type LogType = "activity" | "errors" | "fetches" | "tickets";
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

  // Selection mode for creating/linking tickets
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showTicketPicker, setShowTicketPicker] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (logType === "tickets") { setLoading(false); return; }
    setLoading(true);
    setExpandedId(null);
    exitSelectionMode();

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

  // ── Bulk resolve (for error groups) ────────────────────────────────────
  async function handleBulkResolve(errorIds: string[], note?: string) {
    const results = await Promise.all(
      errorIds.map((id) =>
        fetch("/api/admin/logs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error_id: id, resolve_note: note }),
        }).then((r) => r.ok ? r.json() : null)
      )
    );
    setLogs((prev) =>
      prev.map((l) => {
        const updated = results.find((r) => r && r.id === l.id);
        return updated ?? l;
      })
    );
    setUnresolvedCount((c) => Math.max(0, c - results.filter(Boolean).length));
  }

  // ── Smart grouping for Activity tab ────────────────────────────────────
  // Priority: request_id → user_id + 60s window → domain + 60s window
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const TIME_WINDOW = 60_000; // 60 seconds

  type ActivityGroup = {
    key: string;
    domain: string;
    logs: Record<string, unknown>[];
    userId: string | null;
    requestId: string | null;
  };

  function groupActivityEvents(events: Record<string, unknown>[]): ActivityGroup[] {
    const groups: ActivityGroup[] = [];
    const used = new Set<string>();

    // Pass 1: group by request_id (strongest link)
    const byReqId = new Map<string, Record<string, unknown>[]>();
    for (const log of events) {
      const rid = log.request_id as string | null;
      if (rid) {
        if (!byReqId.has(rid)) byReqId.set(rid, []);
        byReqId.get(rid)!.push(log);
      }
    }
    for (const [rid, logs] of byReqId.entries()) {
      if (logs.length < 2) continue; // single events with request_id fall through to pass 2
      const sorted = logs.sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime());
      const domain = domainFromEventType(sorted[0].event_type as string);
      const userId = sorted[0].user_id as string | null;
      groups.push({ key: sorted[0].id as string, domain, logs: sorted, userId, requestId: rid });
      for (const l of sorted) used.add(l.id as string);
    }

    // Pass 2: remaining events → group by user_id + domain + 60s time window
    const remaining = events.filter((e) => !used.has(e.id as string));
    let i = 0;
    while (i < remaining.length) {
      const log = remaining[i];
      const domain = domainFromEventType(log.event_type as string);
      const userId = log.user_id as string | null;
      const ts = new Date(log.created_at as string).getTime();
      const batch: Record<string, unknown>[] = [log];

      let j = i + 1;
      while (j < remaining.length) {
        const next = remaining[j];
        const nextDomain = domainFromEventType(next.event_type as string);
        const nextUserId = next.user_id as string | null;
        const nextTs = new Date(next.created_at as string).getTime();
        // Same domain + same user (or both null) + within time window
        if (nextDomain === domain && nextUserId === userId && Math.abs(nextTs - ts) <= TIME_WINDOW) {
          batch.push(next);
          j++;
        } else {
          break;
        }
      }
      groups.push({ key: log.id as string, domain, logs: batch, userId, requestId: log.request_id as string | null });
      i = j;
    }

    // Sort groups by most recent event timestamp (descending)
    groups.sort((a, b) => {
      const aTime = new Date(a.logs[0].created_at as string).getTime();
      const bTime = new Date(b.logs[0].created_at as string).getTime();
      return bTime - aTime;
    });

    return groups;
  }

  /** Build summary text for a group */
  function groupSummary(group: ActivityGroup): string {
    const actions = [...new Set(group.logs.map((l) => actionLabel(l.event_type as string)))];
    if (group.domain === "fetch" || group.domain === "cron") {
      const allSuccess = group.logs.every((l) => l.success as boolean);
      return allSuccess ? "Pipeline complete" : "Pipeline (with errors)";
    }
    if (actions.length === 1) return actions[0];
    if (actions.length <= 3) return actions.join(", ");
    return `${actions.slice(0, 2).join(", ")} +${actions.length - 2} more`;
  }

  // ── Smart grouping for Errors tab ──────────────────────────────────────
  const [expandedErrorGroupId, setExpandedErrorGroupId] = useState<string | null>(null);
  const [bulkResolveGroupId, setBulkResolveGroupId] = useState<string | null>(null);
  const [bulkNoteText, setBulkNoteText] = useState("");

  type ErrorGroup = {
    key: string;
    sourceSystem: string;
    message: string;
    severity: string;
    resolved: boolean;
    logs: Record<string, unknown>[];
  };

  const SEVERITY_RANK: Record<string, number> = { critical: 4, error: 3, warning: 2, info: 1 };

  function groupErrorLogs(errors: Record<string, unknown>[]): ErrorGroup[] {
    const map = new Map<string, ErrorGroup>();

    for (const log of errors) {
      const src = (log.source_system as string) || "";
      const msg = (log.message as string) || "";
      const resolved = log.resolved as boolean;
      const key = `${src}||${msg}||${resolved}`;
      const sev = (log.severity as string) || "info";

      if (!map.has(key)) {
        map.set(key, {
          key: log.id as string,
          sourceSystem: src,
          message: msg,
          severity: sev,
          resolved,
          logs: [],
        });
      }
      const group = map.get(key)!;
      group.logs.push(log);
      // Track highest severity
      if ((SEVERITY_RANK[sev] ?? 0) > (SEVERITY_RANK[group.severity] ?? 0)) {
        group.severity = sev;
      }
    }

    // Sort each group's logs by created_at descending (newest first)
    for (const group of map.values()) {
      group.logs.sort((a, b) =>
        new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      );
    }

    // Sort groups: unresolved first, then by most-recent timestamp descending
    const groups = Array.from(map.values());
    groups.sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      const aTime = new Date(a.logs[0].created_at as string).getTime();
      const bTime = new Date(b.logs[0].created_at as string).getTime();
      return bTime - aTime;
    });

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

  // ── Selection mode helpers ─────────────────────────────────────────────
  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectGroup(ids: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function handleItemLongPress(id: string) {
    if (selectionMode) return;
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }

  async function createTicketFromSelection() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const isErrorTab = logType === "errors";

    const body: Record<string, unknown> = {
      title: `${isErrorTab ? "Error" : "Activity"} group (${ids.length} items)`,
      source: isErrorTab ? "error" : "activity",
    };
    if (isErrorTab) body.errorIds = ids;
    else body.eventIds = ids;

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success(`Ticket created with ${ids.length} items`);
      exitSelectionMode();
    } else {
      toast.error("Failed to create ticket");
    }
  }

  async function addSelectionToTicket(ticketId: string) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const isErrorTab = logType === "errors";

    const body: Record<string, unknown> = {};
    if (isErrorTab) body.errorIds = ids;
    else body.eventIds = ids;

    const res = await fetch(`/api/tickets/${ticketId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success(`${ids.length} items linked to ticket`);
      exitSelectionMode();
      setShowTicketPicker(false);
    } else {
      toast.error("Failed to link items");
      setShowTicketPicker(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Tab pills */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {(["activity", "errors", "fetches", "tickets"] as LogType[]).map((t) => (
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
        <span className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">
          {logType === "tickets" ? "" : logType === "errors" && logs.length > 0
            ? `${logs.length} errors · ${groupErrorLogs(logs).length} groups`
            : `${logs.length} entries`}
        </span>
      </div>

      {/* Filter bar */}
      {logType !== "tickets" && (
        <LogFilterBar logType={logType} filters={filters} onFilterChange={handleFilterChange} />
      )}

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
          {/* ── ACTIVITY TAB — smart-grouped cards ── */}
          {logType === "activity" && (
            <div className="space-y-2">
              {groupActivityEvents(logs).map((group) => {
                const ds = getDomainStyle(group.logs[0].event_type as string);
                const DIcon = getDomainIcon(group.domain);
                const isOpen = expandedGroupId === group.key;
                const firstLog = group.logs[0];
                const hasFailure = group.logs.some((l) => !(l.success as boolean));
                const summary = groupSummary(group);
                const userName = group.userId ? profileMap[group.userId] : null;

                return (
                  <div
                    key={group.key}
                    className={`rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.06)] bg-[#171F28] overflow-hidden ${ds.borderClass}`}
                  >
                    {/* Group header — click to expand */}
                    <button
                      type="button"
                      onClick={() => setExpandedGroupId(isOpen ? null : group.key)}
                      className="flex w-full items-center gap-2 px-3 py-3 md:px-5 md:gap-3 text-left transition-colors hover:bg-[#222D3D]/20"
                    >
                      {/* Status dot */}
                      <span className={`h-2 w-2 shrink-0 rounded-full ${hasFailure ? "bg-[#DC2626] shadow-[0_0_6px_rgba(220,38,38,0.4)]" : "bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.3)]"}`} />

                      {/* Domain badge with icon */}
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${ds.badge}`}>
                        <DIcon className="h-3 w-3" />
                        {ds.label}
                      </span>

                      {/* Summary text */}
                      <span className="min-w-0 truncate text-[0.8125rem] font-medium capitalize text-white">{summary}</span>

                      {/* Count badge (only if more than 1) */}
                      {group.logs.length > 1 && (
                        <span className="shrink-0 rounded-full bg-[#2A3544] px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-[#9CA3AF]">
                          {group.logs.length}
                        </span>
                      )}

                      <span className="flex-1" />

                      {/* User name */}
                      {userName && (
                        <span className="hidden md:inline shrink-0 text-[0.75rem] text-[#9CA3AF]">{userName}</span>
                      )}

                      {/* Time */}
                      <span className="shrink-0 text-[0.75rem] tabular-nums text-[#9CA3AF]">{relativeTime(firstLog.created_at as string)}</span>

                      {/* Chevron */}
                      <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {/* Expanded — nested child events */}
                    {isOpen && (
                      <div className="border-t border-[#2A3544]/30">
                        <div className="ml-3 md:ml-5 bg-[#0C1016]/40">
                        {group.logs.map((log, logIdx) => {
                          const id = log.id as string;
                          const isExpanded = expandedId === id;
                          return (
                            <div key={id} className={`${logIdx > 0 ? "border-t border-[#2A3544]/15" : ""} opacity-90`}>
                              <EventRow
                                log={log}
                                isExpanded={isExpanded}
                                onToggle={() => setExpandedId(isExpanded ? null : id)}
                                profileMap={profileMap}
                                selectionMode={selectionMode}
                                isSelected={selectedIds.has(id)}
                                onSelect={() => toggleSelection(id)}
                                onLongPress={() => handleItemLongPress(id)}
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ERRORS TAB — grouped cards ── */}
          {logType === "errors" && (
            <div className="space-y-2">
              {groupErrorLogs(logs).map((group) => {
                const sevStyle = getSeverityStyle(group.severity);
                const SevIcon = getSeverityIcon(group.severity);
                const isGroupOpen = expandedErrorGroupId === group.key;
                const isBulkResolving = bulkResolveGroupId === group.key;
                const newestTime = relativeTime(group.logs[0].created_at as string);
                const oldestTime = group.logs.length > 1 ? relativeTime(group.logs[group.logs.length - 1].created_at as string) : null;

                // Single-entry groups render as a plain row (no grouping overhead)
                if (group.logs.length === 1) {
                  const log = group.logs[0];
                  const id = log.id as string;
                  const isExpanded = expandedId === id;
                  const reqId = log.request_id as string | null;
                  const ctx = reqId ? batchContextMap[reqId] ?? null : null;
                  return (
                    <div
                      key={id}
                      className={`rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.06)] bg-[#171F28] overflow-hidden ${sevStyle.borderClass}`}
                    >
                      <ErrorRow log={log} isExpanded={isExpanded} onToggle={() => setExpandedId(isExpanded ? null : id)} batchContext={ctx} selectionMode={selectionMode} isSelected={selectedIds.has(id)} onSelect={() => toggleSelection(id)} onLongPress={() => handleItemLongPress(id)} />
                      {isExpanded && (
                        <ErrorDetail log={log} profileMap={profileMap} onTraceRequest={handleTraceRequest} onResolve={handleResolve} />
                      )}
                    </div>
                  );
                }

                // Multi-entry groups
                return (
                  <div
                    key={group.key}
                    className={`rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.06)] bg-[#171F28] overflow-hidden ${sevStyle.borderClass}`}
                  >
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => { setExpandedErrorGroupId(isGroupOpen ? null : group.key); setBulkResolveGroupId(null); setBulkNoteText(""); }}
                      className="flex w-full items-center gap-2 px-3 py-3 md:px-5 md:gap-3 text-left transition-colors hover:bg-[#222D3D]/20"
                    >
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${sevStyle.badge}`}>
                        <SevIcon className="h-3 w-3" />
                        {group.severity}
                      </span>
                      <span className="min-w-0 truncate text-[0.75rem] md:text-[0.8125rem] font-medium text-[#B8BFC8]">{group.sourceSystem}</span>
                      <span className="shrink-0 rounded-full bg-[#2A3544] px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-[#9CA3AF]">
                        {group.logs.length}
                      </span>
                      <span className="flex-1" />
                      {/* Status pill */}
                      {group.resolved ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#6AD7A3]/25 bg-[#6AD7A3]/10 px-2 py-0.5 text-[0.625rem] font-semibold text-[#6AD7A3]">Resolved</span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F59E0B]/25 bg-[#F59E0B]/10 px-2 py-0.5 text-[0.625rem] font-semibold text-[#F59E0B]">Open</span>
                      )}
                      {/* Time range */}
                      <span className="shrink-0 text-[0.75rem] tabular-nums text-[#9CA3AF]">
                        {oldestTime ? `${newestTime} – ${oldestTime}` : newestTime}
                      </span>
                      <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform ${isGroupOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {/* Group message preview (always visible) */}
                    <div className="px-3 pb-2 md:px-5 -mt-1">
                      <p className="text-[0.8125rem] text-white line-clamp-1">{group.message}</p>
                    </div>

                    {/* Expanded — nested child errors */}
                    {isGroupOpen && (
                      <div className="border-t border-[#2A3544]/30">
                        {/* Bulk resolve bar */}
                        {!group.resolved && (
                          <div className="px-3 py-2.5 md:px-5 bg-[#0C1016]/60 border-b border-[#2A3544]/20">
                            {isBulkResolving ? (
                              <div className="flex w-full items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  placeholder="What was done to resolve this..."
                                  value={bulkNoteText}
                                  onChange={(e) => setBulkNoteText(e.target.value)}
                                  autoFocus
                                  className="min-w-0 flex-1 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[0.8125rem] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3] transition-colors"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleBulkResolve(group.logs.map((l) => l.id as string), bulkNoteText || undefined);
                                      setBulkResolveGroupId(null);
                                      setBulkNoteText("");
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleBulkResolve(group.logs.map((l) => l.id as string), bulkNoteText || undefined);
                                    setBulkResolveGroupId(null);
                                    setBulkNoteText("");
                                  }}
                                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#6AD7A3]/15 px-3 py-2 text-[0.75rem] font-semibold text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30 hover:bg-[#6AD7A3]/25 transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setBulkResolveGroupId(null); setBulkNoteText(""); }}
                                  className="shrink-0 text-[0.75rem] text-[#9CA3AF] hover:text-white transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setBulkResolveGroupId(group.key); }}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#6AD7A3]/10 px-4 py-2 text-[0.75rem] font-semibold text-[#6AD7A3] ring-1 ring-[#6AD7A3]/25 hover:bg-[#6AD7A3]/20 transition-colors"
                              >
                                Resolve All ({group.logs.length})
                              </button>
                            )}
                          </div>
                        )}

                        {/* Individual errors */}
                        <div className="ml-3 md:ml-5 bg-[#0C1016]/40">
                          {group.logs.map((log, logIdx) => {
                            const id = log.id as string;
                            const isExpanded = expandedId === id;
                            const reqId = log.request_id as string | null;
                            const ctx = reqId ? batchContextMap[reqId] ?? null : null;
                            return (
                              <div key={id} className={logIdx > 0 ? "border-t border-[#2A3544]/15" : ""}>
                                <ErrorRow log={log} isExpanded={isExpanded} onToggle={() => setExpandedId(isExpanded ? null : id)} batchContext={ctx} selectionMode={selectionMode} isSelected={selectedIds.has(id)} onSelect={() => toggleSelection(id)} onLongPress={() => handleItemLongPress(id)} />
                                {isExpanded && (
                                  <ErrorDetail log={log} profileMap={profileMap} onTraceRequest={handleTraceRequest} onResolve={handleResolve} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── TICKETS TAB ── */}
          {logType === "tickets" && <TicketsPanel />}

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

      {/* ── Selection Mode Floating Action Bar ── */}
      {selectionMode && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-[rgba(255,255,255,0.12)] bg-[#171F28]/95 px-4 py-2.5 shadow-2xl backdrop-blur-md animate-slide-up">
          <span className="text-[0.75rem] font-semibold tabular-nums text-white">{selectedIds.size} selected</span>
          <span className="h-4 w-px bg-[#2A3544]" />
          <button
            type="button"
            onClick={createTicketFromSelection}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#6AD7A3]/15 px-3 py-1.5 text-[0.75rem] font-semibold text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30 hover:bg-[#6AD7A3]/25 transition-colors"
          >
            Create Ticket
          </button>
          <button
            type="button"
            onClick={() => setShowTicketPicker(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#818CF8]/10 px-3 py-1.5 text-[0.75rem] font-semibold text-[#818CF8] ring-1 ring-[#818CF8]/25 hover:bg-[#818CF8]/20 transition-colors"
          >
            Add to Ticket
          </button>
          <button
            type="button"
            onClick={exitSelectionMode}
            className="p-1 text-[#9CA3AF] hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Ticket Picker for selection mode ── */}
      {showTicketPicker && (
        <TicketPickerModal
          onSelect={addSelectionToTicket}
          onClose={() => setShowTicketPicker(false)}
        />
      )}
    </div>
  );
}
