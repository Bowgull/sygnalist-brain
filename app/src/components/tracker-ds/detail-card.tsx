"use client";

import { useState, useEffect, useRef } from "react";
import { Pencil, Check, Trash2, X, ExternalLink, Send, Clock } from "lucide-react";
import { Button, Tag } from "@/components/design-system";
import Dialog from "@/components/design-system/dialog";
import type { Database } from "@/types/database";
import {
  ALL_STAGE_META,
  CLOSED_STATUSES,
  STAGES,
  CLOSED_STAGES,
  TRANSITION_PLACEHOLDERS,
  type ActivityNote,
  extractFitSummary,
  getActionHint,
  getDaysColor,
  parseNotes,
  relativeTime,
  serializeNotes,
} from "./shared";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];

interface DetailCardProps {
  entry: TrackerEntry;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  locked?: boolean;
  viewAsId?: string | null;
}

export default function DetailCard({ entry, onUpdate, onDelete, locked, viewAsId }: DetailCardProps) {
  const [spotlight, setSpotlight] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(entry.status);
  const [goodFit, setGoodFit] = useState(entry.good_fit);
  const [generatingFit, setGeneratingFit] = useState(false);
  const justGeneratedRef = useRef(false);
  const [transitionNote, setTransitionNote] = useState("");
  const [fitError, setFitError] = useState<string | null>(null);
  const [activityNotes, setActivityNotes] = useState<ActivityNote[]>(() =>
    parseNotes(entry.notes, entry.added_at ?? entry.updated_at),
  );
  const [newNote, setNewNote] = useState("");

  const isTerminal = CLOSED_STATUSES.includes(entry.status);
  const daysInStage = Math.floor(
    (Date.now() - new Date(entry.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24),
  );
  const daysColor = getDaysColor(entry.status, daysInStage);
  const currentMeta = ALL_STAGE_META[entry.status] ?? { display: entry.status, color: "#9CA3AF" };
  const fitSummary = extractFitSummary(goodFit);
  const actionHint = getActionHint(entry.status, daysInStage, activityNotes, isTerminal);

  // Reset edit state whenever the spotlight closes.
  useEffect(() => {
    if (!spotlight) {
      setEditing(false);
      setStatus(entry.status);
      setTransitionNote("");
    }
  }, [spotlight, entry.status]);

  async function handleGenerateGoodFit() {
    setGeneratingFit(true);
    setFitError(null);
    try {
      const url = viewAsId
        ? `/api/admin/view-as/tracker/${entry.id}/goodfit?client_id=${viewAsId}`
        : `/api/tracker/${entry.id}/goodfit`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFitError(data?.error || "Failed to generate GoodFit");
        setGeneratingFit(false);
        return;
      }
      if (data?.good_fit) {
        justGeneratedRef.current = true;
        setGoodFit(data.good_fit);
      } else {
        setFitError(data?.message || "Could not generate GoodFit — check profile and job details");
      }
    } catch {
      setFitError("Network error — try again");
    }
    setGeneratingFit(false);
  }

  function handleAddNote() {
    const text = newNote.trim();
    if (!text) return;
    const note: ActivityNote = { id: crypto.randomUUID(), text, timestamp: new Date().toISOString() };
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

  function handleSaveStageChange() {
    const updatedNotes = [...activityNotes];
    if (status !== entry.status) {
      const noteText = transitionNote.trim()
        ? `Moved to ${ALL_STAGE_META[status]?.display ?? status}: ${transitionNote.trim()}`
        : `Moved to ${ALL_STAGE_META[status]?.display ?? status}`;
      updatedNotes.unshift({
        id: crypto.randomUUID(),
        text: noteText,
        timestamp: new Date().toISOString(),
      });
      setActivityNotes(updatedNotes);
    }
    onUpdate(entry.id, { status, notes: serializeNotes(updatedNotes) });
    setEditing(false);
    setTransitionNote("");
  }

  const statusChanged = status !== entry.status;

  /* ── Card front ── */

  return (
    <>
      <article
        onClick={() => setSpotlight(true)}
        className={[
          "group relative rounded-[var(--ds-radius-lg)] border bg-[var(--ds-bg-1)] border-[var(--ds-border-1)]",
          "font-[family-name:var(--font-ds-sans)] text-[var(--ds-text-1)]",
          "shadow-[var(--ds-shadow-raise)] transition-colors duration-[var(--ds-duration-base)] ease-[var(--ds-ease)]",
          "hover:bg-[var(--ds-bg-2)] hover:border-[var(--ds-border-2)] cursor-pointer overflow-hidden",
        ].join(" ")}
        style={{
          borderTop: `2px solid ${currentMeta.color}`,
        }}
      >
        <div className="p-5">
          {/* Row 1: title + days + status */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] md:text-[18px] font-semibold text-[var(--ds-text-0)] leading-snug tracking-[-0.01em]">
                {entry.title}
              </h3>
              <p className="mt-1 text-[13px] text-[var(--ds-text-2)]">{entry.company}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span
                className="font-[family-name:var(--font-ds-mono)] text-[12px] tabular-nums"
                style={{ color: daysColor }}
                title={`${daysInStage} days in ${currentMeta.display}`}
              >
                {daysInStage}d
              </span>
              <StageBadge status={entry.status} />
            </div>
          </div>

          {/* Row 2: fit summary (if present) */}
          {fitSummary ? (
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--ds-text-1)] line-clamp-2 max-w-[70ch]">
              {fitSummary}
            </p>
          ) : goodFit === null || goodFit === "" ? (
            <p className="mt-3 font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--ds-text-3)]">
              Good Fit pending
            </p>
          ) : null}

          {/* Row 3: tags */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {entry.salary ? <Tag>{entry.salary}</Tag> : null}
            {entry.lane_label ? <Tag>{entry.lane_label}</Tag> : null}
            {entry.source && entry.source !== "manual" ? <Tag>{entry.source}</Tag> : null}
          </div>

          {/* Row 4: action hint */}
          {actionHint ? (
            <div className="mt-3 flex items-center gap-1.5">
              <Clock
                size={12}
                strokeWidth={2}
                style={{ color: daysColor }}
                aria-hidden
              />
              <p className="text-[12px] italic" style={{ color: daysColor }}>
                {actionHint}
              </p>
            </div>
          ) : null}
        </div>
      </article>

      {/* ── Spotlight dialog ── */}
      <Dialog
        open={spotlight}
        onClose={() => setSpotlight(false)}
        title={entry.title}
        description={entry.company}
        maxWidth={680}
        footer={
          editing ? (
            <>
              <Button
                variant="destructive"
                size="md"
                onClick={() => onDelete(entry.id)}
                icon={<Trash2 size={14} strokeWidth={2} />}
              >
                Remove
              </Button>
              <span className="flex-1" />
              <Button variant="ghost" size="md" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSaveStageChange}
                disabled={!statusChanged}
                icon={<Check size={14} strokeWidth={2} />}
              >
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setEditing(true)}
              icon={<Pencil size={14} strokeWidth={2} />}
            >
              Edit
            </Button>
          )
        }
      >
        {/* Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <StageBadge status={entry.status} />
          <span
            className="font-[family-name:var(--font-ds-mono)] text-[12px] tabular-nums px-1"
            style={{ color: daysColor }}
          >
            {daysInStage}d in stage
          </span>
          {entry.salary ? <Tag>{entry.salary}</Tag> : null}
          {entry.lane_label ? <Tag>{entry.lane_label}</Tag> : null}
          {entry.url ? (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border-1)] bg-[var(--ds-bg-2)] px-2 py-1 text-[12px] font-[family-name:var(--font-ds-mono)] text-[var(--ds-text-1)] hover:text-[var(--ds-text-0)] hover:border-[var(--ds-border-2)] transition-colors"
            >
              View listing
              <ExternalLink size={10} strokeWidth={2} />
            </a>
          ) : null}
        </div>

        {/* Summary */}
        {entry.job_summary ? (
          <div className="mb-4">
            <p className="font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--ds-text-3)] mb-1.5">
              Job summary
            </p>
            <p className="text-[14px] leading-relaxed text-[var(--ds-text-1)]">{entry.job_summary}</p>
          </div>
        ) : null}

        {/* GoodFit */}
        {goodFit ? (
          <div
            className={[
              "mb-4 rounded-[var(--ds-radius-md)] border border-[rgba(132,191,160,0.25)] bg-[var(--ds-accent-soft)] p-4",
              justGeneratedRef.current ? "animate-ds-dialog-enter" : "",
            ].join(" ")}
            onAnimationEnd={() => {
              justGeneratedRef.current = false;
            }}
          >
            <p className="font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--ds-accent-bright)] mb-1.5">
              Good Fit
            </p>
            <p className="text-[14px] leading-relaxed text-[var(--ds-text-1)] whitespace-pre-line">
              {goodFit}
            </p>
          </div>
        ) : !locked ? (
          <div className="mb-4">
            <Button
              variant="secondary"
              size="md"
              onClick={handleGenerateGoodFit}
              disabled={generatingFit}
              icon={
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" opacity="0.2" />
                  <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                  <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                </svg>
              }
            >
              {generatingFit ? "Generating…" : "Generate Good Fit"}
            </Button>
            {fitError ? (
              <p className="mt-2 text-[12px] text-[var(--ds-err)]">{fitError}</p>
            ) : null}
          </div>
        ) : null}

        {/* Notes */}
        <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-1)] bg-[var(--ds-bg-2)] p-4 mb-4">
          <p className="font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--ds-text-3)] mb-2">
            Notes
          </p>
          <div className="flex gap-2 mb-3">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddNote();
              }}
              placeholder="Add a note…"
              className="flex-1 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-1)] px-3 py-2 text-[13px] text-[var(--ds-text-0)] placeholder-[var(--ds-text-3)] outline-none focus:border-[var(--ds-accent)] font-[family-name:var(--font-ds-sans)]"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              icon={<Send size={14} strokeWidth={2} />}
              aria-label="Add note"
            >
              <span className="sr-only">Add note</span>
            </Button>
          </div>
          {activityNotes.length > 0 ? (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {activityNotes.map((note) => (
                <div key={note.id} className="group/note flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-relaxed text-[var(--ds-text-1)]">{note.text}</p>
                    <p className="font-[family-name:var(--font-ds-mono)] text-[11px] text-[var(--ds-text-3)] mt-0.5">
                      {relativeTime(note.timestamp)}
                    </p>
                  </div>
                  {editing ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="shrink-0 rounded-[var(--ds-radius-sm)] p-1.5 text-[var(--ds-text-3)] hover:text-[var(--ds-err)] hover:bg-[rgba(212,105,92,0.08)] md:opacity-0 md:group-hover/note:opacity-100 transition-all"
                      aria-label="Delete note"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[var(--ds-text-3)]">No notes yet.</p>
          )}
        </div>

        {/* Edit mode: pipeline selector */}
        {editing ? (
          <div className="space-y-3">
            <div>
              <p className="font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--ds-text-3)] mb-2">
                Pipeline stage
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((s) => (
                  <StagePickerButton
                    key={s.label}
                    label={s.label}
                    display={s.display}
                    color={s.color}
                    active={status === s.label}
                    onClick={() => setStatus(s.label)}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CLOSED_STAGES.map((s) => (
                  <StagePickerButton
                    key={s.label}
                    label={s.label}
                    display={s.display}
                    color={s.color}
                    active={status === s.label}
                    onClick={() => setStatus(s.label)}
                    muted
                  />
                ))}
              </div>
            </div>
            {statusChanged ? (
              <div>
                <p className="font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--ds-text-3)] mb-1.5">
                  Note (optional)
                </p>
                <input
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveStageChange();
                  }}
                  placeholder={TRANSITION_PLACEHOLDERS[status] ?? "Add context for this change…"}
                  className="w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-2)] px-3 py-2 text-[13px] text-[var(--ds-text-0)] placeholder-[var(--ds-text-3)] outline-none focus:border-[var(--ds-accent)] font-[family-name:var(--font-ds-sans)]"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

/** Small stage badge colored by the actual stage color (functional encoding). */
function StageBadge({ status }: { status: string }) {
  const meta = ALL_STAGE_META[status] ?? { display: status, color: "#9CA3AF" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-full)] border px-2 py-[3px] text-[11px] font-semibold font-[family-name:var(--font-ds-sans)] uppercase tracking-[0.06em]"
      style={{
        color: meta.color,
        backgroundColor: `${meta.color}14`,
        borderColor: `${meta.color}44`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />
      {meta.display}
    </span>
  );
}

function StagePickerButton({
  display,
  color,
  active,
  muted,
  onClick,
}: {
  label: string;
  display: string;
  color: string;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-[var(--ds-radius-full)] border px-3 py-1.5 text-[12px] font-medium transition-colors",
        "font-[family-name:var(--font-ds-sans)]",
        active ? "" : "border-[var(--ds-border-2)] text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)]",
        muted && !active ? "opacity-60 hover:opacity-100" : "",
      ].join(" ")}
      style={
        active
          ? {
              color,
              backgroundColor: `${color}14`,
              borderColor: `${color}55`,
            }
          : undefined
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {display}
      {active ? <Check size={12} strokeWidth={2.5} style={{ color }} /> : null}
    </button>
  );
}

