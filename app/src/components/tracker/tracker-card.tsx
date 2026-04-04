"use client";

import { useState, useEffect } from "react";
import StatusPill from "@/components/ui/status-pill";
import type { Database } from "@/types/database";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];

const STAGES = ["Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer"];
const CLOSED = ["Rejected", "Ghosted", "Withdrawn"];

const statusBorderColor: Record<string, string> = {
  Prospect: "#1DD3B0",
  Applied: "#3B82F6",
  "Interview 1": "#8B5CF6",
  "Interview 2": "#8B5CF6",
  Final: "#F59E0B",
  Offer: "#22C55E",
  Rejected: "#DC2626",
  Ghosted: "#4B5563",
  Withdrawn: "#6B7280",
};

interface TrackerCardProps {
  entry: TrackerEntry;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

export default function TrackerCard({ entry, onUpdate, onDelete }: TrackerCardProps) {
  const [spotlight, setSpotlight] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(entry.notes);
  const [status, setStatus] = useState(entry.status);

  // Close spotlight on ESC
  useEffect(() => {
    if (!spotlight) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSpotlight(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [spotlight]);

  function handleSave() {
    onUpdate(entry.id, { status, notes });
    setEditing(false);
  }

  const daysInStage = Math.floor(
    (Date.now() - new Date(entry.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysColor =
    daysInStage < 3 ? "text-[#6AD7A3]" : daysInStage < 7 ? "text-[#F59E0B]" : "text-[#DC2626]";

  const borderColor = statusBorderColor[entry.status] ?? "#9CA3AF";

  // Card front (always visible)
  const cardFront = (
    <div
      className="group max-w-[960px] cursor-pointer overflow-hidden rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-[1px]"
      style={{
        borderTopWidth: "2px",
        borderTopColor: borderColor,
        backgroundImage: `linear-gradient(to bottom, ${borderColor}08, transparent 40%)`,
      }}
      onClick={() => setSpotlight(true)}
    >
      <div className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[1rem] md:text-[1.3125rem] font-bold leading-tight text-white">
              {entry.title}
            </h3>
            <p className="mt-0.5 md:mt-1 text-[0.8125rem] md:text-[0.9375rem] text-[#B8BFC8]">{entry.company}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className={`text-[0.8125rem] font-semibold tabular-nums ${daysColor}`}>
              {daysInStage}d
            </span>
            <StatusPill status={entry.status} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {entry.salary && (
            <span className="inline-flex h-[26px] items-center rounded-full border border-[rgba(0,245,212,0.2)] bg-[rgba(0,245,212,0.08)] px-3 text-[0.6875rem] text-white">
              {entry.salary}
            </span>
          )}
          {entry.lane_label && (
            <span className="inline-flex h-[26px] items-center rounded-full border border-[#6AD7A3]/20 bg-[#6AD7A3]/8 px-3 text-[0.6875rem] font-medium text-[#6AD7A3]">
              {entry.lane_label}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (!spotlight) return cardFront;

  // Spotlight overlay + detail card
  return (
    <>
      {cardFront}
      <div className="spotlight-overlay" onClick={() => { setSpotlight(false); setEditing(false); }} />
      <div className="fixed inset-0 z-[52] flex items-center justify-center p-4" onClick={() => { setSpotlight(false); setEditing(false); }}>
        <div
          className="spotlight-card w-full max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto rounded-[var(--radius-xl)] border border-[rgba(255,255,255,0.12)] bg-[#171F28]"
          style={{
            borderTopWidth: "3px",
            borderTopColor: borderColor,
            boxShadow: `0 0 60px ${borderColor}20, var(--shadow-elevated)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 p-6 pb-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[1.3125rem] font-bold text-white">{entry.title}</h3>
              <p className="mt-1 text-[0.9375rem] text-[#B8BFC8]">{entry.company}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[0.8125rem] font-semibold tabular-nums ${daysColor}`}>{daysInStage}d</span>
              <StatusPill status={entry.status} />
              <button
                type="button"
                onClick={() => { setSpotlight(false); setEditing(false); }}
                className="rounded-lg p-1.5 text-[#9CA3AF] hover:bg-[#222D3D] hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-2 px-6 pb-4">
            {entry.salary && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-[rgba(0,245,212,0.2)] bg-[rgba(0,245,212,0.08)] px-3 text-[0.6875rem] text-white">
                {entry.salary}
              </span>
            )}
            {entry.lane_label && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-[#6AD7A3]/20 bg-[#6AD7A3]/8 px-3 text-[0.6875rem] font-medium text-[#6AD7A3]">
                {entry.lane_label}
              </span>
            )}
            {entry.url && (
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[26px] items-center gap-1 rounded-full border border-[#38BDF8]/20 bg-[#38BDF8]/8 px-3 text-[0.6875rem] font-medium text-[#38BDF8]"
              >
                View Listing
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
            )}
          </div>

          <div className="border-t border-[#2A3544] p-6 space-y-4">
            {/* Summary */}
            {entry.job_summary && (
              <p className="text-[0.9375rem] leading-relaxed text-[#B8BFC8] italic">
                {entry.job_summary}
              </p>
            )}

            {/* GoodFit */}
            {entry.good_fit && (
              <div className="rounded-lg border-l-[3px] border-l-[#2F8A63] bg-[#6AD7A3]/5 p-4">
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#6AD7A3]">GOOD FIT</p>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[#B8BFC8] whitespace-pre-line">
                  {entry.good_fit}
                </p>
              </div>
            )}

            {/* Notes */}
            {entry.notes && !editing && (
              <div className="rounded-lg bg-[#151C24] p-4">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Notes</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[#B8BFC8]">{entry.notes}</p>
              </div>
            )}

            {/* Edit mode */}
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Status</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...STAGES, ...CLOSED].map((s) => {
                      const c = statusBorderColor[s] ?? "#9CA3AF";
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(s)}
                          className={`rounded-full border px-3 py-1 text-[0.6875rem] font-medium transition-colors ${
                            status === s
                              ? "border-current bg-current/15"
                              : "border-[#2A3544] bg-[#151C24] text-[#9CA3AF] hover:text-[#B8BFC8]"
                          }`}
                          style={status === s ? { color: c } : undefined}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-[0.8125rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
                    placeholder="Add notes..."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleSave} className="inline-flex h-[34px] items-center rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] px-4 text-[0.8125rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.1)]">Save</button>
                  <button type="button" onClick={() => { setEditing(false); setStatus(entry.status); setNotes(entry.notes); }} className="inline-flex h-[34px] items-center rounded-full border border-[#2A3544] px-4 text-[0.8125rem] text-[#9CA3AF]">Cancel</button>
                  <button type="button" onClick={() => onDelete(entry.id)} className="ml-auto inline-flex h-[34px] items-center rounded-full border border-[#DC2626]/25 px-4 text-[0.8125rem] text-[#DC2626] hover:bg-[#DC2626]/10">Remove</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#2A3544] px-4 text-[0.8125rem] font-medium text-[#B8BFC8] hover:border-[#6AD7A3]/40 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
