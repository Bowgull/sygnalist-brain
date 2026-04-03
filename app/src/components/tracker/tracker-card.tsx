"use client";

import { useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(entry.notes);
  const [status, setStatus] = useState(entry.status);

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

  return (
    <div
      className="group max-w-[960px] overflow-hidden rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-[1px]"
      style={{
        borderTopWidth: "2px",
        borderTopColor: borderColor,
        backgroundImage: `linear-gradient(to bottom, ${borderColor}08, transparent 40%)`,
      }}
    >
      {/* Collapsed header */}
      <button
        type="button"
        className="w-full p-4 md:p-6 text-left"
        onClick={() => setExpanded(!expanded)}
      >
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

        {/* Chips */}
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
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#2A3544] p-4 md:p-6 pt-4 md:pt-5 animate-slide-down">
          {entry.job_summary && (
            <p className="text-[0.9375rem] leading-relaxed text-[#B8BFC8] italic">
              {entry.job_summary}
            </p>
          )}

          {/* GoodFit block */}
          {entry.good_fit && (
            <div className="mt-3 rounded-lg border-l-[3px] border-l-[#2F8A63] bg-[#6AD7A3]/5 p-4">
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#6AD7A3]">
                GOOD FIT
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[#B8BFC8]">
                {entry.good_fit}
              </p>
            </div>
          )}

          {/* Notes display */}
          {entry.notes && !editing && (
            <div className="mt-3 rounded-lg bg-[#151C24] p-4">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Notes</p>
              <p className="mt-1.5 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[#B8BFC8]">{entry.notes}</p>
            </div>
          )}

          {/* Edit mode */}
          {editing ? (
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
                  Status
                </label>
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
                <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-[0.8125rem] text-white placeholder-[#9CA3AF] outline-none transition-colors focus:border-[#6AD7A3]"
                  placeholder="Add notes..."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex h-[34px] items-center rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] px-4 text-[0.8125rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.1)]"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setStatus(entry.status);
                    setNotes(entry.notes);
                  }}
                  className="inline-flex h-[34px] items-center rounded-full border border-[#2A3544] px-4 text-[0.8125rem] text-[#9CA3AF] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry.id)}
                  className="ml-auto inline-flex h-[34px] items-center rounded-full border border-[#DC2626]/25 px-4 text-[0.8125rem] text-[#DC2626] hover:bg-[#DC2626]/10"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.url && (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#2A3544] px-4 text-[0.8125rem] font-medium text-[#B8BFC8] transition-all hover:border-[#6AD7A3]/40 hover:text-white hover:-translate-y-px"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View
                </a>
              )}
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#2A3544] px-4 text-[0.8125rem] font-medium text-[#B8BFC8] transition-all hover:border-[#6AD7A3]/40 hover:text-white hover:-translate-y-px"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
                Edit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
