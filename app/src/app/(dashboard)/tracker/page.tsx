"use client";

import { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import DetailCard from "@/components/tracker-ds/detail-card";
import PipelineBoard from "@/components/tracker-ds/pipeline-board";
import ManualAddDialog from "@/components/ui/manual-add-dialog";
import { Button } from "@/components/design-system";
import { useProfileLock } from "@/hooks/use-profile-lock";
import { STAGES, CLOSED_STATUSES, ALL_STAGE_META } from "@/components/tracker-ds/shared";
import type { Database } from "@/types/database";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];
type DisplayMode = "detail" | "pipeline";
type Scope = number | "all" | "closed";

const SWIPEABLE_SCOPES: Scope[] = [0, 1, 2, 3, 4, 5, "closed"];

export default function TrackerPage() {
  const searchParams = useSearchParams();
  const viewAsId = searchParams.get("view_as");

  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>(0);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("detail");
  const [showManualAdd, setShowManualAdd] = useState(false);
  const { locked: profileLocked } = useProfileLock();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const pillContainerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const touchRef = useRef<{ x: number; y: number; t: number; locked: boolean | null } | null>(null);

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

  useEffect(() => {
    if (scope === "all") return;
    const idx = scope === "closed" ? 6 : (scope as number);
    const pill = pillRefs.current[idx];
    const container = pillContainerRef.current;
    if (!pill || !container) return;

    const pillLeft = pill.offsetLeft;
    const pillWidth = pill.offsetWidth;
    const containerWidth = container.offsetWidth;
    const scrollTarget = pillLeft - containerWidth / 2 + pillWidth / 2;

    container.scrollTo({ left: scrollTarget, behavior: "smooth" });
  }, [scope]);

  const stageCounts = STAGES.map(
    (s) => entries.filter((e) => e.status === s.label).length,
  );
  const closedCount = entries.filter((e) => CLOSED_STATUSES.includes(e.status)).length;
  const totalCount = entries.length;

  function handleSwipeNav(direction: "left" | "right") {
    if (typeof window !== "undefined" && window.innerWidth >= 768) return;
    if (displayMode !== "detail") return;

    const currentIdx =
      scope === "all"
        ? -1
        : scope === "closed"
          ? 6
          : (scope as number);
    let nextIdx: number;

    if (direction === "left") {
      nextIdx = currentIdx < 6 ? currentIdx + 1 : 6;
      if (scope === "all") nextIdx = 0;
    } else {
      if (scope === "all" || currentIdx <= 0) return;
      nextIdx = currentIdx - 1;
    }

    setSlideDirection(direction === "left" ? "left" : "right");
    setScope(SWIPEABLE_SCOPES[nextIdx]);
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
    if (touchRef.current.locked === null && (dx > 10 || dy > 10)) {
      touchRef.current.locked = dx > dy;
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

  function filterBySearch(list: TrackerEntry[]) {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (e) =>
        (e.title ?? "").toLowerCase().includes(q) ||
        (e.company ?? "").toLowerCase().includes(q),
    );
  }

  function sortEntries(list: TrackerEntry[]) {
    return [...list].sort((a, b) => {
      const aTime = new Date(a.added_at ?? a.updated_at).getTime();
      const bTime = new Date(b.added_at ?? b.updated_at).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });
  }

  function getStageEntries(stageLabel: string) {
    if (stageLabel === "__closed__") {
      return sortEntries(filterBySearch(entries.filter((e) => CLOSED_STATUSES.includes(e.status))));
    }
    return sortEntries(filterBySearch(entries.filter((e) => e.status === stageLabel)));
  }

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    const prev = entries;
    setEntries((cur) =>
      cur.map((e) => (e.id === id ? ({ ...e, ...patch } as TrackerEntry) : e)),
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
      setEntries(prev);
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Failed to update");
    }
  }

  async function handleDelete(id: string) {
    const prev = entries;
    setEntries((cur) => cur.filter((e) => e.id !== id));
    const url = viewAsId
      ? `/api/admin/view-as/tracker/${id}?client_id=${viewAsId}`
      : `/api/tracker/${id}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      setEntries(prev);
      toast.error("Failed to remove");
    }
  }

  async function handleManualAdd(data: {
    title: string;
    company: string;
    url?: string;
    location?: string;
    notes?: string;
    status?: string;
  }) {
    const url = viewAsId
      ? `/api/admin/view-as/tracker/manual-add?client_id=${viewAsId}`
      : "/api/tracker/manual-add";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const entry = await res.json();
      setEntries((cur) => [entry, ...cur]);
      setShowManualAdd(false);
      toast.success("Added to Tracker");
    } else if (res.status === 409) {
      toast.error("Job with this URL already tracked");
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error ?? "Failed to add");
    }
  }

  const currentStageLabel =
    scope === "all"
      ? null
      : scope === "closed"
        ? "__closed__"
        : STAGES[scope as number]?.label ?? null;

  return (
    <div className="font-[family-name:var(--font-ds-sans)] text-[var(--ds-text-1)]">
      {/* Controls bar */}
      <div className="sticky top-0 z-10 border-b border-[var(--ds-border-1)] bg-[var(--ds-bg-1)] px-4 md:px-6 py-3 space-y-2">
        {/* Stage pills */}
        <div ref={pillContainerRef} className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <StagePill
            active={scope === "all"}
            onClick={() => setScope("all")}
            label="All"
            count={totalCount}
          />
          {STAGES.map((stage, i) => (
            <StagePill
              key={stage.label}
              ref={(el) => {
                pillRefs.current[i] = el;
              }}
              active={scope === i}
              onClick={() => setScope(i)}
              label={stage.display}
              color={stage.color}
              count={stageCounts[i]}
            />
          ))}
          <StagePill
            ref={(el) => {
              pillRefs.current[6] = el;
            }}
            active={scope === "closed"}
            onClick={() => setScope("closed")}
            label="Closed"
            color="#6B7280"
            count={closedCount}
          />

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* Detail | Pipeline toggle */}
            <div
              className="hidden md:inline-flex rounded-[var(--ds-radius-md)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-2)] overflow-hidden"
              role="tablist"
              aria-label="Display mode"
            >
              <button
                type="button"
                onClick={() => setDisplayMode("detail")}
                role="tab"
                aria-selected={displayMode === "detail"}
                className={[
                  "px-3 py-1.5 text-[12px] font-medium transition-colors",
                  displayMode === "detail"
                    ? "bg-[var(--ds-accent-soft)] text-[var(--ds-accent-bright)]"
                    : "text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)]",
                ].join(" ")}
              >
                Detail
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode("pipeline")}
                role="tab"
                aria-selected={displayMode === "pipeline"}
                className={[
                  "px-3 py-1.5 text-[12px] font-medium transition-colors",
                  displayMode === "pipeline"
                    ? "bg-[var(--ds-accent-soft)] text-[var(--ds-accent-bright)]"
                    : "text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)]",
                ].join(" ")}
              >
                Pipeline
              </button>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowManualAdd(true)}
              icon={<Plus size={14} strokeWidth={2} />}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Search + sort (hidden in pipeline view) */}
        {displayMode === "detail" ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                strokeWidth={2}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]"
                aria-hidden
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or company…"
                className="w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-2)] py-1.5 pl-8 pr-3 text-[13px] text-[var(--ds-text-0)] placeholder-[var(--ds-text-3)] outline-none focus:border-[var(--ds-accent)]"
              />
            </div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
              className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-2)] px-2 py-1.5 text-[13px] text-[var(--ds-text-2)] outline-none focus:border-[var(--ds-accent)]"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={
          slideDirection === "left"
            ? "animate-slide-stage-left"
            : slideDirection === "right"
              ? "animate-slide-stage-right"
              : undefined
        }
        onAnimationEnd={() => setSlideDirection(null)}
      >
        {displayMode === "pipeline" ? (
          <PipelineBoard
            entries={filterBySearch(entries)}
            loading={loading}
            onUpdate={handleUpdate}
          />
        ) : scope === "all" ? (
          <AllDetailView
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
          <SingleStageDetailView
            stageEntries={getStageEntries(currentStageLabel ?? "")}
            stageLabel={currentStageLabel ?? ""}
            loading={loading}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            locked={profileLocked}
            viewAsId={viewAsId}
          />
        )}
      </div>

      {/* Stage dot indicators (mobile, detail view only) */}
      {scope !== "all" && displayMode === "detail" ? (
        <div className="flex justify-center gap-1.5 py-3 md:hidden">
          {SWIPEABLE_SCOPES.map((s, i) => {
            const color =
              s === "closed" ? "#6B7280" : STAGES[s as number]?.color ?? "#6B7280";
            const active =
              scope === s || (scope === "closed" && s === "closed");
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const currentIdx =
                    scope === "closed" ? 6 : (scope as number);
                  setSlideDirection(currentIdx < i ? "left" : "right");
                  setScope(s);
                }}
                className="p-1"
                aria-label={s === "closed" ? "Closed" : STAGES[s as number]?.display}
              >
                <span
                  className={["block rounded-full transition-all", active ? "h-2 w-2" : "h-1.5 w-1.5"].join(" ")}
                  style={{ backgroundColor: active ? color : "var(--ds-border-3)" }}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      {showManualAdd ? (
        <ManualAddDialog onClose={() => setShowManualAdd(false)} onSubmit={handleManualAdd} />
      ) : null}
    </div>
  );
}

/* ── Stage pill (top filter row) ── */
const StagePill = forwardRef<
  HTMLButtonElement,
  {
    active: boolean;
    onClick: () => void;
    label: string;
    color?: string;
    count: number;
  }
>(function StagePill({ active, onClick, label, color, count }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={[
        "whitespace-nowrap inline-flex items-center gap-1.5 rounded-[var(--ds-radius-full)] px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] transition-colors",
        active ? "" : "text-[var(--ds-text-2)] opacity-80 hover:opacity-100",
      ].join(" ")}
      style={
        active
          ? color
            ? { color, backgroundColor: `${color}14`, border: `1px solid ${color}55` }
            : {
                color: "var(--ds-signal)",
                backgroundColor: "var(--ds-signal-soft)",
                border: "1px solid rgba(232,197,107,0.40)",
              }
          : { border: "1px solid transparent" }
      }
    >
      {color ? (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      ) : null}
      <span>{label}</span>
      {count > 0 ? (
        <span className="font-[family-name:var(--font-ds-mono)] text-[11px] opacity-80 tabular-nums">
          {count}
        </span>
      ) : null}
    </button>
  );
});

/* ── Single stage detail view ── */
function SingleStageDetailView({
  stageEntries,
  stageLabel,
  loading,
  onUpdate,
  onDelete,
  locked,
  viewAsId,
}: {
  stageEntries: TrackerEntry[];
  stageLabel: string;
  loading: boolean;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  locked?: boolean;
  viewAsId?: string | null;
}) {
  const meta =
    stageLabel === "__closed__"
      ? { display: "Closed", color: "#6B7280" }
      : ALL_STAGE_META[stageLabel] ?? { display: stageLabel, color: "#6B7280" };

  return (
    <div className="min-h-[40vh]">
      <div className="space-y-3 md:space-y-4 p-3 md:p-6">
        {loading ? (
          <>
            <div className="h-28 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
            <div className="h-28 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
          </>
        ) : stageEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)]"
              style={{
                backgroundColor: `${meta.color}14`,
                border: `1px solid ${meta.color}44`,
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            </div>
            <p className="text-[14px] font-medium text-[var(--ds-text-0)]">
              No jobs in {meta.display} yet
            </p>
            <p className="mt-1 text-[12px] text-[var(--ds-text-2)]">
              {stageLabel === "Prospect"
                ? "Add jobs from the inbox or manually."
                : stageLabel === "__closed__"
                  ? "Nothing has been closed yet."
                  : `Move entries here when you've reached ${meta.display}.`}
            </p>
          </div>
        ) : (
          stageEntries.map((entry) => (
            <DetailCard
              key={entry.id}
              entry={entry}
              onUpdate={onUpdate}
              onDelete={onDelete}
              locked={locked}
              viewAsId={viewAsId}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── All stages detail view (grouped) ── */
function AllDetailView({
  entries,
  loading,
  search,
  sortOrder,
  onUpdate,
  onDelete,
  locked,
  viewAsId,
}: {
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
    return (
      <div className="p-3 md:p-6 space-y-3">
        <div className="h-28 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
        <div className="h-28 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
      </div>
    );
  }

  const q = search.toLowerCase();
  function matches(e: TrackerEntry) {
    if (!q) return true;
    return (
      (e.title ?? "").toLowerCase().includes(q) ||
      (e.company ?? "").toLowerCase().includes(q)
    );
  }
  function sortList(list: TrackerEntry[]) {
    return [...list].sort((a, b) => {
      const aTime = new Date(a.added_at ?? a.updated_at).getTime();
      const bTime = new Date(b.added_at ?? b.updated_at).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });
  }

  return (
    <div className="p-3 md:p-6 space-y-6">
      {STAGES.map((stage) => {
        const stageEntries = sortList(
          entries.filter((e) => e.status === stage.label && matches(e)),
        );
        if (stageEntries.length === 0) return null;
        return (
          <section key={stage.label}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: stage.color }}
                aria-hidden
              />
              <h3
                className="text-[12px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: stage.color }}
              >
                {stage.display}
              </h3>
              <span className="font-[family-name:var(--font-ds-mono)] text-[11px] text-[var(--ds-text-3)] tabular-nums">
                {stageEntries.length}
              </span>
              <div className="flex-1 h-px bg-[var(--ds-border-1)]" />
            </div>
            <div className="space-y-3">
              {stageEntries.map((entry) => (
                <DetailCard
                  key={entry.id}
                  entry={entry}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  locked={locked}
                  viewAsId={viewAsId}
                />
              ))}
            </div>
          </section>
        );
      })}
      {(() => {
        const closed = sortList(
          entries.filter((e) => CLOSED_STATUSES.includes(e.status) && matches(e)),
        );
        if (closed.length === 0) return null;
        return (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-text-3)]" aria-hidden />
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--ds-text-3)]">
                Closed
              </h3>
              <span className="font-[family-name:var(--font-ds-mono)] text-[11px] text-[var(--ds-text-3)] tabular-nums">
                {closed.length}
              </span>
              <div className="flex-1 h-px bg-[var(--ds-border-1)]" />
            </div>
            <div className="space-y-3">
              {closed.map((entry) => (
                <DetailCard
                  key={entry.id}
                  entry={entry}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  locked={locked}
                  viewAsId={viewAsId}
                />
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}
