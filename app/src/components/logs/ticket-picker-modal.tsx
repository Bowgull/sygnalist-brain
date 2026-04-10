"use client";

import { useState, useEffect, useRef } from "react";

type PickerTicket = {
  id: string;
  ticket_name: string | null;
  title: string;
  status: string;
  priority: string;
  created_at: string;
};

const statusDot: Record<string, string> = {
  open: "bg-[#F59E0B]",
  in_progress: "bg-[#3B82F6]",
  resolved: "bg-[#22C55E]",
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
    const params = new URLSearchParams({ limit: "50" });
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 md:p-4 bg-[rgba(5,6,10,0.9)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[min(85vh,720px)] overflow-y-auto animate-slide-up rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4 md:p-6 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[0.875rem] font-semibold text-white">Merge into...</h3>
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
          placeholder="Search by name..."
          className="mb-3 w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[16px] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3] transition-colors"
        />

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded-full bg-[#0C1016]" />)}
            </div>
          ) : tickets.length === 0 ? (
            <p className="py-8 text-center text-[0.8125rem] text-[#9CA3AF]">No tickets found</p>
          ) : (
            <div className="flex flex-wrap gap-2 p-1">
              {tickets.map((t) => {
                const dotClass = statusDot[t.status] ?? "bg-[#9CA3AF]";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#818CF8]/25 bg-[#818CF8]/10 px-3 py-1.5 text-[0.75rem] font-semibold text-[#818CF8] transition-all hover:bg-[#818CF8]/20 hover:border-[#818CF8]/40 active:scale-[0.96]"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
                    {t.ticket_name || t.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
