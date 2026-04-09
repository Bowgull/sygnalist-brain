"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { relativeTime } from "@/components/logs/log-utils";
import TicketDetail from "@/components/logs/ticket-detail";

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  reporter_id: string | null;
  message: string | null;
  page_url: string | null;
  user_agent: string | null;
  screen_size: string | null;
  metadata: Record<string, unknown>;
  notes: unknown[];
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  reporter?: { display_name: string; email: string | null } | null;
  linked_events: number;
  linked_errors: number;
};

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"] as const;
const PRIORITY_OPTIONS = ["critical", "high", "medium", "low"] as const;
const SOURCE_OPTIONS = ["user_report", "activity", "error", "manual"] as const;

const statusStyles: Record<string, { pill: string; label: string }> = {
  open:        { pill: "border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#F59E0B]", label: "Open" },
  in_progress: { pill: "border-[#3B82F6]/25 bg-[#3B82F6]/10 text-[#3B82F6]", label: "In Progress" },
  resolved:    { pill: "border-[#22C55E]/25 bg-[#22C55E]/10 text-[#22C55E]", label: "Resolved" },
  closed:      { pill: "border-[#9CA3AF]/25 bg-[#9CA3AF]/10 text-[#9CA3AF]", label: "Closed" },
};

const priorityStyles: Record<string, { badge: string; label: string }> = {
  critical: { badge: "border-[#DC2626] bg-[#DC2626]/15 text-[#DC2626]", label: "Critical" },
  high:     { badge: "border-[#F59E0B] bg-[#F59E0B]/12 text-[#F59E0B]", label: "High" },
  medium:   { badge: "border-[#3B82F6] bg-[#3B82F6]/12 text-[#3B82F6]", label: "Medium" },
  low:      { badge: "border-[#9CA3AF] bg-[#9CA3AF]/10 text-[#9CA3AF]", label: "Low" },
};

const sourceLabels: Record<string, string> = {
  user_report: "User Report",
  activity: "Activity",
  error: "Error",
  manual: "Manual",
};

export default function TicketsPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchTickets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/tickets?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setTickets(data.tickets ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter, priorityFilter, sourceFilter, debouncedSearch]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  function handleTicketUpdated() {
    fetchTickets();
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status pills */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-colors ${!statusFilter ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30" : "text-[#9CA3AF] hover:text-[#B8BFC8]"}`}
          >
            All
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-colors ${statusFilter === s ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30" : "text-[#9CA3AF] hover:text-[#B8BFC8]"}`}
            >
              {statusStyles[s]?.label ?? s}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-[#2A3544] bg-[#151C24] px-2 py-1 text-[0.75rem] text-[#B8BFC8] outline-none"
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{priorityStyles[p]?.label ?? p}</option>
          ))}
        </select>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-[#2A3544] bg-[#151C24] px-2 py-1 text-[0.75rem] text-[#B8BFC8] outline-none"
        >
          <option value="">All sources</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>{sourceLabels[s]}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-1 text-[0.75rem] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3] transition-colors"
        />

        <span className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">
          {total} ticket{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-[#171F28]" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[0.8125rem] text-[#9CA3AF]">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const ss = statusStyles[ticket.status] ?? statusStyles.open;
            const ps = priorityStyles[ticket.priority] ?? priorityStyles.medium;
            const isExpanded = expandedId === ticket.id;
            const linkedTotal = ticket.linked_events + ticket.linked_errors;

            return (
              <div
                key={ticket.id}
                className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.06)] bg-[#171F28] overflow-hidden border-l-[3px] border-l-[#F472B6]/40"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  className="flex w-full items-center gap-2 px-3 py-3 md:px-5 md:gap-3 text-left transition-colors hover:bg-[#222D3D]/20"
                >
                  {/* Priority badge */}
                  <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${ps.badge}`}>
                    {ps.label}
                  </span>

                  {/* Title */}
                  <span className="min-w-0 truncate text-[0.8125rem] font-medium text-white">{ticket.title}</span>

                  {/* Source badge */}
                  <span className="hidden md:inline-flex shrink-0 rounded-full bg-[#2A3544] px-2 py-0.5 text-[0.625rem] font-semibold text-[#9CA3AF]">
                    {sourceLabels[ticket.source] ?? ticket.source}
                  </span>

                  {/* Linked items count */}
                  {linkedTotal > 0 && (
                    <span className="shrink-0 rounded-full bg-[#F472B6]/10 px-2 py-0.5 text-[0.625rem] font-semibold tabular-nums text-[#F472B6] ring-1 ring-[#F472B6]/20">
                      {ticket.linked_events > 0 && `${ticket.linked_events}e`}
                      {ticket.linked_events > 0 && ticket.linked_errors > 0 && " · "}
                      {ticket.linked_errors > 0 && `${ticket.linked_errors}err`}
                    </span>
                  )}

                  <span className="flex-1" />

                  {/* Reporter name */}
                  {ticket.reporter?.display_name && (
                    <span className="hidden md:inline shrink-0 text-[0.75rem] text-[#9CA3AF]">{ticket.reporter.display_name}</span>
                  )}

                  {/* Status pill */}
                  <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold ${ss.pill}`}>
                    {ss.label}
                  </span>

                  {/* Time */}
                  <span className="shrink-0 text-[0.75rem] tabular-nums text-[#9CA3AF]">{relativeTime(ticket.created_at)}</span>

                  {/* Chevron */}
                  <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[#2A3544]/30">
                    <TicketDetail ticketId={ticket.id} onUpdated={handleTicketUpdated} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { statusStyles, priorityStyles, sourceLabels };
