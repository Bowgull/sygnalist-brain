"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, ChevronDown } from "lucide-react";
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
import { statusBorderColor } from "@/components/tracker/tracker-card";
import type { Database } from "@/types/database";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];

interface PipelineStage {
  label: string;
  display: string;
  color: string;
}

const STAGES: PipelineStage[] = [
  { label: "Prospect", display: "Prospect", color: "#1DD3B0" },
  { label: "Applied", display: "Applied", color: "#3B82F6" },
  { label: "Interview 1", display: "1st Interview", color: "#8B5CF6" },
  { label: "Interview 2", display: "2nd Interview", color: "#8B5CF6" },
  { label: "Final", display: "Final", color: "#F59E0B" },
  { label: "Offer", display: "Offer", color: "#22C55E" },
];

const CLOSED_STATUSES = ["Rejected", "Ghosted", "Withdrawn"];

function TrackerPipelineCard({
  entry,
  overlay,
}: {
  entry: TrackerEntry;
  overlay?: boolean;
}) {
  const color = statusBorderColor[entry.status] ?? "#9CA3AF";

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
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className="group cursor-grab active:cursor-grabbing rounded-[var(--radius-lg)] p-px transition-all duration-150 hover:-translate-y-[1px]"
    >
      <div
        className="rounded-[var(--radius-lg)] px-3 py-2 transition-shadow duration-150 group-hover:shadow-[var(--shadow-elevated)]"
        style={{
          backgroundImage: `linear-gradient(${color}0a, ${color}05), linear-gradient(to bottom, #1A2230, #171F28)`,
          borderLeft: `2px solid ${color}`,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-[0.8125rem] font-semibold leading-snug text-white line-clamp-2">{entry.title}</h4>
            <p className="mt-0.5 text-[0.6875rem] text-[#9CA3AF] truncate">{entry.company}</p>
          </div>
          {entry.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 mt-0.5 rounded-md p-1 text-[#9CA3AF] hover:text-[#6AD7A3] hover:bg-[#6AD7A3]/10 transition-colors"
              title="View listing"
            >
              <Briefcase size={14} strokeWidth={2} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackerPipelineColumn({
  stage,
  entries,
}: {
  stage: PipelineStage;
  entries: TrackerEntry[];
}) {
  const ids = entries.map((e) => e.id);
  const { setNodeRef, isOver } = useDroppable({ id: stage.label });

  return (
    <div className="flex flex-col min-w-[180px]">
      {/* Column header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-[0.6875rem] font-bold uppercase tracking-[0.06em]" style={{ color: stage.color }}>
          {stage.display}
        </span>
        <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[0.5625rem] font-semibold tabular-nums text-[#9CA3AF]">
          {entries.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`min-h-[80px] flex-1 space-y-1.5 rounded-[var(--radius-lg)] p-1 transition-colors ${isOver ? "bg-[rgba(255,255,255,0.03)]" : ""}`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {entries.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[#2A3544] p-4 text-center text-[0.625rem] text-[#9CA3AF]">
              Empty
            </div>
          ) : (
            entries.map((e) => <TrackerPipelineCard key={e.id} entry={e} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export default function TrackerPipelineBoard({
  entries,
  loading,
  onUpdate,
}: {
  entries: TrackerEntry[];
  loading: boolean;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
}) {
  const [activeEntry, setActiveEntry] = useState<TrackerEntry | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Group by stage
  const byStage: Record<string, TrackerEntry[]> = {};
  for (const s of STAGES) byStage[s.label] = [];
  const closedEntries: TrackerEntry[] = [];

  for (const e of entries) {
    if (CLOSED_STATUSES.includes(e.status)) {
      closedEntries.push(e);
    } else if (byStage[e.status]) {
      byStage[e.status].push(e);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const entry = entries.find((e) => e.id === event.active.id);
    setActiveEntry(entry ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveEntry(null);
    const { active, over } = event;
    if (!over) return;

    const entry = entries.find((e) => e.id === active.id);
    if (!entry) return;

    let targetStatus: string | undefined;

    // Check if dropped on a column (stage label)
    const stageLabels = STAGES.map((s) => s.label);
    if (stageLabels.includes(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      // Dropped on a card — get that card's status
      const targetEntry = entries.find((e) => e.id === over.id);
      targetStatus = targetEntry?.status;
    }

    if (!targetStatus || targetStatus === entry.status) return;

    onUpdate(entry.id, { status: targetStatus, stage_changed_at: new Date().toISOString() });
    toast.success(`Moved to ${STAGES.find((s) => s.label === targetStatus)?.display ?? targetStatus}`);
  }

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto p-3 md:p-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="min-w-[180px] flex-1 space-y-2">
            <div className="h-5 w-20 animate-pulse rounded bg-[#171F28]" />
            <div className="h-14 animate-pulse rounded-[var(--radius-lg)] bg-[#171F28]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => (
            <TrackerPipelineColumn
              key={stage.label}
              stage={stage}
              entries={byStage[stage.label] ?? []}
            />
          ))}
        </div>

        <DragOverlay>
          {activeEntry ? <TrackerPipelineCard entry={activeEntry} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Terminal states — expandable count badge */}
      {closedEntries.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowClosed(!showClosed)}
            className="inline-flex items-center gap-2 rounded-full border border-[#2A3544] bg-[#171F28] px-3 py-1.5 text-[0.6875rem] font-medium text-[#9CA3AF] hover:text-white transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#4B5563]" />
            {closedEntries.length} closed
            <ChevronDown size={12} strokeWidth={2} className={`transition-transform ${showClosed ? "rotate-180" : ""}`} />
          </button>
          {showClosed && (
            <div className="mt-2 flex flex-wrap gap-2">
              {closedEntries.map((e) => {
                const c = statusBorderColor[e.status] ?? "#4B5563";
                return (
                  <div
                    key={e.id}
                    className="rounded-[var(--radius-lg)] px-3 py-2 text-[0.75rem]"
                    style={{
                      backgroundImage: `linear-gradient(${c}08, ${c}04), linear-gradient(to bottom, #1A2230, #171F28)`,
                      borderLeft: `2px solid ${c}`,
                    }}
                  >
                    <span className="font-medium text-white">{e.title}</span>
                    <span className="ml-2 text-[#9CA3AF]">{e.company}</span>
                    <span className="ml-2 text-[0.625rem] text-[#9CA3AF]">{e.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
