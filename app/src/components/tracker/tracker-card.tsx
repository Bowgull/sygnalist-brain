"use client";

import { useState } from "react";
import StatusPill from "@/components/ui/status-pill";
import type { Database } from "@/types/database";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];

const STAGES = ["Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer"];
const CLOSED = ["Rejected", "Ghosted", "Withdrawn"];

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

  // Days in current stage
  const daysInStage = Math.floor(
    (Date.now() - new Date(entry.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysColor =
    daysInStage < 3 ? "text-[#6AD7A3]" : daysInStage < 7 ? "text-[#F59E0B]" : "text-[#DC2626]";

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] transition-all">
      {/* Collapsed header */}
      <button
        type="button"
        className="w-full p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold leading-tight text-white">
              {entry.title}
            </h3>
            <p className="mt-0.5 truncate text-[13px] text-[#B8BFC8]">{entry.company}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`text-[11px] font-medium ${daysColor}`}>{daysInStage}d</span>
            <StatusPill status={entry.status} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {entry.salary && (
            <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#B8BFC8] ring-1 ring-[#2A3544]">
              {entry.salary}
            </span>
          )}
          {entry.lane_label && (
            <span className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[11px] text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30">
              {entry.lane_label}
            </span>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#2A3544] p-4">
          {entry.job_summary && (
            <p className="text-[13px] leading-relaxed text-[#B8BFC8]">{entry.job_summary}</p>
          )}

          {entry.good_fit && (
            <div className="mt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#6AD7A3]">GoodFit</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#B8BFC8]">{entry.good_fit}</p>
            </div>
          )}

          {/* Status selector */}
          {editing ? (
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[...STAGES, ...CLOSED].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        status === s
                          ? "bg-[#6AD7A3]/20 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/40"
                          : "bg-[#151C24] text-[#9CA3AF] ring-1 ring-[#2A3544]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[13px] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
                  placeholder="Add notes..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016]"
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
                  className="rounded-full border border-[#2A3544] px-4 py-1.5 text-[12px] text-[#9CA3AF]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry.id)}
                  className="ml-auto rounded-full border border-[#DC2626]/30 px-3 py-1.5 text-[12px] text-[#DC2626] hover:bg-[#DC2626]/10"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              {entry.url && (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-[#2A3544] px-3 py-1.5 text-[12px] font-medium text-[#B8BFC8] hover:border-[#6AD7A3]/50"
                >
                  View
                </a>
              )}
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-full border border-[#2A3544] px-3 py-1.5 text-[12px] font-medium text-[#B8BFC8] hover:border-[#6AD7A3]/50"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
                Edit
              </button>
            </div>
          )}

          {entry.notes && !editing && (
            <div className="mt-3 rounded-lg bg-[#151C24] p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#B8BFC8]">{entry.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
