"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, ChevronDown, Briefcase } from "lucide-react";
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
import TrackerCard, {
  statusBorderColor,
} from "@/components/tracker/tracker-card";
import SkeletonCard from "@/components/inbox/skeleton-card";
import ManualAddDialog from "@/components/ui/manual-add-dialog";
import type { Database } from "@/types/database";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];
type DisplayMode = "cards" | "ops";
type Scope = number | "all"; // stage index or "all"

const STAGES = [
  { label: "Prospect", display: "Prospect", color: "#1DD3B0" },
  { label: "Applied", display: "Applied", color: "#3B82F6" },
  { label: "Interview 1", display: "1st Interview", color: "#8B5CF6" },
  { label: "Interview 2", display: "2nd Interview", color: "#8B5CF6" },
  { label: "Final", display: "Final", color: "#F59E0B" },
  { label: "Offer", display: "Offer", color: "#22C55E" },
];

const CLOSED_STAGE = { label: "Closed", display: "Closed", color: "#4B5563" };
const CLOSED_STATUSES = ["Rejected", "Ghosted", "Withdrawn"];
const SWIPEABLE_STAGES = [...STAGES, CLOSED_STAGE]; // 0-6: 6 pipeline + 1 closed


export default function TrackerPage() {
  const searchParams = useSearchParams();
  const viewAsId = searchParams.get("view_as");

  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>(0);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cards");
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [profileLocked, setProfileLocked] = useState(false);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const pillContainerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const touchRef = useRef<{ x: number; y: number; t: number; locked: boolean | null } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const url = viewAsId
      ? `/api/admin/view-as/tracker?client_id=${viewAsId}`
      : "/api/tracker";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries ?? []);
    }
    setLoading(false);
  }, [viewAsId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Check profile lock status
  useEffect(() => {
    const url = viewAsId
      ? `/api/admin/view-as/profile?client_id=${viewAsId}`
      : "/api/profile";
    fetch(url).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setProfileLocked(data.status === "inactive_soft_locked");
      }
    });
  }, [viewAsId]);

  // Scroll active pill into view when scope changes
  useEffect(() => {
    if (scope === "all") return;
    const pill = pillRefs.current[scope as number];
    const container = pillContainerRef.current;
    if (!pill || !container) return;

    const pillLeft = pill.offsetLeft;
    const pillWidth = pill.offsetWidth;
    const containerWidth = container.offsetWidth;
    const scrollTarget = pillLeft - containerWidth / 2 + pillWidth / 2;

    container.scrollTo({ left: scrollTarget, behavior: "smooth" });
  }, [scope]);

  const stageCounts = STAGES.map(
    (s) => entries.filter((e) => e.status === s.label).length
  );
  const closedCount = entries.filter((e) => CLOSED_STATUSES.includes(e.status)).length;
  const totalCount = entries.length;

  // Swipe to navigate stages (mobile only)
  function handleSwipeNav(direction: "left" | "right") {
    if (typeof window !== "undefined" && window.innerWidth >= 768) return;
    if (displayMode !== "cards") return;

    const currentIdx = scope === "all" ? -1 : (scope as number);
    let nextIdx: number;

    if (direction === "left") {
      // swipe left = next stage
      nextIdx = currentIdx < 6 ? currentIdx + 1 : 6;
      if (scope === "all") nextIdx = 0;
    } else {
      // swipe right = prev stage
      if (scope === "all" || currentIdx <= 0) return;
      nextIdx = currentIdx - 1;
    }

    setSlideDirection(direction === "left" ? "left" : "right");
    setScope(nextIdx);
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), locked: null };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchRef.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchRef.current.x);
    const dy = Math.abs(t.clientY - touchRef.current.y);

    // Decide axis lock on first significant move
    if (touchRef.current.locked === null && (dx > 10 || dy > 10)) {
      touchRef.current.locked = dx > dy; // true = horizontal
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchRef.current || !touchRef.current.locked) {
      touchRef.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const elapsed = Date.now() - touchRef.current.t;
    const velocity = Math.abs(dx) / elapsed;

    if (Math.abs(dx) > 50 || velocity > 0.3) {
      handleSwipeNav(dx < 0 ? "left" : "right");
    }
    touchRef.current = null;
  }

  // Search filter helper
  function filterBySearch(list: TrackerEntry[]) {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (e) =>
        (e.title ?? "").toLowerCase().includes(q) ||
        (e.company ?? "").toLowerCase().includes(q)
    );
  }

  // Sort helper
  function sortEntries(list: TrackerEntry[]) {
    return [...list].sort((a, b) => {
      const aTime = new Date(a.added_at ?? a.updated_at).getTime();
      const bTime = new Date(b.added_at ?? b.updated_at).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });
  }

  // Get entries for current scope
  function getStageEntries(stageLabel: string) {
    if (stageLabel === "Closed") {
      return sortEntries(filterBySearch(entries.filter((e) => CLOSED_STATUSES.includes(e.status))));
    }
    return sortEntries(filterBySearch(entries.filter((e) => e.status === stageLabel)));
  }

  const currentStage = scope === "all" ? null : SWIPEABLE_STAGES[scope as number] ?? null;

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    const prevEntries = entries;
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } as TrackerEntry : e))
    );
    const url = viewAsId
      ? `/api/admin/view-as/tracker/${id}?client_id=${viewAsId}`
      : `/api/tracker/${id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setEntries(prevEntries);
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Failed to update");
    }
  }

  async function handleDelete(id: string) {
    const prevEntries = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const url = viewAsId
      ? `/api/admin/view-as/tracker/${id}?client_id=${viewAsId}`
      : `/api/tracker/${id}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      setEntries(prevEntries);
      toast.error("Failed to remove");
    }
  }

  async function handleManualAdd(data: { title: string; company: string; url?: string; location?: string; notes?: string; status?: string }) {
    const res = await fetch("/api/tracker/manual-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const entry = await res.json();
      setEntries((prev) => [entry, ...prev]);
      setShowManualAdd(false);
      toast.success("Added to Tracker");
    } else if (res.status === 409) {
      toast.error("Job with this URL already tracked");
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error ?? "Failed to add");
    }
  }

  return (
    <div>
      {/* Controls bar */}
      <div className="sticky top-0 z-10 border-b border-[#2A3544] bg-[#151C24] px-4 md:px-6 py-3 space-y-2">
        {/* Stage pills + controls */}
        <div ref={pillContainerRef} className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {/* "All" pill */}
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-all ${
              scope === "all"
                ? "bg-[#FAD76A]/15 text-[#FAD76A] ring-1 ring-[#FAD76A]/40"
                : "text-[#9CA3AF] opacity-60 hover:opacity-80"
            }`}
          >
            All
            {totalCount > 0 && <span className="ml-0.5 opacity-70">{totalCount}</span>}
          </button>

          {/* Stage pills */}
          {STAGES.map((stage, i) => (
            <button
              key={stage.label}
              ref={(el) => { pillRefs.current[i] = el; }}
              type="button"
              onClick={() => setScope(i)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-all ${
                scope === i ? "ring-1" : "opacity-60 hover:opacity-80"
              }`}
              style={{
                color: stage.color,
                backgroundColor: scope === i ? `${stage.color}15` : "transparent",
                ...(scope === i ? { boxShadow: `inset 0 0 0 1px ${stage.color}40` } : {}),
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
              <span>{stage.display}</span>
              {stageCounts[i] > 0 && <span className="ml-0.5 opacity-70">{stageCounts[i]}</span>}
            </button>
          ))}

          {/* Closed pill */}
          <button
            ref={(el) => { pillRefs.current[6] = el; }}
            type="button"
            onClick={() => setScope(6)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-all ${
              scope === 6 ? "ring-1" : "opacity-60 hover:opacity-80"
            }`}
            style={{
              color: CLOSED_STAGE.color,
              backgroundColor: scope === 6 ? `${CLOSED_STAGE.color}15` : "transparent",
              ...(scope === 6 ? { boxShadow: `inset 0 0 0 1px ${CLOSED_STAGE.color}40` } : {}),
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLOSED_STAGE.color }} />
            <span>Closed</span>
            {closedCount > 0 && <span className="ml-0.5 opacity-70">{closedCount}</span>}
          </button>

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* Display mode toggle: Cards | Ops */}
            <div className="flex rounded-full ring-1 ring-[#2A3544] overflow-hidden">
              <button
                type="button"
                onClick={() => setDisplayMode("cards")}
                className={`px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
                  displayMode === "cards"
                    ? "bg-[#6AD7A3]/15 text-[#6AD7A3]"
                    : "text-[#9CA3AF] hover:text-[#B8BFC8]"
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode("ops")}
                className={`px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
                  displayMode === "ops"
                    ? "bg-[#38BDF8]/15 text-[#38BDF8]"
                    : "text-[#9CA3AF] hover:text-[#B8BFC8]"
                }`}
              >
                Ops
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowManualAdd(true)}
              className="flex items-center gap-1 rounded-full bg-[#171F28] px-3 py-1.5 text-[0.6875rem] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20 hover:bg-[#6AD7A3]/10"
            >
              <Plus size={14} strokeWidth={2} />
              Add
            </button>
          </div>
        </div>

        {/* Search + sort row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or company..."
              className="w-full rounded-lg border border-[#2A3544] bg-[#171F28] py-1.5 pl-8 pr-3 text-[0.75rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
            />
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
            className="rounded-lg border border-[#2A3544] bg-[#171F28] px-2 py-1.5 text-[0.75rem] text-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={slideDirection === "left" ? "animate-slide-stage-left" : slideDirection === "right" ? "animate-slide-stage-right" : undefined}
        onAnimationEnd={() => setSlideDirection(null)}
      >
        {displayMode === "ops" ? (
          <TrackerKanbanBoard
            entries={filterBySearch(entries)}
            loading={loading}
            onUpdate={handleUpdate}
          />
        ) : scope === "all" ? (
            <AllCardsView
              stages={STAGES}
              entries={entries}
              loading={loading}
              search={search}
              sortOrder={sortOrder}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              locked={profileLocked}
              viewAsId={viewAsId}
            />
        ) : (
          <SingleStageCardsView
            stageEntries={getStageEntries(currentStage!.label)}
            currentStage={currentStage!}
            activeStage={scope as number}
            loading={loading}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            locked={profileLocked}
            viewAsId={viewAsId}
          />
        )}
      </div>

      {/* Stage dot indicators (mobile only) */}
      {scope !== "all" && displayMode === "cards" && (
        <div className="flex justify-center gap-1.5 py-3 md:hidden">
          {SWIPEABLE_STAGES.map((stage, i) => (
            <button
              key={stage.label}
              type="button"
              onClick={() => {
                setSlideDirection((scope as number) < i ? "left" : "right");
                setScope(i);
              }}
              className="p-1"
              aria-label={stage.display}
            >
              <span
                className={`block rounded-full transition-all ${scope === i ? "h-2 w-2" : "h-1.5 w-1.5"}`}
                style={{ backgroundColor: scope === i ? stage.color : "#2A3544" }}
              />
            </button>
          ))}
        </div>
      )}

      {showManualAdd && <ManualAddDialog onClose={() => setShowManualAdd(false)} onSubmit={handleManualAdd} />}
    </div>
  );
}

