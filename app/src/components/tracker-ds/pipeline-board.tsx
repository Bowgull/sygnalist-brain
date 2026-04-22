"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Briefcase, ChevronDown, ChevronRight, ChevronLeft, Check } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/design-system";
import type { Database } from "@/types/database";
import { STAGES, CLOSED_STATUSES, ALL_STAGE_META } from "./shared";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];

interface PipelineBoardProps {
  entries: TrackerEntry[];
  loading: boolean;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
}

/** The pipeline board router: desktop Kanban with drag-drop, mobile single-stage focus. */
export default function TrackerPipelineBoard({ entries, loading, onUpdate }: PipelineBoardProps) {
  return (
    <div className="font-[family-name:var(--font-ds-sans)]">
      {/* Mobile: single-stage focus + tap-to-move */}
      <div className="md:hidden">
        <MobilePipeline entries={entries} loading={loading} onUpdate={onUpdate} />
      </div>
      {/* Desktop: full Kanban with drag-drop */}
      <div className="hidden md:block">
        <DesktopKanban entries={entries} loading={loading} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              Desktop Kanban                                */
/* ────────────────────────────────────────────────────────────────────────── */

function DesktopKanban({ entries, loading, onUpdate }: PipelineBoardProps) {
  const [activeEntry, setActiveEntry] = useState<TrackerEntry | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const byStage: Record<string, TrackerEntry[]> = {};
  for (const s of STAGES) byStage[s.label] = [];
  const closedEntries: TrackerEntry[] = [];
  for (const e of entries) {
    if (CLOSED_STATUSES.includes(e.status)) closedEntries.push(e);
    else if (byStage[e.status]) byStage[e.status].push(e);
  }

  function handleDragStart(event: DragStartEvent) {
    const entry = entries.find((e) => e.id === event.active.id);
    setActiveEntry(entry ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveEntry(null);
    const { active, over } = event;
    if (!over) return;

    const entry = entries.find((e) => e.id === active.id);
    if (!entry) return;

    let targetStatus: string | undefined;
    const stageLabels = STAGES.map((s) => s.label);
    if (stageLabels.includes(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      const targetEntry = entries.find((e) => e.id === over.id);
      targetStatus = targetEntry?.status;
    }

    if (!targetStatus || targetStatus === entry.status) return;

    onUpdate(entry.id, { status: targetStatus, stage_changed_at: new Date().toISOString() });
    toast.success(`Moved to ${ALL_STAGE_META[targetStatus]?.display ?? targetStatus}`);
  }

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto p-4 md:p-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="min-w-[200px] flex-1 space-y-2">
            <div className="h-4 w-24 animate-ds-shimmer rounded-[var(--ds-radius-sm)]" />
            <div className="h-16 animate-ds-shimmer rounded-[var(--ds-radius-md)]" />
            <div className="h-16 animate-ds-shimmer rounded-[var(--ds-radius-md)]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STAGES.map((stage) => (
            <PipelineColumn key={stage.label} stage={stage} entries={byStage[stage.label] ?? []} />
          ))}
        </div>

        <DragOverlay>
          {activeEntry ? <PipelineCard entry={activeEntry} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {closedEntries.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowClosed(!showClosed)}
            className="inline-flex items-center gap-2 rounded-[var(--ds-radius-full)] border border-[var(--ds-border-1)] bg-[var(--ds-bg-2)] px-3 py-1.5 text-[12px] font-medium text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)] transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-text-3)]" aria-hidden />
            {closedEntries.length} closed
            <ChevronDown
              size={12}
              strokeWidth={2}
              className={["transition-transform", showClosed ? "rotate-180" : ""].join(" ")}
            />
          </button>
          {showClosed ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {closedEntries.map((e) => {
                const meta = ALL_STAGE_META[e.status] ?? { display: e.status, color: "#6B7280" };
                return (
                  <div
                    key={e.id}
                    className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-1)] bg-[var(--ds-bg-2)] px-3 py-2 text-[13px]"
                  >
                    <span className="font-medium text-[var(--ds-text-0)]">{e.title}</span>
                    <span className="ml-2 text-[var(--ds-text-2)]">{e.company}</span>
                    <span
                      className="ml-2 font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.06em]"
                      style={{ color: meta.color }}
                    >
                      {meta.display}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PipelineColumn({
  stage,
  entries,
}: {
  stage: { label: string; display: string; color: string };
  entries: TrackerEntry[];
}) {
  const ids = entries.map((e) => e.id);
  const { setNodeRef, isOver } = useDroppable({ id: stage.label });

  return (
    <div className="flex flex-col min-w-[220px] w-[220px]">
      {/* Header — quieter: stage name + mono count */}
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: stage.color }}
          aria-hidden
        />
        <span
          className="text-[12px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: stage.color }}
        >
          {stage.display}
        </span>
        <span className="ml-auto font-[family-name:var(--font-ds-mono)] text-[11px] tabular-nums text-[var(--ds-text-3)]">
          {entries.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={[
          "min-h-[120px] flex-1 space-y-2 rounded-[var(--ds-radius-md)] p-1.5 transition-colors",
          isOver ? "bg-[var(--ds-accent-soft)] ring-1 ring-inset ring-[rgba(132,191,160,0.30)]" : "",
        ].join(" ")}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {entries.length === 0 ? (
            <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border-2)] p-4 text-center font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--ds-text-3)]">
              Empty
            </div>
          ) : (
            entries.map((e) => <PipelineCard key={e.id} entry={e} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function PipelineCard({ entry, overlay }: { entry: TrackerEntry; overlay?: boolean }) {
  const meta = ALL_STAGE_META[entry.status] ?? { display: entry.status, color: "#9CA3AF" };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    data: { status: entry.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={[
        "group cursor-grab active:cursor-grabbing rounded-[var(--ds-radius-md)]",
        "bg-[var(--ds-bg-1)] border border-[var(--ds-border-1)]",
        "transition-colors duration-[var(--ds-duration-fast)]",
        "hover:bg-[var(--ds-bg-2)] hover:border-[var(--ds-border-2)]",
      ].join(" ")}
      style={{
        ...(overlay ? {} : style),
        borderLeft: `2px solid ${meta.color}`,
      }}
    >
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-semibold leading-snug text-[var(--ds-text-0)] line-clamp-2">
              {entry.title}
            </h4>
            <p className="mt-0.5 text-[11px] text-[var(--ds-text-2)] truncate">{entry.company}</p>
          </div>
          {entry.url ? (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="shrink-0 mt-0.5 rounded-[var(--ds-radius-sm)] p-1 text-[var(--ds-text-3)] hover:text-[var(--ds-accent)] hover:bg-[var(--ds-accent-soft)] transition-colors"
              title="View listing"
              aria-label="View listing"
            >
              <Briefcase size={12} strokeWidth={2} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                 Mobile: single-stage focus + tap-to-move                   */
/* ────────────────────────────────────────────────────────────────────────── */

function MobilePipeline({ entries, loading, onUpdate }: PipelineBoardProps) {
  const [stageIdx, setStageIdx] = useState(0);
  const [showClosed, setShowClosed] = useState(false);

  const currentStage = STAGES[stageIdx];
  const stageEntries = entries.filter((e) => e.status === currentStage.label);
  const closedEntries = entries.filter((e) => CLOSED_STATUSES.includes(e.status));

  function goPrev() {
    setStageIdx((idx) => Math.max(0, idx - 1));
  }
  function goNext() {
    setStageIdx((idx) => Math.min(STAGES.length - 1, idx + 1));
  }

  return (
    <div className="p-3 space-y-3">
      {/* Stage picker — compact horizontal list */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={goPrev}
          disabled={stageIdx === 0}
          className="shrink-0 rounded-[var(--ds-radius-sm)] p-1.5 text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)] hover:bg-[var(--ds-bg-2)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Previous stage"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1">
            {STAGES.map((s, i) => {
              const active = i === stageIdx;
              const count = entries.filter((e) => e.status === s.label).length;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setStageIdx(i)}
                  className={[
                    "whitespace-nowrap inline-flex items-center gap-1.5 rounded-[var(--ds-radius-full)] px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active ? "" : "text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)]",
                  ].join(" ")}
                  style={
                    active
                      ? {
                          color: s.color,
                          backgroundColor: `${s.color}14`,
                          border: `1px solid ${s.color}55`,
                        }
                      : { border: "1px solid transparent" }
                  }
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  {s.display}
                  <span className="font-[family-name:var(--font-ds-mono)] tabular-nums opacity-80">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={stageIdx === STAGES.length - 1}
          className="shrink-0 rounded-[var(--ds-radius-sm)] p-1.5 text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)] hover:bg-[var(--ds-bg-2)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Next stage"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Current stage label */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: currentStage.color }}
            aria-hidden
          />
          <h2
            className="text-[14px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: currentStage.color }}
          >
            {currentStage.display}
          </h2>
        </div>
        <span className="font-[family-name:var(--font-ds-mono)] text-[11px] tabular-nums text-[var(--ds-text-3)]">
          {stageEntries.length} {stageEntries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Stage entries with tap-to-move */}
      {loading ? (
        <>
          <div className="h-20 animate-ds-shimmer rounded-[var(--ds-radius-md)]" />
          <div className="h-20 animate-ds-shimmer rounded-[var(--ds-radius-md)]" />
        </>
      ) : stageEntries.length === 0 ? (
        <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border-2)] p-8 text-center">
          <p className="text-[13px] text-[var(--ds-text-2)]">No entries in {currentStage.display}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stageEntries.map((entry) => (
            <MobilePipelineRow key={entry.id} entry={entry} onUpdate={onUpdate} />
          ))}
        </div>
      )}

      {/* Closed drawer */}
      {closedEntries.length > 0 ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowClosed(!showClosed)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-1)] bg-[var(--ds-bg-2)] px-3 py-2 text-[12px] font-medium text-[var(--ds-text-2)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-text-3)]" aria-hidden />
            {closedEntries.length} closed
            <ChevronDown
              size={12}
              strokeWidth={2}
              className={["transition-transform", showClosed ? "rotate-180" : ""].join(" ")}
            />
          </button>
          {showClosed ? (
            <div className="mt-2 space-y-1.5">
              {closedEntries.map((e) => {
                const meta = ALL_STAGE_META[e.status] ?? { display: e.status, color: "#6B7280" };
                return (
                  <div
                    key={e.id}
                    className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-1)] bg-[var(--ds-bg-2)] px-3 py-2"
                  >
                    <p className="text-[13px] font-medium text-[var(--ds-text-0)] truncate">{e.title}</p>
                    <p className="text-[11px] text-[var(--ds-text-2)] truncate">
                      {e.company}{" "}
                      <span
                        className="font-[family-name:var(--font-ds-mono)] uppercase tracking-[0.06em]"
                        style={{ color: meta.color }}
                      >
                        · {meta.display}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MobilePipelineRow({
  entry,
  onUpdate,
}: {
  entry: TrackerEntry;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function moveTo(target: string) {
    if (target === entry.status) {
      setMenuOpen(false);
      return;
    }
    onUpdate(entry.id, { status: target, stage_changed_at: new Date().toISOString() });
    toast.success(`Moved to ${ALL_STAGE_META[target]?.display ?? target}`);
    setMenuOpen(false);
  }

  const meta = ALL_STAGE_META[entry.status] ?? { display: entry.status, color: "#9CA3AF" };

  return (
    <div className="relative">
      <div
        className="rounded-[var(--ds-radius-md)] bg-[var(--ds-bg-1)] border border-[var(--ds-border-1)] shadow-[var(--ds-shadow-raise)]"
        style={{ borderLeft: `2px solid ${meta.color}` }}
      >
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-[14px] font-semibold leading-snug text-[var(--ds-text-0)]">
                {entry.title}
              </h4>
              <p className="mt-0.5 text-[12px] text-[var(--ds-text-2)] truncate">{entry.company}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMenuOpen((v) => !v)}>
              Move to…
            </Button>
            {entry.url ? (
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 px-2.5 rounded-[var(--ds-radius-sm)] text-[12px] text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)] hover:bg-[var(--ds-bg-2)] transition-colors ml-auto"
              >
                <Briefcase size={12} strokeWidth={2} />
                View
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div
          ref={menuRef}
          className="absolute z-20 left-3 right-3 top-full mt-1 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-2)] shadow-[var(--ds-shadow-elevate)] overflow-hidden"
        >
          <p className="px-3 pt-2.5 pb-1 font-[family-name:var(--font-ds-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--ds-text-3)]">
            Move to…
          </p>
          <div className="py-1">
            {STAGES.concat(
              [
                { label: "Rejected", display: "Rejected", color: "#DC2626" },
                { label: "Ghosted", display: "Ghosted", color: "#6B7280" },
                { label: "Withdrawn", display: "Withdrawn", color: "#6B7280" },
              ],
            ).map((s) => {
              const active = entry.status === s.label;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => moveTo(s.label)}
                  className={[
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors",
                    active ? "bg-[var(--ds-bg-3)]" : "hover:bg-[var(--ds-bg-3)]",
                  ].join(" ")}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className={active ? "text-[var(--ds-text-0)] font-medium" : "text-[var(--ds-text-1)]"}>
                    {s.display}
                  </span>
                  {active ? <Check size={14} strokeWidth={2.5} className="ml-auto" style={{ color: s.color }} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
