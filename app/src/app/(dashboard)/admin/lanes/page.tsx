"use client";

import { useState, useEffect } from "react";

interface Lane {
  id: string;
  lane_key: string;
  role_name: string;
  source: string;
  created_at: string;
}

export default function AdminLanesPage() {
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { loadLanes(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadLanes() {
    setLoading(true);
    const res = await fetch("/api/admin/lanes");
    if (res.ok) {
      const data = await res.json();
      // Dedupe by lane_key (take first per key)
      const seen = new Set<string>();
      const unique: Lane[] = [];
      for (const l of data) {
        if (!seen.has(l.lane_key)) {
          seen.add(l.lane_key);
          unique.push(l);
        }
      }
      setLanes(unique);
    }
    setLoading(false);
  }

  async function handleAdd() {
    const name = input.trim();
    if (!name) return;

    setAdding(true);
    const res = await fetch("/api/admin/lanes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      setInput("");
      await loadLanes();
      showToast(`Added "${name}"`);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Failed to add lane");
    }
    setAdding(false);
  }

  async function handleDelete(lane: Lane) {
    const res = await fetch(`/api/admin/lanes?id=${lane.id}`, { method: "DELETE" });
    if (res.ok) {
      setLanes((prev) => prev.filter((l) => l.id !== lane.id));
      showToast(`Removed "${lane.role_name}"`);
    } else {
      showToast("Failed to remove lane");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-2xl bg-[#171F28]" />
        <div className="h-32 animate-pulse rounded-2xl bg-[#171F28]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#6AD7A3] px-4 py-2 text-[0.8125rem] font-semibold text-[#0C1016] shadow-lg">
          {toast}
        </div>
      )}

      <h1 className="text-lg font-semibold">Job Lanes ({lanes.length})</h1>

      {/* Add lane input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a lane name and press Enter (e.g. Product Manager)"
          className="flex-1 rounded-xl border border-[#2A3544] bg-[#171F28] px-4 py-3 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="shrink-0 rounded-xl bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-5 py-3 text-sm font-semibold text-[#0C1016] disabled:opacity-40"
        >
          {adding ? "..." : "Add"}
        </button>
      </div>

      {/* Lanes list */}
      {lanes.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <p className="text-sm font-medium text-[#B8BFC8]">No lanes yet</p>
          <p className="mt-1 text-[11px] text-[#6B7280]">
            Type a job role above to create your first lane
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {lanes.map((lane) => (
            <div
              key={lane.id}
              className="group flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#171F28] px-4 py-2 transition hover:border-[#6AD7A3]/30"
            >
              <span className="text-[13px] font-medium text-white">
                {lane.role_name}
              </span>
              {lane.source !== "admin" && lane.source !== "review_auto" && (
                <span className="text-[10px] text-[#4B5563]">{lane.source}</span>
              )}
              <button
                onClick={() => handleDelete(lane)}
                className="ml-1 hidden rounded-full p-0.5 text-[#4B5563] transition hover:bg-[#DC2626]/10 hover:text-[#DC2626] group-hover:inline-flex"
                title="Remove lane"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