/* ── Single Stage Cards View ── */

function SingleStageCardsView({
  stageEntries,
  currentStage,
  activeStage,
  loading,
  onUpdate,
  onDelete,
  locked,
  viewAsId,
}: {
  stageEntries: TrackerEntry[];
  currentStage: { label: string; display: string; color: string };
  activeStage: number;
  loading: boolean;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  locked?: boolean;
  viewAsId?: string | null;
}) {
  return (
    <div className="min-h-[40vh]">
      <div className="space-y-3 md:space-y-4 p-3 md:p-6">
        {loading ? (
          <><SkeletonCard /><SkeletonCard /></>
        ) : stageEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${currentStage.color}15` }}>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: currentStage.color }} />
            </div>
            <p className="text-sm font-medium text-[#B8BFC8]">No jobs in {currentStage.display} yet</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              {activeStage === 0 ? "Add jobs from the inbox or manually" : `Move prospects here when you've ${currentStage.label.toLowerCase()}`}
            </p>
          </div>
        ) : (
          stageEntries.map((entry) => (
            <TrackerCard key={entry.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} locked={locked} viewAsId={viewAsId} />
          ))
        )}
      </div>
    </div>
  );
}

/* ── All Stages Cards View (grouped by stage) ── */

function AllCardsView({
  stages,
  entries,
  loading,
  search,
  sortOrder,
  onUpdate,
  onDelete,
  locked,
  viewAsId,
}: {
  stages: typeof STAGES;
  entries: TrackerEntry[];
  loading: boolean;
  search: string;
  sortOrder: "newest" | "oldest";
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  locked?: boolean;
  viewAsId?: string | null;
}) {
  if (loading) {
    return <div className="p-3 md:p-6 space-y-3"><SkeletonCard /><SkeletonCard /></div>;
  }

  const q = search.toLowerCase();

  return (
    <div className="p-3 md:p-6 space-y-6">
      {stages.map((stage) => {
        let stageEntries = entries.filter((e) => e.status === stage.label);
        if (q) {
          stageEntries = stageEntries.filter(
            (e) =>
              (e.title ?? "").toLowerCase().includes(q) ||
              (e.company ?? "").toLowerCase().includes(q)
          );
        }
        stageEntries.sort((a, b) => {
          const aTime = new Date(a.added_at ?? a.updated_at).getTime();
          const bTime = new Date(b.added_at ?? b.updated_at).getTime();
          return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
        });

        if (stageEntries.length === 0) return null;

        return (
          <div key={stage.label}>
            {/* Stage section header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
              <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.06em]" style={{ color: stage.color }}>
                {stage.display}
              </h3>
              <span className="text-[0.6875rem] text-[#9CA3AF]">{stageEntries.length}</span>
              <div className="flex-1 h-px bg-[#2A3544]" />
            </div>
            <div className="space-y-3">
              {stageEntries.map((entry) => (
                <TrackerCard key={entry.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} locked={locked} viewAsId={viewAsId} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Closed/terminal entries */}
      {(() => {
        const closedEntries = entries.filter((e) => ["Rejected", "Ghosted", "Withdrawn"].includes(e.status));
        if (closedEntries.length === 0) return null;
        let filtered = closedEntries;
        if (q) {
          filtered = filtered.filter(
            (e) =>
              (e.title ?? "").toLowerCase().includes(q) ||
              (e.company ?? "").toLowerCase().includes(q)
          );
        }
        if (filtered.length === 0) return null;
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-[#4B5563]" />
              <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">Closed</h3>
              <span className="text-[0.6875rem] text-[#9CA3AF]">{filtered.length}</span>
              <div className="flex-1 h-px bg-[#2A3544]" />
            </div>
            <div className="space-y-3">
              {filtered.map((entry) => (
                <TrackerCard key={entry.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} locked={locked} viewAsId={viewAsId} />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Ops Mode: Kanban Board with drag-and-drop ── */

function TrackerKanbanCard({
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

function TrackerKanbanColumn({
  stage,
  entries,
}: {
  stage: { label: string; display: string; color: string };
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
            entries.map((e) => <TrackerKanbanCard key={e.id} entry={e} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function TrackerKanbanBoard({
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
            <TrackerKanbanColumn
              key={stage.label}
              stage={stage}
              entries={byStage[stage.label] ?? []}
            />
          ))}
        </div>

        <DragOverlay>
          {activeEntry ? <TrackerKanbanCard entry={activeEntry} overlay /> : null}
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
