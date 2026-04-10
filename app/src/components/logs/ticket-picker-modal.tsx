"use client";

import { useState, useEffect, useRef } from "react";
import { relativeTime } from "@/components/logs/log-utils";

type PickerTicket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  linked_events: number;
  linked_errors: number;
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const statusColors: Record<string, string> = {
  open: "text-[#F59E0B]",
  in_progress: "text-[#3B82F6]",
  resolved: "text-[#22C55E]",
  closed: "text-[#9CA3AF]",
};

const priorityMap: Record<string, string> = {
  critical: "#DC2626",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#9CA3AF",
};

export default function TicketPickerModal({
  excludeId,
  onSelect,
  onClose,
}: {
  excludeId?: string;
  onSelect: (ticketId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<PickerTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "20" });
    if (search) params.set("search", search);

    fetch(`/api/tickets?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const all = (data.tickets ?? []) as PickerTicket[];
        setTickets(excludeId ? all.filter((t) => t.id !== excludeId) : all);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, excludeId]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      style={{ background: "rgba(5, 6, 10, 0.85)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg animate-slide-up rounded-t-[20px] md:rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-5 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[0.875rem] font-semibold text-white">Select Ticket</h3>
          <button type="button" onClick={onClose} className="text-[#9CA3AF] hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tickets..."
          className="mb-3 w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3] transition-colors"
        />

        <div className="flex-1 overflow-y-auto space-y-1">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#0C1016]" />)}
            </div>
          ) : tickets.length === 0 ? (
            <p className="py-8 text-center text-[0.8125rem] text-[#9CA3AF]">No tickets found</p>
          ) : (
            tickets.map((t) => {
              const linkedTotal = t.linked_events + t.linked_errors;
              const pc = priorityMap[t.priority] ?? "#9CA3AF";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: pc }} />
                  <span className="min-w-0 truncate text-[0.8125rem] font-medium text-white">{t.title}</span>
                  <span className="flex-1" />
                  {linkedTotal > 0 && (
                    <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{linkedTotal} linked</span>
                  )}
                  <span className={`shrink-0 text-[0.6875rem] font-semibold ${statusColors[t.status] ?? "text-[#9CA3AF]"}`}>
                    {statusLabels[t.status] ?? t.status}
                  </span>
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9CA3AF]">{relativeTime(t.created_at)}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
