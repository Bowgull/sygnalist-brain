"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import TrackerCard from "@/components/tracker/tracker-card";
import SkeletonCard from "@/components/inbox/skeleton-card";
import type { Database } from "@/types/database";

type TrackerEntry = Database["public"]["Tables"]["tracker_entries"]["Row"];

const STAGES = [
  { label: "Prospect", color: "#1DD3B0" },
  { label: "Applied", color: "#3B82F6" },
  { label: "Interview 1", color: "#8B5CF6" },
  { label: "Interview 2", color: "#8B5CF6" },
  { label: "Final", color: "#F59E0B" },
  { label: "Offer", color: "#22C55E" },
];

export default function TrackerPage() {
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(0);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const touchStartX = useRef(0);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/tracker");
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const stageCounts = STAGES.map(
    (s) => entries.filter((e) => e.status === s.label).length
  );

  const currentStage = STAGES[activeStage];
  const stageEntries = entries.filter((e) => e.status === currentStage.label);

  // Mobile-only swipe between stages
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 60 && activeStage > 0) {
      setActiveStage((prev) => prev - 1);
    } else if (diff < -60 && activeStage < STAGES.length - 1) {
      setActiveStage((prev) => prev + 1);
    }
  }

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } as TrackerEntry : e))
    );
    await fetch(`/api/tracker/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/tracker/${id}`, { method: "DELETE" });
  }

  async function handleManualAdd(data: { title: string; company: string; url?: string; location?: string; notes?: string }) {
    const res = await fetch("/api/tracker/manual-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const entry = await res.json();
      setEntries((prev) => [entry, ...prev]);
      setShowManualAdd(false);
    }
  }

  return (
    <div>
      {/* Pipeline stage pills */}
      <div className="sticky top-0 z-10 border-b border-[#2A3544] bg-[#151C24] px-4 md:px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {STAGES.map((stage, i) => (
            <button
              key={stage.label}
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
              <span>{stage.label}</span>
              {stageCounts[i] > 0 && (
                <span className="ml-0.5 opacity-70">{stageCounts[i]}</span>
              )}
            </button>
          ))}

          {/* Add button (inline, not FAB) */}
          <button
            type="button"
            onClick={() => setShowManualAdd(true)}
            className="ml-auto shrink-0 flex items-center gap-1 rounded-full bg-[#171F28] px-3 py-1.5 text-[0.6875rem] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20 transition-colors hover:bg-[#6AD7A3]/10"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
            Add
          </button>
        </div>
      </div>

      {/* Content — swipeable on mobile only */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="min-h-[40vh]"
      >
        <div className="space-y-3 md:space-y-4 p-3 md:p-6">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : stageEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${currentStage.color}15` }}
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: currentStage.color }} />
              </div>
              <p className="text-sm font-medium text-[#B8BFC8]">
                No jobs in {currentStage.label} yet
              </p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {activeStage === 0
                  ? "Add jobs from the inbox or manually"
                  : `Move prospects here when you've ${currentStage.label.toLowerCase()}`}
              </p>
            </div>
          ) : (
            stageEntries.map((entry) => (
              <TrackerCard
                key={entry.id}
                entry={entry}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Manual Add — bottom sheet on mobile, centered modal on desktop */}
      {showManualAdd && (
        <ManualAddDialog
          onClose={() => setShowManualAdd(false)}
          onSubmit={handleManualAdd}
        />
      )}
    </div>
  );
}

function ManualAddDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { title: string; company: string; url?: string; location?: string; notes?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      title,
      company,
      url: url || undefined,
      location: location || undefined,
      notes: notes || undefined,
    });
  }

  const inputClass = "w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none transition-colors focus:border-[#6AD7A3]";

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-[rgba(5,6,10,0.9)]" onClick={onClose}>
      <div
        className="w-full max-w-lg animate-slide-up rounded-t-[20px] md:rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Job Manually
          </h2>
          <button type="button" onClick={onClose} className="text-[#9CA3AF] hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Job Title *" className={inputClass} />
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="Company *" className={inputClass} />
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Job URL (optional)" className={inputClass} />
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" className={inputClass} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)" className={inputClass} />

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-full border border-[#2A3544] py-2.5 text-sm font-medium text-[#9CA3AF] hover:text-white hover:border-[rgba(255,255,255,0.2)]">
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.15)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_30px_rgba(106,215,163,0.25)]"
            >
              Add to Tracker
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
