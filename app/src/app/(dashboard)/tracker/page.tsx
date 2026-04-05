"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";
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

const ALL_STATUSES = [...STAGES.map((s) => s.label), "Rejected", "Ghosted", "Withdrawn"];

const STAGE_ORDER: Record<string, number> = {};
ALL_STATUSES.forEach((s, i) => { STAGE_ORDER[s] = i; });

export default function TrackerPage() {
  const searchParams = useSearchParams();
  const viewAsId = searchParams.get("view_as");

  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>(0);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cards");
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const pillContainerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  // Scroll active pill into view when scope changes
  useEffect(() => {
    if (scope === "all") return;
    const pill = pillRefs.current[scope];
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
  const totalCount = entries.length;

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
    return sortEntries(filterBySearch(entries.filter((e) => e.status === stageLabel)));
  }

  const currentStage = scope !== "all" ? STAGES[scope] : null;

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

          {/* Closed count indicator */}
          {(() => {
            const closedCount = entries.filter((e) => ["Rejected", "Ghosted", "Withdrawn"].includes(e.status)).length;
            if (closedCount === 0) return null;
            return (
              <span className="whitespace-nowrap text-[0.6875rem] text-[#4B5563] opacity-50 pl-1">
                Closed {closedCount}
              </span>
            );
          })()}

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
      {scope === "all" ? (
        // All stages — grouped by stage in current display mode
        displayMode === "cards" ? (
          <AllCardsView
            stages={STAGES}
            entries={entries}
            loading={loading}
            search={search}
            sortOrder={sortOrder}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <AllOpsTable
            entries={filterBySearch(entries)}
            loading={loading}
            sortOrder={sortOrder}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )
      ) : displayMode === "ops" ? (
        <OpsTable entries={getStageEntries(currentStage!.label)} loading={loading} onUpdate={handleUpdate} onDelete={handleDelete} />
      ) : (
        <SingleStageCardsView
          stageEntries={getStageEntries(currentStage!.label)}
          currentStage={currentStage!}
          activeStage={scope as number}
          loading={loading}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
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
}: {
  stageEntries: TrackerEntry[];
  currentStage: { label: string; display: string; color: string };
  activeStage: number;
  loading: boolean;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
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
            <TrackerCard key={entry.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
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
}: {
  stages: typeof STAGES;
  entries: TrackerEntry[];
  loading: boolean;
  search: string;
  sortOrder: "newest" | "oldest";
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
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
                <TrackerCard key={entry.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
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
                <TrackerCard key={entry.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Ops Mode: dense table with inline status changes (single-stage) ── */

function OpsTable({
  entries,
  loading,
  onUpdate,
  onDelete,
}: {
  entries: TrackerEntry[];
  loading: boolean;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) return <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg" />)}</div>;
  if (entries.length === 0) return <p className="py-12 text-center text-[0.8125rem] text-[#9CA3AF]">No entries in this stage</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b border-[#2A3544] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
            <th className="px-4 py-2.5">Title</th>
            <th className="px-4 py-2.5">Company</th>
            <th className="px-4 py-2.5">Salary</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Days</th>
            <th className="px-4 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const days = Math.floor((Date.now() - new Date(e.stage_changed_at).getTime()) / 86400000);
            const daysColor = days < 3 ? "text-[#6AD7A3]" : days < 7 ? "text-[#F59E0B]" : "text-[#DC2626]";
            return (
              <tr key={e.id} className="border-b border-[#2A3544]/40 hover:bg-[#222D3D]/30 transition-colors">
                <td className="px-4 py-2 font-medium text-white">
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#6AD7A3]">{e.title}</a>
                  ) : e.title}
                </td>
                <td className="px-4 py-2 text-[#B8BFC8]">{e.company}</td>
                <td className="px-4 py-2 text-[#B8BFC8]">{e.salary ?? "-"}</td>
                <td className="px-4 py-2">
                  <select
                    value={e.status}
                    onChange={(ev) => onUpdate(e.id, { status: ev.target.value })}
                    className="rounded border border-[#2A3544] bg-[#151C24] px-2 py-1 text-[0.6875rem] text-white outline-none focus:border-[#6AD7A3]"
                  >
                    {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className={`px-4 py-2 tabular-nums font-semibold ${daysColor}`}>{days}d</td>
                <td className="px-4 py-2">
                  <button type="button" onClick={() => onDelete(e.id)} className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[0.6875rem] text-[#DC2626] hover:bg-[#DC2626]/10 transition-colors">
                    <Trash2 size={14} strokeWidth={2} />
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── All Stages Ops Table (flat table with stage column, sorted by stage) ── */

type AllSortKey = "stage" | "days" | "company" | "title";

function AllOpsTable({
  entries,
  loading,
  sortOrder,
  onUpdate,
  onDelete,
}: {
  entries: TrackerEntry[];
  loading: boolean;
  sortOrder: "newest" | "oldest";
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<AllSortKey>("stage");
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: AllSortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sorted = [...entries].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "stage":
        cmp = (STAGE_ORDER[a.status] ?? 99) - (STAGE_ORDER[b.status] ?? 99);
        break;
      case "days": {
        const aDays = Date.now() - new Date(a.stage_changed_at).getTime();
        const bDays = Date.now() - new Date(b.stage_changed_at).getTime();
        cmp = aDays - bDays;
        break;
      }
      case "company":
        cmp = (a.company ?? "").localeCompare(b.company ?? "");
        break;
      case "title":
        cmp = (a.title ?? "").localeCompare(b.title ?? "");
        break;
    }
    if (cmp === 0) {
      const aTime = new Date(a.added_at ?? a.updated_at).getTime();
      const bTime = new Date(b.added_at ?? b.updated_at).getTime();
      cmp = sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    }
    return sortAsc ? cmp : -cmp;
  });

  if (loading) return <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg" />)}</div>;
  if (sorted.length === 0) return <p className="py-12 text-center text-[0.8125rem] text-[#9CA3AF]">No tracked entries yet</p>;

  const SortHeader = ({ label, k }: { label: string; k: AllSortKey }) => (
    <th
      className="px-4 py-2.5 cursor-pointer select-none hover:text-[#B8BFC8] transition-colors"
      onClick={() => handleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && (
          sortAsc ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />
        )}
      </span>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b border-[#2A3544] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
            <SortHeader label="Status" k="stage" />
            <SortHeader label="Title" k="title" />
            <SortHeader label="Company" k="company" />
            <th className="px-4 py-2.5">Salary</th>
            <SortHeader label="Days" k="days" />
            <th className="px-4 py-2.5">Lane</th>
            <th className="px-4 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => {
            const days = Math.floor((Date.now() - new Date(e.stage_changed_at).getTime()) / 86400000);
            const daysColor = days < 3 ? "text-[#6AD7A3]" : days < 7 ? "text-[#F59E0B]" : "text-[#DC2626]";
            const stageColor = statusBorderColor[e.status] ?? "#9CA3AF";
            return (
              <tr key={e.id} className="border-b border-[#2A3544]/40 hover:bg-[#222D3D]/30 transition-colors">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stageColor }} />
                    <select
                      value={e.status}
                      onChange={(ev) => onUpdate(e.id, { status: ev.target.value })}
                      className="rounded border border-[#2A3544] bg-[#151C24] px-2 py-1 text-[0.6875rem] text-white outline-none focus:border-[#6AD7A3]"
                    >
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </td>
                <td className="px-4 py-2 font-medium text-white">
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#6AD7A3]">{e.title}</a>
                  ) : e.title}
                </td>
                <td className="px-4 py-2 text-[#B8BFC8]">{e.company}</td>
                <td className="px-4 py-2 text-[#B8BFC8]">{e.salary ?? "-"}</td>
                <td className={`px-4 py-2 tabular-nums font-semibold ${daysColor}`}>{days}d</td>
                <td className="px-4 py-2 text-[0.6875rem] text-[#6AD7A3]">{e.lane_label ?? "-"}</td>
                <td className="px-4 py-2">
                  <button type="button" onClick={() => onDelete(e.id)} className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[0.6875rem] text-[#DC2626] hover:bg-[#DC2626]/10 transition-colors">
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
