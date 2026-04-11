"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
const STATUSES = ["open", "in_progress", "resolved"] as const;

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

/* ── Sortable Kanban Card ───────────────────────────────── */

function KanbanCard({
  ticket,
  onClick,
  overlay,
}: {
  ticket: Ticket;
  onClick: () => void;
  overlay?: boolean;
}) {
  const pc = priorityColors[ticket.priority] ?? "#9CA3AF";

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data: { status: ticket.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const card = (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className="group cursor-grab active:cursor-grabbing rounded-[var(--radius-lg)] p-px transition-all duration-150 hover:-translate-y-[1px]"
      onClick={onClick}
    >
      <div
        className="rounded-[var(--radius-lg)] px-3 py-2 transition-shadow duration-150 group-hover:shadow-[var(--shadow-elevated)]"
        style={{
          backgroundImage: `linear-gradient(${pc}08, ${pc}05), linear-gradient(to bottom, #1A2230, #171F28)`,
          borderLeft: `2px solid ${pc}`,
        }}
      >
        <h4 className="text-[0.8125rem] font-semibold leading-snug text-white line-clamp-2">{ticket.title}</h4>
        <div className="mt-1 flex items-center gap-1.5 text-[0.625rem] text-[#9CA3AF]">
          {ticket.ticket_name && (
            <span className="font-semibold text-[#818CF8]">{ticket.ticket_name}</span>
          )}
          {ticket.ticket_name && <span>·</span>}
          <span>{relativeTime(ticket.created_at)}</span>
        </div>
      </div>
    </div>
  );

  return card;
}

/* ── Kanban Column ──────────────────────────────────────── */

function KanbanColumn({
  status,
  tickets,
  onCardClick,
  collapsed,
  onToggle,
}: {
  status: string;
  tickets: Ticket[];
  onCardClick: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const sc = statusColors[status] ?? "#9CA3AF";
  const ids = tickets.map((t) => t.id);
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <button
        type="button"
        onClick={onToggle}
        className="mb-2 flex items-center gap-2 md:cursor-default"
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sc }} />
        <span className="text-[0.75rem] font-bold uppercase tracking-[0.06em] text-[#B8BFC8]">
          {statusLabels[status] ?? status}
        </span>
        <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-[#9CA3AF]">
          {tickets.length}
        </span>
        {/* Chevron — mobile only */}
        <svg
          viewBox="0 0 24 24"
          className={`ml-auto h-4 w-4 text-[#9CA3AF] transition-transform md:hidden ${collapsed ? "" : "rotate-180"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Cards — entire column is a drop target */}
      <div
        ref={setNodeRef}
        className={`min-h-[60px] space-y-1.5 rounded-[var(--radius-lg)] p-1 transition-colors ${collapsed ? "hidden md:block" : ""} ${isOver ? "bg-[rgba(255,255,255,0.03)]" : ""}`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tickets.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[#2A3544] p-4 text-center text-[0.6875rem] text-[#9CA3AF]">
              No tickets
            </div>
          ) : (
            tickets.map((t) => (
              <KanbanCard key={t.id} ticket={t} onClick={() => onCardClick(t.id)} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

/* ── Main Tickets Panel ─────────────────────────────────── */

export default function TicketsPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  // Mobile collapsed columns — open is expanded by default
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    open: false,
    in_progress: true,
    resolved: true,
  });

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

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
        raw.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setTickets(raw);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [priorityFilter, sourceFilter, debouncedSearch]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  /* ── Drag handlers ── */

  function handleDragStart(event: DragStartEvent) {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    // Determine target status: either from the droppable column or from the card we dropped on
    const ticket = tickets.find((t) => t.id === active.id);
    if (!ticket) return;

    let targetStatus: string | undefined;

    // Check if dropped on a column
    if (STATUSES.includes(over.id as typeof STATUSES[number])) {
      targetStatus = over.id as string;
    } else {
      // Dropped on another card — get that card's status
      const targetTicket = tickets.find((t) => t.id === over.id);
      targetStatus = targetTicket?.status;
    }

    if (!targetStatus || targetStatus === ticket.status) return;

    // Optimistic update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, status: targetStatus } : t))
    );

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(`Moved to ${statusLabels[targetStatus] ?? targetStatus}`);
    } catch {
      // Revert
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, status: ticket.status } : t))
      );
      toast.error("Failed to move ticket");
    }
  }

  /* ── Group tickets by status ── */
  const byStatus: Record<string, Ticket[]> = { open: [], in_progress: [], resolved: [] };
  for (const t of tickets) {
    (byStatus[t.status] ??= []).push(t);
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* Kanban board */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-24 animate-pulse rounded bg-[#171F28]" />
              <div className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-[#171F28]" />
              <div className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-[#171F28]" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STATUSES.map((s) => (
              <KanbanColumn
                key={s}
                status={s}
                tickets={byStatus[s] ?? []}
                onCardClick={(id) => setSpotlightId(id)}
                collapsed={collapsed[s] ?? false}
                onToggle={() => setCollapsed((prev) => ({ ...prev, [s]: !prev[s] }))}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTicket ? (
              <KanbanCard ticket={activeTicket} onClick={() => {}} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
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
