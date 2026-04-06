"use client";

import { useState, useEffect, useRef } from "react";
import {
  Pencil, Check, Trash2, X, ExternalLink, Send, Clock, ChevronDown,
} from "lucide-react";
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

/* ── Staleness thresholds per stage (days) ── */
const STALE_THRESHOLDS: Record<string, [number, number]> = {
  Prospect:       [7, 14],
  Applied:        [5, 10],
  "Interview 1":  [3, 7],
  "Interview 2":  [3, 7],
  Final:          [3, 5],
  Offer:          [2, 5],
};

function getDaysColor(status: string, days: number): string {
  const thresholds = STALE_THRESHOLDS[status] ?? [3, 7];
  if (days < thresholds[0]) return "text-[#6AD7A3]";
  if (days < thresholds[1]) return "text-[#F59E0B]";
  return "text-[#DC2626]";
}

/* ── Fit summary extraction ── */

function extractFitSummary(goodFit: string | null): string | null {
  if (!goodFit) return null;
  // Take the first sentence of Block 1 (up to first period), cap at 120 chars
  const firstBlock = goodFit.split(/\n\s*\n/)[0] ?? "";
  const firstSentence = firstBlock.split(/\.\s/)[0];
  if (!firstSentence) return null;
  const trimmed = firstSentence.trim();
  if (trimmed.length <= 120) return trimmed.endsWith(".") ? trimmed : trimmed + ".";
  return trimmed.slice(0, 117) + "...";
}

/* ── Action hint derivation ── */

function getActionHint(status: string, days: number, notes: ActivityNote[], isTerminal: boolean): string | null {
  if (isTerminal) return null;

  const latestNote = notes[0];
  const thresholds = STALE_THRESHOLDS[status] ?? [3, 7];

  if (status === "Prospect" && days >= thresholds[1]) {
    return "No movement - consider applying or dismissing";
  }
  if (status === "Applied" && days >= thresholds[0]) {
    return `No response in ${days} days`;
  }
  if ((status === "Interview 1" || status === "Interview 2" || status === "Final") && days >= thresholds[0]) {
    return `${days} days since stage change - follow up?`;
  }
  if (latestNote) {
    return `${latestNote.text.length > 60 ? latestNote.text.slice(0, 57) + "..." : latestNote.text} - ${relativeTime(latestNote.timestamp)}`;
  }
  if (days > 0) {
    return `Added ${days}d ago`;
  }
  return null;
}

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

/* ── Transition note placeholders ── */

const TRANSITION_PLACEHOLDERS: Record<string, string> = {
  Applied: "When did you apply?",
  "Interview 1": "Interview date or details?",
  "Interview 2": "Interview date or details?",
  Final: "Final round details?",
  Offer: "Offer details?",
  Rejected: "What happened?",
  Ghosted: "How long since last contact?",
  Withdrawn: "Reason for withdrawing?",
};

/* ── Component ── */

