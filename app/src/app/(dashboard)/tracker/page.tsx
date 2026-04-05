"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import TrackerCard from "@/components/tracker/tracker-card";
import SkeletonCard from "@/components/inbox/skeleton-card";
import ManualAddDialog from "@/components/ui/manual-add-dialog";
import type { Database } from "@/types/database";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];
type ViewMode = "cards" | "ops";

const STAGES = [
  { label: "Prospect", display: "Prospect", color: "#1DD3B0" },
  { label: "Applied", display: "Applied", color: "#3B82F6" },
  { label: "Interview 1", display: "1st Interview", color: "#8B5CF6" },
  { label: "Interview 2", display: "2nd Interview", color: "#8B5CF6" },
  { label: "Final", display: "Final", color: "#F59E0B" },
  { label: "Offer", display: "Offer", color: "#22C55E" },
];

const ALL_STATUSES = [...STAGES.map((s) => s.label), "Rejected", "Ghosted", "Withdrawn"];

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

  // Filter + search + sort
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

  return (
    <div>
      {/* Controls bar */}
      <div className="sticky top-0 z-10 border-b border-[#2A3544] bg-[#151C24] px-4 md:px-6 py-3 space-y-2">
        {/* Stage pills + controls */}
        <div ref={pillContainerRef} className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {STAGES.map((stage, i) => (
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

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* Ops Mode toggle */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "cards" ? "ops" : "cards")}
              className={`rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
                viewMode === "ops"
                  ? "bg-[#FAD76A]/15 text-[#FAD76A] ring-1 ring-[#FAD76A]/30"
                  : "text-[#9CA3AF] hover:text-[#B8BFC8] ring-1 ring-[#2A3544]"
              }`}
            >
              {viewMode === "ops" ? "Ops" : "Cards"}
            </button>
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
      {viewMode === "ops" ? (
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

/** Ops Mode: dense table with inline status changes */
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
                <td className="px-4 py-2 text-[#B8BFC8]">{e.salary ?? "—"}</td>
                <td className="px-4 py-2">
                  <select
                    value={e.status}
                    onChange={(ev) => onUpdate(e.id, { status: ev.target.value, stage_changed_at: new Date().toISOString() })}
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
