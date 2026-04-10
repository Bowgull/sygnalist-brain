"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { relativeTime, fullTime, getDomainStyle, actionLabel, getSeverityStyle } from "@/components/logs/log-utils";
import { getDomainIcon, getSeverityIcon } from "@/components/logs/log-icons";
import { priorityColors, priorityLabels, statusColors, statusLabels } from "@/components/logs/tickets-panel";
import TicketPickerModal from "@/components/logs/ticket-picker-modal";

type TicketData = {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  message: string | null;
  page_url: string | null;
  user_agent: string | null;
  screen_size: string | null;
  notes: Array<{ id: string; text: string; timestamp: string }>;
  created_at: string;
  reporter?: { display_name: string; email: string | null } | null;
};

type LinkedEvent = Record<string, unknown>;
type LinkedError = Record<string, unknown>;

const STATUSES = ["open", "in_progress", "resolved"];
const PRIORITIES = ["critical", "high", "medium", "low"];
const statusDisplay: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };

export default function TicketDetail({ ticketId, onClose, onUpdated }: { ticketId: string; onClose: () => void; onUpdated: () => void }) {
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
    const res = await fetch(`/api/tickets/${ticketId}`);
    if (res.ok) { const data = await res.json(); setTicket(data.ticket); }
  }

  async function unlinkEvent(eventId: string) {
    await fetch(`/api/tickets/${ticketId}/link`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventIds: [eventId] }) });
    setLinkedEvents((prev) => prev.filter((e) => e.id !== eventId));
    onUpdated();
  }

  async function unlinkError(errorId: string) {
    await fetch(`/api/tickets/${ticketId}/link`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ errorIds: [errorId] }) });
    setLinkedErrors((prev) => prev.filter((e) => e.id !== errorId));
    onUpdated();
  }

  async function handleDelete() {
    const res = await fetch(`/api/tickets/${ticketId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Ticket deleted"); onClose(); onUpdated(); } else { toast.error("Failed to delete"); }
  }

  async function handleMerge(targetId: string) {
    const res = await fetch("/api/tickets/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: ticketId, targetId }) });
    if (res.ok) { toast.success("Tickets merged"); onClose(); onUpdated(); } else { toast.error("Failed to merge"); }
    setMergeOpen(false);
  }

  if (!ticket && !loading) return null;

  const pc = ticket ? (priorityColors[ticket.priority] ?? "#9CA3AF") : "#9CA3AF";
  const notes = ticket && Array.isArray(ticket.notes) ? ticket.notes : [];
  const stageIdx = ticket ? STATUSES.indexOf(ticket.status) : 0;

  return (
    <>
      {/* Overlay */}
      <div className="spotlight-overlay fixed inset-0 z-[51]" style={{ background: "rgba(5, 6, 10, 0.85)" }} onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[52] flex flex-col items-center justify-center p-2 md:p-4" onClick={onClose}>
        <div
          className="spotlight-card w-full max-w-2xl max-h-[min(85vh,720px)] overflow-y-auto rounded-[var(--radius-lg)] md:rounded-[var(--radius-xl)] border border-[rgba(255,255,255,0.12)] bg-[#171F28]"
          style={{
            borderTopWidth: "3px",
            borderTopColor: pc,
            boxShadow: `0 0 60px ${pc}20, var(--shadow-elevated)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="p-6"><div className="h-40 animate-pulse rounded-lg bg-[#0C1016]" /></div>
          ) : ticket ? (
            <>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 p-4 pb-3 md:p-6 md:pb-4">
                <div className="min-w-0 flex-1">
                  {editingTitle ? (
                    <input
                      type="text"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      autoFocus
                      className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[1.125rem] font-bold text-white outline-none focus:border-[#6AD7A3]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { updateTicket({ title: titleDraft }); setEditingTitle(false); }
                        if (e.key === "Escape") setEditingTitle(false);
                      }}
                      onBlur={() => { updateTicket({ title: titleDraft }); setEditingTitle(false); }}
                    />
                  ) : (
                    <h3
                      className="text-[1.125rem] md:text-[1.3125rem] font-bold text-white cursor-pointer hover:text-[#6AD7A3] transition-colors"
                      onClick={() => { setTitleDraft(ticket.title); setEditingTitle(true); }}
                    >
                      {ticket.title}
                    </h3>
                  )}
                  {ticket.source === "user_report" && ticket.reporter?.display_name && (
                    <p className="mt-0.5 text-[0.8125rem] text-[#B8BFC8]">from {ticket.reporter.display_name}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2.5 -mr-1.5 text-[#9CA3AF] hover:bg-[#222D3D] hover:text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Metadata chips */}
              <div className="flex flex-wrap gap-2 px-4 pb-3 md:px-6 md:pb-4">
                {ticket.page_url && (
                  <a href={ticket.page_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-[26px] items-center gap-1 rounded-full border border-[#38BDF8]/20 bg-[#38BDF8]/8 px-3 text-[0.6875rem] font-medium text-[#38BDF8]">
                    {ticket.page_url.replace(/^https?:\/\/[^/]+/, "").slice(0, 30)}
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                  </a>
                )}
                {ticket.screen_size && (
                  <span className="inline-flex h-[26px] items-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-3 text-[0.6875rem] text-[#9CA3AF]">
                    {ticket.screen_size}
                  </span>
                )}
                <span className="inline-flex h-[26px] items-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-3 text-[0.6875rem] text-[#9CA3AF]">
                  {fullTime(ticket.created_at)}
                </span>
              </div>

              <div className="border-t border-[#2A3544] p-4 md:p-6 space-y-5">
                {/* Status pipeline — connected dots */}
                <div>
                  <label className="mb-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Status</label>
                  <div className="flex items-center gap-0">
                    {STATUSES.map((s, i) => {
                      const c = statusColors[s] ?? "#9CA3AF";
                      const isActive = ticket.status === s;
                      const isPast = stageIdx >= 0 && i < stageIdx;
                      return (
                        <div key={s} className="flex items-center">
                          <button
                            type="button"
                            onClick={() => updateTicket({ status: s })}
                            disabled={saving}
                            className="relative flex flex-col items-center gap-1 group/stage"
                          >
                            <div
                              className={`h-3 w-3 rounded-full border-2 transition-all ${
                                isActive
                                  ? "scale-125 shadow-[0_0_8px_var(--dot-color)]"
                                  : isPast
                                    ? "opacity-60"
                                    : "opacity-30 hover:opacity-60"
                              }`}
                              style={{
                                borderColor: c,
                                backgroundColor: isActive || isPast ? c : "transparent",
                                ["--dot-color" as string]: `${c}60`,
                              }}
                            />
                            <span className={`text-[0.5625rem] font-medium whitespace-nowrap transition-colors ${
                              isActive ? "text-white" : "text-[#9CA3AF] group-hover/stage:text-[#B8BFC8]"
                            }`}>
                              {statusDisplay[s] ?? s}
                            </span>
                          </button>
                          {i < STATUSES.length - 1 && (
                            <div
                              className="h-[2px] w-6 md:w-10 mx-1"
                              style={{ backgroundColor: isPast ? `${c}60` : "#2A3544" }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Priority pills */}
                <div>
                  <label className="mb-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Priority</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITIES.map((p) => {
                      const c = priorityColors[p] ?? "#9CA3AF";
                      const isActive = ticket.priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateTicket({ priority: p })}
                          disabled={saving}
                          className={`rounded-full px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-all ${
                            isActive ? "" : "opacity-50 hover:opacity-80"
                          }`}
                          style={{
                            color: c,
                            ...(isActive ? { backgroundColor: `${c}15`, boxShadow: `inset 0 0 0 1px ${c}40` } : {}),
                          }}
                        >
                          {priorityLabels[p]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message */}
                {ticket.message && (
                  <div className="rounded-lg bg-[#151C24] p-4">
                    <p className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[#B8BFC8]">{ticket.message}</p>
                  </div>
                )}

                {/* Linked Events */}
                {linkedEvents.length > 0 && (
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Linked Events ({linkedEvents.length})</p>
                    <div className="rounded-lg bg-[#151C24] p-3 space-y-1">
                      {linkedEvents.map((ev) => {
                        const et = (ev.event_type as string) || "";
                        const ds = getDomainStyle(et);
                        const DIcon = getDomainIcon(et.split(".")[0]);
                        return (
                          <div key={ev.id as string} className="group/item flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[rgba(255,255,255,0.04)]">
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase ${ds.badge}`}>
                              <DIcon className="h-2.5 w-2.5" />{ds.label}
                            </span>
                            <span className="min-w-0 truncate text-[0.75rem] text-[#B8BFC8] capitalize">{actionLabel(et)}</span>
                            <span className="flex-1" />
                            <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{relativeTime(ev.created_at as string)}</span>
                            <button
                              type="button"
                              onClick={() => unlinkEvent(ev.id as string)}
                              className="shrink-0 rounded-full p-1 text-[#6B7280] hover:bg-[#DC2626]/10 hover:text-[#DC2626] md:opacity-0 md:group-hover/item:opacity-100 transition-all"
                            >
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Linked Errors ({linkedErrors.length})</p>
                    <div className="rounded-lg bg-[#151C24] p-3 space-y-1">
                      {linkedErrors.map((err) => {
                        const sev = (err.severity as string) || "info";
                        const sevStyle = getSeverityStyle(sev);
                        const SevIcon = getSeverityIcon(sev);
                        return (
                          <div key={err.id as string} className="group/item flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[rgba(255,255,255,0.04)]">
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase ${sevStyle.badge}`}>
                              <SevIcon className="h-2.5 w-2.5" />{sev}
                            </span>
                            <span className="min-w-0 truncate text-[0.75rem] text-white">{err.message as string}</span>
                            <span className="flex-1" />
                            <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{relativeTime(err.created_at as string)}</span>
                            <button
                              type="button"
                              onClick={() => unlinkError(err.id as string)}
                              className="shrink-0 rounded-full p-1 text-[#6B7280] hover:bg-[#DC2626]/10 hover:text-[#DC2626] md:opacity-0 md:group-hover/item:opacity-100 transition-all"
                            >
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Notes ({notes.length})</p>
                  <div className="rounded-lg bg-[#151C24] p-4">
                    {notes.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {notes.map((n) => (
                          <div key={n.id} className="flex items-start gap-2">
                            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6AD7A3]" />
                            <div>
                              <p className="text-[0.8125rem] leading-relaxed text-[#B8BFC8]">{n.text}</p>
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
                        className="min-w-0 flex-1 rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[0.8125rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
                        onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
                      />
                      <button
                        type="button"
                        onClick={addNote}
                        disabled={!noteText.trim()}
                        className="inline-flex h-[32px] items-center gap-1.5 rounded-full border border-[#6AD7A3]/30 px-3.5 text-[0.75rem] font-medium text-[#6AD7A3] transition-all hover:bg-[#6AD7A3]/10 hover:-translate-y-px active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-[#2A3544] pt-4">
                  <button
                    type="button"
                    onClick={() => setMergeOpen(true)}
                    className="inline-flex h-[32px] items-center gap-1.5 rounded-full border border-[#2A3544] px-3.5 text-[0.75rem] font-medium text-[#9CA3AF] transition-all hover:text-[#B8BFC8] hover:border-[#9CA3AF]/30 hover:-translate-y-px active:scale-[0.97]"
                  >
                    Merge with...
                  </button>
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[0.75rem] text-[#DC2626]">Delete?</span>
                      <button type="button" onClick={handleDelete} className="inline-flex h-[32px] items-center rounded-full border border-[#DC2626]/25 px-3.5 text-[0.75rem] font-medium text-[#DC2626] hover:bg-[#DC2626]/10">Yes</button>
                      <button type="button" onClick={() => setConfirmDelete(false)} className="text-[0.75rem] text-[#9CA3AF]">No</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex h-[32px] items-center gap-1.5 rounded-full border border-[#DC2626]/25 px-3.5 text-[0.75rem] font-medium text-[#DC2626] transition-all hover:bg-[#DC2626]/10 hover:-translate-y-px active:scale-[0.97]"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {mergeOpen && <TicketPickerModal excludeId={ticketId} onSelect={handleMerge} onClose={() => setMergeOpen(false)} />}
    </>
  );
}
