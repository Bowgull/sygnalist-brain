"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Pencil, Check, Trash2, X, ExternalLink, Zap,
  ChevronLeft, ChevronRight, Send,
} from "lucide-react";
import { toast } from "sonner";
import StatusPill from "@/components/ui/status-pill";
import type { Database } from "@/types/database";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];

const STAGES = ["Prospect", "Applied", "Interview 1", "Interview 2", "Final", "Offer"];
const CLOSED = ["Rejected", "Ghosted", "Withdrawn"];

const stageDisplay: Record<string, string> = {
  Prospect: "Prospect",
  Applied: "Applied",
  "Interview 1": "1st Interview",
  "Interview 2": "2nd Interview",
  Final: "Final",
  Offer: "Offer",
};

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

/* ── Activity log helpers ── */

interface ActivityNote {
  id: string;
  text: string;
  timestamp: string;
}

function parseNotes(raw: string, fallbackDate: string): ActivityNote[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0 && arr[0].text !== undefined) return arr;
  } catch { /* not JSON - legacy plain text */ }
  return [{ id: "legacy", text: raw, timestamp: fallbackDate }];
}

function serializeNotes(notes: ActivityNote[]): string {
  return JSON.stringify(notes);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Component ── */

interface TrackerCardProps {
  entry: TrackerEntry;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

export default function TrackerCard({ entry, onUpdate, onDelete }: TrackerCardProps) {
  const [spotlight, setSpotlight] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(entry.status);
  const [goodFit, setGoodFit] = useState(entry.good_fit);
  const [generatingFit, setGeneratingFit] = useState(false);

  // Activity log
  const [activityNotes, setActivityNotes] = useState<ActivityNote[]>(() =>
    parseNotes(entry.notes, entry.added_at ?? entry.updated_at)
  );
  const [newNote, setNewNote] = useState("");

  // Mobile swipe state
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const swipeThreshold = 120;

  const stageIdx = STAGES.indexOf(entry.status);
  const isTerminal = CLOSED.includes(entry.status);
  const canAdvance = stageIdx >= 0 && stageIdx < STAGES.length - 1;
  const canRegress = stageIdx > 0;

  // Close spotlight on ESC
  useEffect(() => {
    if (!spotlight) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSpotlight(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [spotlight]);

  /* ── Stage promotion ── */

  const moveStage = useCallback((direction: 1 | -1) => {
    if (isTerminal) return;
    const newIdx = stageIdx + direction;
    if (newIdx < 0 || newIdx >= STAGES.length) return;
    const newStatus = STAGES[newIdx];
    const oldStatus = entry.status;
    const title = entry.title;

    onUpdate(entry.id, { status: newStatus });

    toast(
      `Moved ${title} to ${stageDisplay[newStatus] ?? newStatus}`,
      {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            onUpdate(entry.id, { status: oldStatus });
            toast(`Reverted to ${stageDisplay[oldStatus] ?? oldStatus}`);
          },
        },
      }
    );
  }, [entry.id, entry.status, entry.title, stageIdx, isTerminal, onUpdate]);

  /* ── Mobile swipe handlers ── */

  function handleTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!swiping) return;
    e.stopPropagation();
    const dx = e.touches[0].clientX - startX.current;
    // Clamp swipe if can't move in that direction
    if (dx > 0 && !canAdvance) { setSwipeX(0); return; }
    if (dx < 0 && !canRegress) { setSwipeX(0); return; }
    setSwipeX(dx);
  }

  function handleTouchEnd() {
    setSwiping(false);
    if (swipeX > swipeThreshold && canAdvance) {
      moveStage(1);
    } else if (swipeX < -swipeThreshold && canRegress) {
      moveStage(-1);
    }
    setSwipeX(0);
  }

  /* ── GoodFit generation ── */

  async function handleGenerateGoodFit() {
    setGeneratingFit(true);
    const res = await fetch(`/api/tracker/${entry.id}/goodfit`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.good_fit) setGoodFit(data.good_fit);
    }
    setGeneratingFit(false);
  }

  /* ── Notes / activity log ── */

  function handleAddNote() {
    const text = newNote.trim();
    if (!text) return;
    const note: ActivityNote = {
      id: crypto.randomUUID(),
      text,
      timestamp: new Date().toISOString(),
    };
    const updated = [note, ...activityNotes];
    setActivityNotes(updated);
    setNewNote("");
    onUpdate(entry.id, { notes: serializeNotes(updated) });
  }

  function handleDeleteNote(noteId: string) {
    const updated = activityNotes.filter((n) => n.id !== noteId);
    setActivityNotes(updated);
    onUpdate(entry.id, { notes: serializeNotes(updated) });
  }

  function handleSave() {
    onUpdate(entry.id, { status, notes: serializeNotes(activityNotes) });
    setEditing(false);
  }

  /* ── Computed values ── */

  const daysInStage = Math.floor(
    (Date.now() - new Date(entry.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysColor =
    daysInStage < 3 ? "text-[#6AD7A3]" : daysInStage < 7 ? "text-[#F59E0B]" : "text-[#DC2626]";
  const borderColor = statusBorderColor[entry.status] ?? "#9CA3AF";

  // Swipe visual state
  const swipeReachedAdvance = swipeX > swipeThreshold;
  const swipeReachedRegress = swipeX < -swipeThreshold;
  const swipeBg = swipeReachedAdvance
    ? "bg-[#6AD7A3]/10"
    : swipeReachedRegress
      ? "bg-[#F59E0B]/10"
      : "";

  /* ── Card front ── */

  const cardFront = (
    <div
      className={`group relative max-w-[960px] overflow-hidden rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-[1px] ${swipeBg}`}
      style={{
        borderTopWidth: "2px",
        borderTopColor: borderColor,
        backgroundImage: `linear-gradient(to bottom, ${borderColor}18, transparent 40%)`,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile swipe targets */}
      {swipeX > 30 && canAdvance && (
        <div className={`absolute right-0 top-0 bottom-0 flex items-center justify-center px-4 md:hidden transition-all ${swipeReachedAdvance ? "bg-[#6AD7A3]/20" : ""}`}>
          <span className={`text-[0.75rem] font-bold uppercase tracking-wide ${swipeReachedAdvance ? "text-[#6AD7A3]" : "text-[#6AD7A3]/50"}`}>
            {stageDisplay[STAGES[stageIdx + 1]] ?? STAGES[stageIdx + 1]}
          </span>
        </div>
      )}
      {swipeX < -30 && canRegress && (
        <div className={`absolute left-0 top-0 bottom-0 flex items-center justify-center px-4 md:hidden transition-all ${swipeReachedRegress ? "bg-[#F59E0B]/20" : ""}`}>
          <span className={`text-[0.75rem] font-bold uppercase tracking-wide ${swipeReachedRegress ? "text-[#F59E0B]" : "text-[#F59E0B]/50"}`}>
            {stageDisplay[STAGES[stageIdx - 1]] ?? STAGES[stageIdx - 1]}
          </span>
        </div>
      )}

      <div
        className="relative p-4 md:p-6 cursor-pointer"
        style={{ transform: swipeX ? `translateX(${swipeX * 0.3}px)` : undefined }}
        onClick={() => setSpotlight(true)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[1rem] md:text-[1.3125rem] font-bold leading-tight text-white">
              {entry.title}
            </h3>
            <p className="mt-0.5 md:mt-1 text-[0.8125rem] md:text-[0.9375rem] text-[#B8BFC8]">{entry.company}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Desktop chevron arrows - hover only */}
            {!isTerminal && (
              <div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {canRegress ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveStage(-1); }}
                    className="rounded-md p-1 text-[#9CA3AF] hover:bg-[#222D3D] hover:text-[#F59E0B] transition-colors"
                    title={`Move to ${stageDisplay[STAGES[stageIdx - 1]] ?? STAGES[stageIdx - 1]}`}
                  >
                    <ChevronLeft size={18} strokeWidth={2} />
                  </button>
                ) : <div className="w-[26px]" />}
                {canAdvance ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveStage(1); }}
                    className="rounded-md p-1 text-[#9CA3AF] hover:bg-[#222D3D] hover:text-[#6AD7A3] transition-colors"
                    title={`Move to ${stageDisplay[STAGES[stageIdx + 1]] ?? STAGES[stageIdx + 1]}`}
                  >
                    <ChevronRight size={18} strokeWidth={2} />
                  </button>
                ) : <div className="w-[26px]" />}
              </div>
            )}
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

  /* ── Spotlight overlay ── */

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
                <X size={20} strokeWidth={2} />
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
                <ExternalLink size={12} strokeWidth={2} />
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
            {goodFit ? (
              <div className="rounded-lg border-l-[3px] border-l-[#2F8A63] bg-[#6AD7A3]/5 p-4">
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#6AD7A3]">GOOD FIT</p>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[#B8BFC8] whitespace-pre-line">
                  {goodFit}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateGoodFit}
                disabled={generatingFit}
                className="group/gf w-full rounded-lg bg-gradient-to-r from-[#0A2E1F] to-[#1A3D2E] p-4 ring-1 ring-[#6AD7A3]/40 shadow-[0_0_20px_rgba(106,215,163,0.15)] transition-all hover:ring-[#6AD7A3]/60 hover:shadow-[0_0_30px_rgba(106,215,163,0.25)] disabled:opacity-50 disabled:hover:shadow-[0_0_20px_rgba(106,215,163,0.15)]"
              >
                {generatingFit ? (
                  <div className="flex items-center justify-center gap-2">
                    <Zap size={18} strokeWidth={2} className="text-[#FAD76A] animate-pulse" />
                    <span className="text-[0.875rem] font-bold text-white">Generating GoodFit...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Zap size={18} strokeWidth={2} className="text-[#FAD76A] group-hover/gf:drop-shadow-[0_0_6px_rgba(250,215,106,0.5)]" />
                    <span className="text-[0.875rem] font-bold text-white">Generate GoodFit</span>
                  </div>
                )}
              </button>
            )}

            {/* Activity Log */}
            <div className="rounded-lg bg-[#151C24] p-4">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Notes</p>

              {/* Quick-add input */}
              <div className="flex gap-2 mb-3">
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                  placeholder="Add a note..."
                  className="flex-1 rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[0.8125rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="rounded-lg border border-[#2A3544] px-2.5 text-[#9CA3AF] hover:border-[#6AD7A3]/40 hover:text-[#6AD7A3] disabled:opacity-30 transition-colors"
                >
                  <Send size={14} strokeWidth={2} />
                </button>
              </div>

              {/* Note feed */}
              {activityNotes.length > 0 && (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {activityNotes.map((note) => (
                    <div key={note.id} className="group/note flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] leading-relaxed text-[#B8BFC8]">{note.text}</p>
                        <p className="text-[0.6875rem] text-[#9CA3AF] mt-0.5">{relativeTime(note.timestamp)}</p>
                      </div>
                      {editing && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="shrink-0 rounded p-1 text-[#9CA3AF] hover:text-[#DC2626] opacity-0 group-hover/note:opacity-100 transition-opacity"
                        >
                          <X size={12} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleSave} className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] px-4 text-[0.8125rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.1)]">
                    <Check size={16} strokeWidth={2} />
                    Save
                  </button>
                  <button type="button" onClick={() => { setEditing(false); setStatus(entry.status); }} className="inline-flex h-[34px] items-center rounded-full border border-[#2A3544] px-4 text-[0.8125rem] text-[#9CA3AF]">Cancel</button>
                  <button type="button" onClick={() => onDelete(entry.id)} className="ml-auto inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#DC2626]/25 px-4 text-[0.8125rem] text-[#DC2626] hover:bg-[#DC2626]/10">
                    <Trash2 size={16} strokeWidth={2} />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#2A3544] px-4 text-[0.8125rem] font-medium text-[#B8BFC8] hover:border-[#6AD7A3]/40 hover:text-white"
                >
                  <Pencil size={16} strokeWidth={2} />
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

export { parseNotes, serializeNotes, relativeTime, STAGES, CLOSED, stageDisplay, statusBorderColor };
export type { ActivityNote };
