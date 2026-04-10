"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { relativeTime } from "@/components/logs/log-utils";
import TicketDetail from "@/components/logs/ticket-detail";

type Ticket = {
  id: string;
  ticket_name: string | null;
  title: string;
  status: string;
  priority: string;
  source: string;
  reporter_id: string | null;
  message: string | null;
  notes: unknown[];
  created_at: string;
  updated_at: string;
  reporter?: { display_name: string; email: string | null } | null;
  linked_events: number;
  linked_errors: number;
};

const PRIORITY_OPTIONS = ["critical", "high", "medium", "low"] as const;
const SOURCE_OPTIONS = ["user_report", "activity", "error", "manual"] as const;

export const priorityColors: Record<string, string> = {
  critical: "#DC2626",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#9CA3AF",
};

export const priorityLabels: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const statusColors: Record<string, string> = {
  open: "#F59E0B",
  in_progress: "#3B82F6",
  resolved: "#22C55E",
};

export const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const sourceLabels: Record<string, string> = {
  user_report: "User Report",
  activity: "Activity",
  error: "Error",
  manual: "Manual",
};

const STATUS_SORT: Record<string, number> = { open: 0, in_progress: 1, resolved: 2 };

export default function TicketsPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  // Filters
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
    const params = new URLSearchParams({ limit: "100" });
    if (priorityFilter) params.set("priority", priorityFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/tickets?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const raw = (data.tickets ?? []) as Ticket[];
        // Sort: open first, in_progress, resolved — then by created_at desc within group
        raw.sort((a, b) => {
          const sa = STATUS_SORT[a.status] ?? 9;
          const sb = STATUS_SORT[b.status] ?? 9;
          if (sa !== sb) return sa - sb;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setTickets(raw);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [priorityFilter, sourceFilter, debouncedSearch]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative w-full md:w-44">
          <svg viewBox="0 0 24 24" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#2A3544] bg-[#171F28] py-1.5 pl-8 pr-3 text-[0.75rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-[#2A3544] bg-[#171F28] px-2 py-1.5 text-[0.75rem] text-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{priorityLabels[p]}</option>
          ))}
        </select>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-[#2A3544] bg-[#171F28] px-2 py-1.5 text-[0.75rem] text-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
        >
          <option value="">All sources</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>{sourceLabels[s]}</option>
          ))}
        </select>

        <span className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">
          {total} ticket{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-[var(--radius-lg)] bg-[#171F28]" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[0.8125rem] text-[#9CA3AF]">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const pc = priorityColors[ticket.priority] ?? "#9CA3AF";
            const sc = statusColors[ticket.status] ?? "#9CA3AF";
            const linkedTotal = ticket.linked_events + ticket.linked_errors;
            const daysOld = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 86400000);

            return (
              <div
                key={ticket.id}
                className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-[1px] cursor-pointer"
                style={{
                  borderTopWidth: "2px",
                  borderTopColor: pc,
                  backgroundImage: `linear-gradient(to bottom, ${pc}18, transparent 40%)`,
                }}
                onClick={() => setSpotlightId(ticket.id)}
              >
                <div className="p-4 md:p-5">
                  {/* Zone 1: Identity */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[1rem] md:text-[1.0625rem] font-bold leading-tight text-white">{ticket.title}</h3>
                      {/* Ticket name chip */}
                      {ticket.ticket_name && (
                        <span className="mt-1.5 inline-flex items-center rounded-full border border-[#818CF8]/25 bg-[#818CF8]/10 px-2 py-0.5 text-[0.625rem] font-semibold text-[#818CF8]">
                          {ticket.ticket_name}
                        </span>
                      )}
                    </div>
                    {daysOld > 0 && (
                      <span className={`shrink-0 text-[0.8125rem] font-semibold tabular-nums ${daysOld > 7 ? "text-[#DC2626]" : daysOld > 3 ? "text-[#F59E0B]" : "text-[#9CA3AF]"}`}>
                        {daysOld}d
                      </span>
                    )}
                  </div>

                  {/* Zone 2: Signal strip */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {/* Priority pill */}
                    <span
                      className="inline-flex h-[24px] items-center rounded-full border px-2.5 text-[0.6875rem] font-semibold"
                      style={{
                        color: pc,
                        backgroundColor: `${pc}15`,
                        borderColor: `${pc}30`,
                      }}
                    >
                      {priorityLabels[ticket.priority] ?? ticket.priority}
                    </span>

                    {/* Source */}
                    <span className="inline-flex h-[24px] items-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-2.5 text-[0.6875rem] text-[#9CA3AF]">
                      {sourceLabels[ticket.source] ?? ticket.source}
                    </span>

                    {/* Reporter */}
                    {ticket.reporter?.display_name && (
                      <span className="text-[0.75rem] text-[#9CA3AF]">{ticket.reporter.display_name}</span>
                    )}

                    <span className="flex-1" />

                    {/* Linked items */}
                    {linkedTotal > 0 && (
                      <span className="text-[0.6875rem] tabular-nums text-[#9CA3AF]">
                        {ticket.linked_events > 0 && `${ticket.linked_events} event${ticket.linked_events > 1 ? "s" : ""}`}
                        {ticket.linked_events > 0 && ticket.linked_errors > 0 && " · "}
                        {ticket.linked_errors > 0 && `${ticket.linked_errors} error${ticket.linked_errors > 1 ? "s" : ""}`}
                      </span>
                    )}

                    {/* Time */}
                    <span className="text-[0.75rem] tabular-nums text-[#9CA3AF]">{relativeTime(ticket.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Spotlight modal */}
      {spotlightId && (
        <TicketDetail
          ticketId={spotlightId}
          onClose={() => setSpotlightId(null)}
          onUpdated={() => { fetchTickets(); }}
        />
      )}
    </div>
  );
}
