"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { relativeTime, fullTime, getDomainStyle, actionLabel, getSeverityStyle } from "@/components/logs/log-utils";
import { getDomainIcon, getSeverityIcon } from "@/components/logs/log-icons";
import { statusStyles, priorityStyles } from "@/components/logs/tickets-panel";
import TicketPickerModal from "@/components/logs/ticket-picker-modal";

type TicketData = {
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
  notes: Array<{ id: string; text: string; timestamp: string }>;
  created_at: string;
  updated_at: string;
  reporter?: { display_name: string; email: string | null } | null;
};

type LinkedEvent = Record<string, unknown>;
type LinkedError = Record<string, unknown>;

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];
const PRIORITY_OPTIONS = ["critical", "high", "medium", "low"];

export default function TicketDetail({ ticketId, onUpdated }: { ticketId: string; onUpdated: () => void }) {
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [linkedEvents, setLinkedEvents] = useState<LinkedEvent[]>([]);
  const [linkedErrors, setLinkedErrors] = useState<LinkedError[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/tickets/${ticketId}`)
      .then((r) => r.json())
      .then((data) => {
        setTicket(data.ticket ?? null);
        setLinkedEvents(data.linked_events ?? []);
        setLinkedErrors(data.linked_errors ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticketId]);

  async function updateTicket(updates: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setTicket((prev) => prev ? { ...prev, ...updated } : prev);
      onUpdated();
    } else {
      toast.error("Failed to update ticket");
    }
    setSaving(false);
  }

  async function addNote() {
    if (!noteText.trim()) return;
    await updateTicket({ note: noteText.trim() });
    setNoteText("");
    // Refetch to get updated notes
    const res = await fetch(`/api/tickets/${ticketId}`);
    if (res.ok) {
      const data = await res.json();
      setTicket(data.ticket);
    }
  }

  async function unlinkEvent(eventId: string) {
    await fetch(`/api/tickets/${ticketId}/link`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventIds: [eventId] }),
    });
    setLinkedEvents((prev) => prev.filter((e) => e.id !== eventId));
    onUpdated();
  }

  async function unlinkError(errorId: string) {
    await fetch(`/api/tickets/${ticketId}/link`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errorIds: [errorId] }),
    });
    setLinkedErrors((prev) => prev.filter((e) => e.id !== errorId));
    onUpdated();
  }

  async function handleDelete() {
    const res = await fetch(`/api/tickets/${ticketId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Ticket deleted");
      onUpdated();
    } else {
      toast.error("Failed to delete ticket");
    }
  }

  async function handleMerge(targetId: string) {
    const res = await fetch("/api/tickets/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: ticketId, targetId }),
    });
    if (res.ok) {
      toast.success("Tickets merged");
      onUpdated();
    } else {
      toast.error("Failed to merge tickets");
    }
    setMergeOpen(false);
  }

  if (loading) {
    return <div className="p-4"><div className="h-32 animate-pulse rounded-lg bg-[#0C1016]" /></div>;
  }
  if (!ticket) {
    return <div className="p-4 text-[0.8125rem] text-[#9CA3AF]">Ticket not found</div>;
  }

  const notes = Array.isArray(ticket.notes) ? ticket.notes : [];

  return (
    <div className="p-4 md:p-5 space-y-4">
      {/* Header: title + status + priority */}
      <div className="space-y-3">
        {/* Title */}
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[0.875rem] font-semibold text-white outline-none focus:border-[#6AD7A3]"
              onKeyDown={(e) => {
                if (e.key === "Enter") { updateTicket({ title: titleDraft }); setEditingTitle(false); }
                if (e.key === "Escape") setEditingTitle(false);
              }}
            />
            <button type="button" onClick={() => { updateTicket({ title: titleDraft }); setEditingTitle(false); }} className="text-[0.75rem] text-[#6AD7A3]">Save</button>
            <button type="button" onClick={() => setEditingTitle(false)} className="text-[0.75rem] text-[#9CA3AF]">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => { setTitleDraft(ticket.title); setEditingTitle(true); }} className="text-left text-[0.9375rem] font-semibold text-white hover:text-[#6AD7A3] transition-colors">
            {ticket.title}
          </button>
        )}

        {/* Status + Priority selectors */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Status</label>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((s) => {
                const ss = statusStyles[s] ?? statusStyles.open;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateTicket({ status: s })}
                    disabled={saving}
                    className={`rounded-full border px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.04em] transition-all ${ticket.status === s ? ss.pill : "border-[#2A3544] text-[#9CA3AF] opacity-50 hover:opacity-75"}`}
                  >
                    {ss.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Priority</label>
            <div className="flex flex-wrap gap-1">
              {PRIORITY_OPTIONS.map((p) => {
                const ps = priorityStyles[p] ?? priorityStyles.medium;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateTicket({ priority: p })}
                    disabled={saving}
                    className={`rounded-full border px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.04em] transition-all ${ticket.priority === p ? ps.badge : "border-[#2A3544] text-[#9CA3AF] opacity-50 hover:opacity-75"}`}
                  >
                    {ps.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Message (user reports) */}
      {ticket.message && (
        <div className="rounded-xl bg-[#0C1016] p-4">
          <p className="whitespace-pre-wrap text-[0.8125rem] text-[#E5E7EB] leading-relaxed">{ticket.message}</p>
        </div>
      )}

      {/* Metadata (user reports) */}
      {ticket.source === "user_report" && (
        <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
          {ticket.reporter?.display_name && (
            <div><span className="text-[#9CA3AF]">Reporter: </span><span className="text-white">{ticket.reporter.display_name}</span></div>
          )}
          {ticket.page_url && (
            <div className="col-span-2"><span className="text-[#9CA3AF]">Page: </span><span className="text-[#38BDF8] break-all">{ticket.page_url}</span></div>
          )}
          {ticket.screen_size && (
            <div><span className="text-[#9CA3AF]">Screen: </span><span className="text-white">{ticket.screen_size}</span></div>
          )}
          <div><span className="text-[#9CA3AF]">Submitted: </span><span className="text-white">{fullTime(ticket.created_at)}</span></div>
        </div>
      )}

      {/* Linked Events */}
      {linkedEvents.length > 0 && (
        <div>
          <h4 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
            Linked Events ({linkedEvents.length})
          </h4>
          <div className="space-y-1 rounded-lg bg-[#0C1016]/60 p-2">
            {linkedEvents.map((ev) => {
              const et = (ev.event_type as string) || "";
              const ds = getDomainStyle(et);
              const DIcon = getDomainIcon(et.split(".")[0]);
              return (
                <div key={ev.id as string} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#171F28]/60">
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase ${ds.badge}`}>
                    <DIcon className="h-2.5 w-2.5" />
                    {ds.label}
                  </span>
                  <span className="min-w-0 truncate text-[0.75rem] text-[#B8BFC8] capitalize">{actionLabel(et)}</span>
                  {(ev.actor as { display_name?: string })?.display_name && (
                    <span className="hidden md:inline shrink-0 text-[0.6875rem] text-[#9CA3AF]">{(ev.actor as { display_name: string }).display_name}</span>
                  )}
                  <span className="flex-1" />
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{relativeTime(ev.created_at as string)}</span>
                  <button type="button" onClick={() => unlinkEvent(ev.id as string)} className="shrink-0 text-[#9CA3AF] hover:text-[#DC2626] transition-colors" title="Unlink">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Linked Errors */}
      {linkedErrors.length > 0 && (
        <div>
          <h4 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
            Linked Errors ({linkedErrors.length})
          </h4>
          <div className="space-y-1 rounded-lg bg-[#0C1016]/60 p-2">
            {linkedErrors.map((err) => {
              const sev = (err.severity as string) || "info";
              const sevStyle = getSeverityStyle(sev);
              const SevIcon = getSeverityIcon(sev);
              return (
                <div key={err.id as string} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#171F28]/60">
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase ${sevStyle.badge}`}>
                    <SevIcon className="h-2.5 w-2.5" />
                    {sev}
                  </span>
                  <span className="shrink-0 text-[0.6875rem] text-[#B8BFC8]">{err.source_system as string}</span>
                  <span className="min-w-0 truncate text-[0.75rem] text-white">{err.message as string}</span>
                  <span className="flex-1" />
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{relativeTime(err.created_at as string)}</span>
                  <button type="button" onClick={() => unlinkError(err.id as string)} className="shrink-0 text-[#9CA3AF] hover:text-[#DC2626] transition-colors" title="Unlink">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes timeline */}
      <div>
        <h4 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
          Notes ({notes.length})
        </h4>
        {notes.length > 0 && (
          <div className="mb-3 space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="flex items-start gap-2 rounded-lg bg-[#0C1016]/40 px-3 py-2">
                <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6AD7A3]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] text-[#E5E7EB]">{n.text}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-[#9CA3AF]">{relativeTime(n.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="min-w-0 flex-1 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[0.8125rem] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3] transition-colors"
            onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
          />
          <button
            type="button"
            onClick={addNote}
            disabled={!noteText.trim()}
            className="shrink-0 rounded-full bg-[#6AD7A3]/15 px-3 py-2 text-[0.75rem] font-semibold text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30 hover:bg-[#6AD7A3]/25 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-[#2A3544]/30 pt-3">
        <button
          type="button"
          onClick={() => setMergeOpen(true)}
          className="rounded-full border border-[#2A3544] px-3 py-1.5 text-[0.75rem] font-medium text-[#9CA3AF] hover:text-white hover:border-[#6AD7A3]/40 transition-colors"
        >
          Merge with...
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-[0.75rem] text-[#DC2626]">Delete this ticket?</span>
            <button type="button" onClick={handleDelete} className="rounded-full bg-[#DC2626]/15 px-3 py-1 text-[0.75rem] font-semibold text-[#DC2626] ring-1 ring-[#DC2626]/30">Yes</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-[0.75rem] text-[#9CA3AF]">No</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-full border border-[#2A3544] px-3 py-1.5 text-[0.75rem] font-medium text-[#9CA3AF] hover:text-[#DC2626] hover:border-[#DC2626]/40 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Merge modal */}
      {mergeOpen && (
        <TicketPickerModal
          excludeId={ticketId}
          onSelect={handleMerge}
          onClose={() => setMergeOpen(false)}
        />
      )}
    </div>
  );
}