interface TrackerCardProps {
  entry: TrackerEntry;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

export default function TrackerCard({ entry, onUpdate, onDelete }: TrackerCardProps) {
  const [spotlight, setSpotlight] = useState(false);
  const [editing, setEditing] = useState(false);
  const [quickEdit, setQuickEdit] = useState(false);
  const [status, setStatus] = useState(entry.status);
  const [goodFit, setGoodFit] = useState(entry.good_fit);
  const [generatingFit, setGeneratingFit] = useState(false);
  const [transitionNote, setTransitionNote] = useState("");
  const quickEditRef = useRef<HTMLDivElement>(null);

  // Activity log
  const [activityNotes, setActivityNotes] = useState<ActivityNote[]>(() =>
    parseNotes(entry.notes, entry.added_at ?? entry.updated_at)
  );
  const [newNote, setNewNote] = useState("");

  const isTerminal = CLOSED.includes(entry.status);

  // Close spotlight on ESC
  useEffect(() => {
    if (!spotlight && !quickEdit) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSpotlight(false);
        setQuickEdit(false);
        setStatus(entry.status);
        setTransitionNote("");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [spotlight, quickEdit, entry.status]);

  // Close quick-edit on outside click
  useEffect(() => {
    if (!quickEdit) return;
    function handleClick(e: MouseEvent) {
      if (quickEditRef.current && !quickEditRef.current.contains(e.target as Node)) {
        setQuickEdit(false);
        setStatus(entry.status);
        setTransitionNote("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [quickEdit, entry.status]);

  /* ── GoodFit generation ── */

  const [fitError, setFitError] = useState<string | null>(null);

  async function handleGenerateGoodFit() {
    setGeneratingFit(true);
    setFitError(null);
    try {
      const res = await fetch(`/api/tracker/${entry.id}/goodfit`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFitError(data?.error || "Failed to generate GoodFit");
        setGeneratingFit(false);
        return;
      }
      if (data?.good_fit) {
        setGoodFit(data.good_fit);
      } else {
        setFitError(data?.message || "Could not generate GoodFit — check profile and job details");
      }
    } catch {
      setFitError("Network error — try again");
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
    // If status changed and there's a transition note, add it to activity log
    const updatedNotes = [...activityNotes];
    if (status !== entry.status) {
      const noteText = transitionNote.trim()
        ? `Moved to ${stageDisplay[status] ?? status}: ${transitionNote.trim()}`
        : `Moved to ${stageDisplay[status] ?? status}`;
      updatedNotes.unshift({
        id: crypto.randomUUID(),
        text: noteText,
        timestamp: new Date().toISOString(),
      });
      setActivityNotes(updatedNotes);
    }
    onUpdate(entry.id, { status, notes: serializeNotes(updatedNotes) });
    setEditing(false);
    setQuickEdit(false);
    setTransitionNote("");
  }

  /* ── Computed values ── */

  const daysInStage = Math.floor(
    (Date.now() - new Date(entry.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysColor = getDaysColor(entry.status, daysInStage);
  const borderColor = statusBorderColor[entry.status] ?? "#9CA3AF";
  const fitSummary = extractFitSummary(goodFit);
  const actionHint = getActionHint(entry.status, daysInStage, activityNotes, isTerminal);

  /* ── Card front (3-zone layout) ── */

  const quickEditStageIdx = STAGES.indexOf(status);
  const quickEditChanged = status !== entry.status;

  const cardFront = (
    <div
      className="group relative max-w-[960px] overflow-hidden rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-[1px]"
      style={{
        borderTopWidth: "2px",
        borderTopColor: borderColor,
        backgroundImage: `linear-gradient(to bottom, ${borderColor}18, transparent 40%)`,
      }}
    >
      <div
        className="relative p-4 md:p-5 cursor-pointer"
        onClick={() => { if (!quickEdit) setSpotlight(true); }}
      >
        {/* Zone 1: Identity + Status */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[1rem] md:text-[1.125rem] font-bold leading-tight text-white">
              {entry.title}
            </h3>
            <p className="mt-0.5 text-[0.8125rem] text-[#B8BFC8]">{entry.company}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Quick-edit trigger */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setQuickEdit(!quickEdit); setStatus(entry.status); setTransitionNote(""); }}
              className="rounded-md p-1.5 text-[#9CA3AF] md:opacity-0 md:group-hover:opacity-100 hover:bg-[#222D3D] hover:text-[#6AD7A3] transition-all"
              title="Quick edit stage"
            >
              <Pencil size={14} strokeWidth={2} />
            </button>
            <span className={`text-[0.8125rem] font-semibold tabular-nums ${daysColor}`}>
              {daysInStage}d
            </span>
            <StatusPill status={entry.status} />
          </div>
        </div>

        {/* Quick-edit popover */}
        {quickEdit && (
          <div
            ref={quickEditRef}
            className="absolute right-2 left-2 top-12 z-20 md:left-auto md:right-4 md:w-[300px] rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#1A2332] p-3 md:p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Move to</p>

            {/* Styled status dropdown */}
            <div className="space-y-1 mb-3 max-h-[240px] overflow-y-auto">
              {[...STAGES, ...CLOSED].map((s) => {
                const c = statusBorderColor[s] ?? "#9CA3AF";
                const isActive = status === s;
                const isClosed = CLOSED.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-[rgba(255,255,255,0.08)]"
                        : "hover:bg-[rgba(255,255,255,0.04)]"
                    } ${isClosed && !isActive ? "opacity-60" : ""}`}
                    style={isActive ? { boxShadow: `inset 0 0 0 1px ${c}50` } : undefined}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full transition-transform ${isActive ? "scale-125" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                    <span className={`text-[0.8125rem] font-medium ${isActive ? "text-white" : "text-[#B8BFC8]"}`}>
                      {stageDisplay[s] ?? s}
                    </span>
                    {isActive && (
                      <Check size={14} strokeWidth={2.5} className="ml-auto shrink-0" style={{ color: c }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Transition note */}
            {quickEditChanged && (
              <input
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                placeholder={TRANSITION_PLACEHOLDERS[status] ?? "Add context..."}
                className="w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-2.5 py-1.5 text-[0.75rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3] mb-2"
              />
            )}

            {/* Confirm */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!quickEditChanged}
              className="w-full rounded-lg border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] py-1.5 text-[0.75rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.1)] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Check size={14} strokeWidth={2} />
                {quickEditChanged ? `Move to ${stageDisplay[status] ?? status}` : "Select a stage"}
              </span>
            </button>
          </div>
        )}

        {/* Zone 2: Signal Strip */}
        <div className="mt-2.5 space-y-1.5">
          {/* Fit summary line */}
          {fitSummary ? (
            <p className="text-[0.8125rem] leading-snug text-[#B8BFC8] line-clamp-2">
              {fitSummary}
            </p>
          ) : goodFit === null || goodFit === "" ? (
            <p className="text-[0.75rem] text-[#9CA3AF] italic">GoodFit pending</p>
          ) : null}

          {/* Metadata chips — salary is visually heavier */}
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.salary && (
              <span className="inline-flex h-[24px] items-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-2.5 text-[0.6875rem] font-semibold text-white">
                {entry.salary}
              </span>
            )}
            {entry.lane_label && (
              <span className="inline-flex h-[24px] items-center rounded-full border border-[#6AD7A3]/15 bg-[#6AD7A3]/5 px-2.5 text-[0.6875rem] text-[#6AD7A3]/80">
                {entry.lane_label}
              </span>
            )}
            {entry.source && entry.source !== "manual" && (
              <span className="inline-flex h-[24px] items-center rounded-full border border-[#9CA3AF]/15 bg-[#9CA3AF]/5 px-2.5 text-[0.6875rem] text-[#9CA3AF]/70">
                {entry.source}
              </span>
            )}
          </div>
        </div>

        {/* Zone 3: Action Hint */}
        {actionHint && (
          <div className="mt-2 flex items-center gap-1.5">
            <Clock size={12} strokeWidth={2} className={daysInStage >= (STALE_THRESHOLDS[entry.status]?.[0] ?? 3) ? "text-[#F59E0B]" : "text-[#9CA3AF]/60"} />
            <p className={`text-[0.75rem] italic ${daysInStage >= (STALE_THRESHOLDS[entry.status]?.[0] ?? 3) ? "text-[#F59E0B]/80" : "text-[#9CA3AF]/60"}`}>
              {actionHint}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (!spotlight) return cardFront;

  /* ── Spotlight overlay ── */

  const stageIdx = STAGES.indexOf(status);
  const statusChanged = status !== entry.status;

  return (
    <>
      {cardFront}
      <div className="spotlight-overlay" onClick={() => { setSpotlight(false); setEditing(false); setTransitionNote(""); }} />
      <div className="fixed inset-0 z-[52] flex flex-col items-center justify-center p-2 md:p-4" onClick={() => { setSpotlight(false); setEditing(false); setTransitionNote(""); }}>
        <div
          className="spotlight-card w-full max-w-2xl max-h-[min(85vh,720px)] overflow-y-auto rounded-[var(--radius-lg)] md:rounded-[var(--radius-xl)] border border-[rgba(255,255,255,0.12)] bg-[#171F28]"
          style={{
            borderTopWidth: "3px",
            borderTopColor: borderColor,
            boxShadow: `0 0 60px ${borderColor}20, var(--shadow-elevated)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-4 pb-3 md:p-6 md:pb-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[1.125rem] md:text-[1.3125rem] font-bold text-white">{entry.title}</h3>
              <p className="mt-0.5 md:mt-1 text-[0.8125rem] md:text-[0.9375rem] text-[#B8BFC8]">{entry.company}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:gap-3">
              <span className={`text-[0.8125rem] font-semibold tabular-nums ${daysColor}`}>{daysInStage}d</span>
              <StatusPill status={entry.status} />
              <button
                type="button"
                onClick={() => { setSpotlight(false); setEditing(false); setTransitionNote(""); }}
                className="rounded-lg p-2.5 -mr-1.5 text-[#9CA3AF] hover:bg-[#222D3D] hover:text-white"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-2 px-4 pb-3 md:px-6 md:pb-4">
            {entry.salary && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-3 text-[0.6875rem] font-semibold text-white">
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

          <div className="border-t border-[#2A3544] p-4 md:p-6 space-y-4">
            {/* Summary */}
            {entry.job_summary && (
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-1.5">Job Summary</p>
                <p className="text-[0.9375rem] leading-relaxed text-[#B8BFC8] italic">
                  {entry.job_summary}
                </p>
              </div>
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
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
                  handleGenerateGoodFit();
                }}
                disabled={generatingFit}
                className={`group/gf flex items-center justify-center gap-2.5 rounded-lg border border-[#6AD7A3]/30 bg-gradient-to-r from-[#0A2E1F] to-[#0F3325] px-6 py-2.5 transition-all hover:border-[#6AD7A3]/60 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${generatingFit ? "" : "animate-goodfit-glow"}`}
              >
                {/* Radar sweep icon */}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={`shrink-0 ${generatingFit ? "animate-radar-sweep-fast" : "animate-radar-sweep"}`}>
                  <circle cx="10" cy="10" r="8.5" stroke="#6AD7A3" strokeWidth="1" opacity="0.3" />
                  <circle cx="10" cy="10" r="5" stroke="#6AD7A3" strokeWidth="1" opacity="0.2" />
                  <circle cx="10" cy="10" r="1.5" fill="#6AD7A3" />
                  <path d="M10 10 L10 1.5" stroke="#6AD7A3" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
                  <path d="M10 10 L10 1.5" stroke="#A9F2C4" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" style={{ filter: "blur(2px)" }} />
                </svg>
                <span className="text-[0.8125rem] font-semibold text-[#6AD7A3]">
                  {generatingFit ? "Scanning..." : "Generate GoodFit"}
                </span>
              </button>
            )}
            {fitError && (
              <p className="text-[0.75rem] text-[#DC2626]">{fitError}</p>
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
                          className="shrink-0 rounded-lg p-2 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#DC2626]/10 md:opacity-0 md:group-hover/note:opacity-100 transition-all"
                        >
                          <X size={14} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit mode */}
            {editing ? (
              <div className="space-y-4">
                {/* Pipeline selector */}
                <div>
                  <label className="mb-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Pipeline Status</label>

                  {/* Stage pipeline — connected dots */}
                  <div className="flex items-center gap-0">
                    {STAGES.map((s, i) => {
                      const c = statusBorderColor[s] ?? "#9CA3AF";
                      const isActive = status === s;
                      const isPast = stageIdx >= 0 && i < stageIdx;
                      return (
                        <div key={s} className="flex items-center">
                          <button
                            type="button"
                            onClick={() => setStatus(s)}
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
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                ["--dot-color" as any]: `${c}60`,
                              }}
                            />
                            <span className={`text-[0.5625rem] font-medium whitespace-nowrap transition-colors ${
                              isActive ? "text-white" : "text-[#9CA3AF] group-hover/stage:text-[#B8BFC8]"
                            }`}>
                              {stageDisplay[s] ?? s}
                            </span>
                          </button>
                          {/* Connector line */}
                          {i < STAGES.length - 1 && (
                            <div
                              className="h-[2px] w-4 md:w-6 mx-0.5"
                              style={{
                                backgroundColor: isPast ? `${c}60` : "#2A3544",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Terminal states */}
                  <div className="mt-3 flex gap-1.5">
                    {CLOSED.map((s) => {
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

                {/* Transition note (shown when status changes) */}
                {statusChanged && (
                  <div>
                    <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
                      Note (optional)
                    </label>
                    <input
                      value={transitionNote}
                      onChange={(e) => setTransitionNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                      placeholder={TRANSITION_PLACEHOLDERS[status] ?? "Add context for this change..."}
                      className="w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[0.8125rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleSave} className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] px-4 text-[0.8125rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.1)]">
                    <Check size={16} strokeWidth={2} />
                    Save
                  </button>
                  <button type="button" onClick={() => { setEditing(false); setStatus(entry.status); setTransitionNote(""); }} className="inline-flex h-[34px] items-center rounded-full border border-[#2A3544] px-4 text-[0.8125rem] text-[#9CA3AF]">Cancel</button>
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

        {/* Sticky close button — always visible at bottom */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSpotlight(false); setEditing(false); setTransitionNote(""); }}
          className="mt-3 shrink-0 inline-flex h-[44px] items-center justify-center gap-2 rounded-full border border-[#2A3544] bg-[#151C24] px-8 text-[0.875rem] font-medium text-[#B8BFC8] shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:border-[#9CA3AF]/30 hover:text-white transition-colors"
        >
          <X size={18} strokeWidth={2} />
          Close
        </button>
      </div>
    </>
  );
}

export { parseNotes, serializeNotes, relativeTime, STAGES, CLOSED, stageDisplay, statusBorderColor };
export type { ActivityNote };
