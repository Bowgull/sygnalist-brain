"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { relativeTime } from "@/components/logs/log-utils";
import TicketDetail from "@/components/logs/ticket-detail";

const inputClass =
  "w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none transition-colors focus:border-[#6AD7A3]";

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
  const [showCreate, setShowCreate] = useState(false);
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

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="ml-auto rounded-full border border-[#6AD7A3]/30 bg-[#6AD7A3]/15 px-3 py-1 text-[0.75rem] font-semibold text-[#6AD7A3] transition-colors hover:bg-[#6AD7A3]/25"
        >
          + New
        </button>

        <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">
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
                className="group relative overflow-hidden rounded-[var(--radius-lg)] p-px transition-all duration-200 hover:-translate-y-[1px] cursor-pointer"
                style={{
                  backgroundImage: `linear-gradient(to bottom, ${pc}, ${pc}40 40%, transparent 70%)`,
                }}
                onClick={() => setSpotlightId(ticket.id)}
              >
                <div
                  className="rounded-[var(--radius-lg)] p-3 transition-shadow duration-200 group-hover:shadow-[var(--shadow-elevated)]"
                  style={{ background: "linear-gradient(to bottom, #1A2230, #171F28)" }}
                >
                  {/* Row 1: Title + age + status */}
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="min-w-0 flex-1 truncate text-[0.875rem] md:text-[0.9375rem] font-bold leading-tight text-white">{ticket.title}</h3>
                    <div className="flex shrink-0 items-center gap-2">
                      {daysOld > 0 && (
                        <span className={`text-[0.75rem] font-semibold tabular-nums ${daysOld > 7 ? "text-[#DC2626]" : daysOld > 3 ? "text-[#F59E0B]" : "text-[#9CA3AF]"}`}>
                          {daysOld}d
                        </span>
                      )}
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.04em]"
                        style={{
                          color: sc,
                          backgroundColor: `${sc}15`,
                          borderColor: `${sc}30`,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sc }} />
                        {statusLabels[ticket.status] ?? ticket.status}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Ticket name, source, reporter, linked, time */}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {ticket.ticket_name && (
                      <span className="inline-flex items-center rounded-full border border-[#818CF8]/25 bg-[#818CF8]/10 px-2 py-0.5 text-[0.5625rem] font-semibold text-[#818CF8]">
                        {ticket.ticket_name}
                      </span>
                    )}
                    <span className="inline-flex h-[22px] items-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-2 text-[0.625rem] text-[#9CA3AF]">
                      {sourceLabels[ticket.source] ?? ticket.source}
                    </span>
                    {ticket.reporter?.display_name && (
                      <span className="text-[0.6875rem] text-[#9CA3AF]">{ticket.reporter.display_name}</span>
                    )}
                    <span className="flex-1" />
                    {linkedTotal > 0 && (
                      <span className="text-[0.625rem] tabular-nums text-[#9CA3AF]">
                        {ticket.linked_events > 0 && `${ticket.linked_events} event${ticket.linked_events > 1 ? "s" : ""}`}
                        {ticket.linked_events > 0 && ticket.linked_errors > 0 && " · "}
                        {ticket.linked_errors > 0 && `${ticket.linked_errors} error${ticket.linked_errors > 1 ? "s" : ""}`}
                      </span>
                    )}
                    <span className="text-[0.6875rem] tabular-nums text-[#9CA3AF]">{relativeTime(ticket.created_at)}</span>
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

      {/* Create ticket modal */}
      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchTickets(); }}
        />
      )}
    </div>
  );
}

/* ── Create Ticket Modal ─────────────────────────────────── */

function CreateTicketModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          message: message.trim() || undefined,
          source: "manual",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create ticket");
      }

      toast.success("Ticket created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 md:p-4 bg-[rgba(5,6,10,0.9)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg animate-slide-up rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New Ticket</h2>
          <button type="button" onClick={onClose} className="text-[#9CA3AF] hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ticket title"
            className={inputClass}
            autoFocus
            required
            maxLength={200}
          />

          {/* Priority pills */}
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-wider text-[#9CA3AF]">Priority</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((p) => {
                const active = priority === p;
                const c = priorityColors[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className="rounded-full px-3 py-1.5 text-[0.75rem] font-semibold transition-all"
                    style={{
                      color: active ? c : "#9CA3AF",
                      backgroundColor: active ? `${c}20` : "transparent",
                      border: `1px solid ${active ? `${c}50` : "#2A3544"}`,
                    }}
                  >
                    {priorityLabels[p]}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Description (optional)"
            className={inputClass}
            maxLength={5000}
          />

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-[#2A3544] py-2.5 text-sm font-medium text-[#9CA3AF]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !title.trim()}
              className="flex-1 rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.15)] disabled:opacity-50"
            >
              {sending ? "Creating..." : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
