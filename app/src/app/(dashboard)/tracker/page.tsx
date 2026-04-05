"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Search, ExternalLink, Zap, ChevronDown, ChevronUp } from "lucide-react";
import TrackerCard, {
  parseNotes, relativeTime, STAGES as STAGE_LABELS,
  statusBorderColor, stageDisplay,
} from "@/components/tracker/tracker-card";
import SkeletonCard from "@/components/inbox/skeleton-card";
import ManualAddDialog from "@/components/ui/manual-add-dialog";
import type { Database } from "@/types/database";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];
type ViewMode = "cards" | "ops" | "all";

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

const VIEW_PILLS: { value: ViewMode; label: string }[] = [
  { value: "cards", label: "Cards" },
  { value: "ops", label: "Ops" },
  { value: "all", label: "All" },
];

export default function TrackerPage() {
  const searchParams = useSearchParams();
  const viewAsId = searchParams.get("view_as");

  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(0);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const touchStartX = useRef(0);
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

  // Scroll active pill into view when stage changes
  useEffect(() => {
    const pill = pillRefs.current[activeStage];
    const container = pillContainerRef.current;
    if (!pill || !container) return;

    const pillLeft = pill.offsetLeft;
    const pillWidth = pill.offsetWidth;
    const containerWidth = container.offsetWidth;
    const scrollTarget = pillLeft - containerWidth / 2 + pillWidth / 2;

    container.scrollTo({ left: scrollTarget, behavior: "smooth" });
  }, [activeStage]);

  const stageCounts = STAGES.map(
    (s) => entries.filter((e) => e.status === s.label).length
  );

  const currentStage = STAGES[activeStage];

  // Filter + search + sort for cards/ops view
  let stageEntries = entries.filter((e) => e.status === currentStage.label);
  if (search) {
    const q = search.toLowerCase();
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

  // All entries for All View (with search filter)
  let allEntries = [...entries];
  if (search) {
    const q = search.toLowerCase();
    allEntries = allEntries.filter(
      (e) =>
        (e.title ?? "").toLowerCase().includes(q) ||
        (e.company ?? "").toLowerCase().includes(q)
    );
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 60 && activeStage > 0) setActiveStage((prev) => prev - 1);
    else if (diff < -60 && activeStage < STAGES.length - 1) setActiveStage((prev) => prev + 1);
  }

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

  const showStagePills = viewMode !== "all";

  return (
    <div>
      {/* Controls bar */}
      <div className="sticky top-0 z-10 border-b border-[#2A3544] bg-[#151C24] px-4 md:px-6 py-3 space-y-2">
        {/* Stage pills + controls */}
        <div ref={pillContainerRef} className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {showStagePills && STAGES.map((stage, i) => (
            <button
              key={stage.label}
              ref={(el) => { pillRefs.current[i] = el; }}
              type="button"
              onClick={() => setActiveStage(i)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-all ${
                i === activeStage ? "ring-1" : "opacity-60 hover:opacity-80"
              }`}
              style={{
                color: stage.color,
                backgroundColor: i === activeStage ? `${stage.color}15` : "transparent",
                ...(i === activeStage ? { boxShadow: `inset 0 0 0 1px ${stage.color}40` } : {}),
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
              <span>{stage.display}</span>
              {stageCounts[i] > 0 && <span className="ml-0.5 opacity-70">{stageCounts[i]}</span>}
            </button>
          ))}

          {!showStagePills && (
            <span className="text-[0.75rem] font-semibold text-[#B8BFC8]">
              All Entries ({entries.length})
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* View mode pills */}
            <div className="flex rounded-full ring-1 ring-[#2A3544] overflow-hidden">
              {VIEW_PILLS.map((vp) => (
                <button
                  key={vp.value}
                  type="button"
                  onClick={() => setViewMode(vp.value)}
                  className={`px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
                    viewMode === vp.value
                      ? vp.value === "all"
                        ? "bg-[#FAD76A]/15 text-[#FAD76A]"
                        : vp.value === "ops"
                          ? "bg-[#38BDF8]/15 text-[#38BDF8]"
                          : "bg-[#6AD7A3]/15 text-[#6AD7A3]"
                      : "text-[#9CA3AF] hover:text-[#B8BFC8]"
                  }`}
                >
                  {vp.label}
                </button>
              ))}
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
      {viewMode === "all" ? (
        <AllViewTable entries={allEntries} loading={loading} sortOrder={sortOrder} onUpdate={handleUpdate} onDelete={handleDelete} />
      ) : viewMode === "ops" ? (
        <OpsTable entries={stageEntries} loading={loading} onUpdate={handleUpdate} onDelete={handleDelete} />
      ) : (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="min-h-[40vh]"
        >
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
                <TrackerCard key={entry.id} entry={entry} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))
            )}
          </div>
        </div>
      )}

      {showManualAdd && <ManualAddDialog onClose={() => setShowManualAdd(false)} onSubmit={handleManualAdd} />}
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

/* ── All View: flat table across all stages with expandable rows ── */

type AllSortKey = "stage" | "days" | "company" | "title";

function AllViewTable({
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<AllSortKey>("stage");
  const [sortAsc, setSortAsc] = useState(true);
  const [generatingFitFor, setGeneratingFitFor] = useState<string | null>(null);

  function handleSort(key: AllSortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  // Sort entries
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
      // Secondary sort by added_at
      const aTime = new Date(a.added_at ?? a.updated_at).getTime();
      const bTime = new Date(b.added_at ?? b.updated_at).getTime();
      cmp = sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    }
    return sortAsc ? cmp : -cmp;
  });

  async function handleGenerateGoodFit(id: string) {
    setGeneratingFitFor(id);
    const res = await fetch(`/api/tracker/${id}/goodfit`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.good_fit) {
        onUpdate(id, { good_fit: data.good_fit });
      }
    }
    setGeneratingFitFor(null);
  }

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
            const isExpanded = expandedId === e.id;
            const notes = parseNotes(e.notes, e.added_at ?? e.updated_at);

            return (
              <AllViewRow
                key={e.id}
                entry={e}
                days={days}
                daysColor={daysColor}
                stageColor={stageColor}
                isExpanded={isExpanded}
                notes={notes}
                generatingFit={generatingFitFor === e.id}
                onToggle={() => setExpandedId(isExpanded ? null : e.id)}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onGenerateGoodFit={() => handleGenerateGoodFit(e.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AllViewRow({
  entry: e,
  days,
  daysColor,
  stageColor,
  isExpanded,
  notes,
  generatingFit,
  onToggle,
  onUpdate,
  onDelete,
  onGenerateGoodFit,
}: {
  entry: TrackerEntry;
  days: number;
  daysColor: string;
  stageColor: string;
  isExpanded: boolean;
  notes: ReturnType<typeof parseNotes>;
  generatingFit: boolean;
  onToggle: () => void;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onGenerateGoodFit: () => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-[#2A3544]/40 hover:bg-[#222D3D]/30 transition-colors cursor-pointer ${isExpanded ? "bg-[#222D3D]/20" : ""}`}
        onClick={onToggle}
      >
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stageColor }} />
            <select
              value={e.status}
              onClick={(ev) => ev.stopPropagation()}
              onChange={(ev) => { ev.stopPropagation(); onUpdate(e.id, { status: ev.target.value }); }}
              className="rounded border border-[#2A3544] bg-[#151C24] px-2 py-1 text-[0.6875rem] text-white outline-none focus:border-[#6AD7A3]"
            >
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </td>
        <td className="px-4 py-2 font-medium text-white">{e.title}</td>
        <td className="px-4 py-2 text-[#B8BFC8]">{e.company}</td>
        <td className="px-4 py-2 text-[#B8BFC8]">{e.salary ?? "-"}</td>
        <td className={`px-4 py-2 tabular-nums font-semibold ${daysColor}`}>{days}d</td>
        <td className="px-4 py-2 text-[0.6875rem] text-[#6AD7A3]">{e.lane_label ?? "-"}</td>
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
            className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[0.6875rem] text-[#DC2626] hover:bg-[#DC2626]/10 transition-colors"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr className="bg-[#151C24]/60">
          <td colSpan={7} className="px-6 py-4">
            <div className="max-w-3xl space-y-3">
              {/* Job summary */}
              {e.job_summary && (
                <p className="text-[0.8125rem] leading-relaxed text-[#B8BFC8] italic">{e.job_summary}</p>
              )}

              {/* GoodFit */}
              {e.good_fit ? (
                <div className="rounded-lg border-l-[3px] border-l-[#2F8A63] bg-[#6AD7A3]/5 p-3">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#6AD7A3]">GOOD FIT</p>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#B8BFC8] whitespace-pre-line">{e.good_fit}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); onGenerateGoodFit(); }}
                  disabled={generatingFit}
                  className="rounded-lg bg-gradient-to-r from-[#0A2E1F] to-[#1A3D2E] px-4 py-2.5 ring-1 ring-[#6AD7A3]/40 shadow-[0_0_20px_rgba(106,215,163,0.15)] transition-all hover:ring-[#6AD7A3]/60 hover:shadow-[0_0_30px_rgba(106,215,163,0.25)] disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <Zap size={16} strokeWidth={2} className={`text-[#FAD76A] ${generatingFit ? "animate-pulse" : ""}`} />
                    <span className="text-[0.8125rem] font-bold text-white">{generatingFit ? "Generating..." : "Generate GoodFit"}</span>
                  </div>
                </button>
              )}

              {/* Notes preview */}
              {notes.length > 0 && (
                <div className="rounded-lg bg-[#0C1016] p-3">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-1.5">Notes</p>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                    {notes.slice(0, 5).map((note) => (
                      <div key={note.id} className="flex items-start gap-2">
                        <p className="text-[0.8125rem] text-[#B8BFC8] flex-1">{note.text}</p>
                        <span className="text-[0.6875rem] text-[#9CA3AF] shrink-0">{relativeTime(note.timestamp)}</span>
                      </div>
                    ))}
                    {notes.length > 5 && (
                      <p className="text-[0.6875rem] text-[#9CA3AF]">+{notes.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Links */}
              <div className="flex gap-2">
                {e.url && (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                    className="inline-flex h-[30px] items-center gap-1 rounded-full border border-[#38BDF8]/20 bg-[#38BDF8]/8 px-3 text-[0.6875rem] font-medium text-[#38BDF8]"
                  >
                    View Listing
                    <ExternalLink size={12} strokeWidth={2} />
                  </a>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
