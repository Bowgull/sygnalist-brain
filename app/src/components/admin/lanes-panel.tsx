"use client";

import { useState, useEffect } from "react";
import type { Database } from "@/types/database";

type Lane = Database["public"]["Tables"]["lane_role_bank"]["Row"];

export default function LanesPanel() {
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newLane, setNewLane] = useState("");
  const [newKeywords, setNewKeywords] = useState("");

  useEffect(() => {
    fetch("/api/admin/lanes")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setLanes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!newRole || !newLane) return;
    const res = await fetch("/api/admin/lanes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role_name: newRole,
        lane_key: newLane,
        keywords: newKeywords.split(",").map((k) => k.trim()).filter(Boolean),
      }),
    });
    if (res.ok) {
      const added = await res.json();
      setLanes((prev) => [...prev, added]);
      setNewRole("");
      setNewLane("");
      setNewKeywords("");
      setShowAdd(false);
    }
  }

  // Group by lane_key
  const grouped = lanes.reduce<Record<string, Lane[]>>((acc, l) => {
    (acc[l.lane_key] ??= []).push(l);
    return acc;
  }, {});

  if (loading) {
    return <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2A3544] bg-[#151C24] px-4 py-2.5">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
          {lanes.length} roles across {Object.keys(grouped).length} lanes
        </span>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-full bg-[#171F28] px-3 py-1.5 text-[0.6875rem] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20 hover:bg-[#6AD7A3]/10"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          Add Role
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border-b border-[#2A3544] bg-[#171F28] p-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Role name *"
              className="flex-1 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[0.8125rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
            />
            <input
              type="text"
              value={newLane}
              onChange={(e) => setNewLane(e.target.value)}
              placeholder="Lane key *"
              className="w-40 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[0.8125rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
            />
          </div>
          <input
            type="text"
            value={newKeywords}
            onChange={(e) => setNewKeywords(e.target.value)}
            placeholder="Keywords (comma separated)"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-[0.8125rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} className="rounded-full border border-[rgba(169,255,181,0.35)] bg-[#171F28] px-4 py-1.5 text-[0.8125rem] font-medium text-white hover:bg-[#6AD7A3]/10">
              Add
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-full border border-[#2A3544] px-4 py-1.5 text-[0.8125rem] text-[#9CA3AF]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Lane groups */}
      <div className="divide-y divide-[#2A3544]">
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([laneKey, roles]) => (
          <div key={laneKey} className="px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-[22px] items-center rounded-full border border-[#6AD7A3]/20 bg-[#6AD7A3]/8 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-[#6AD7A3]">
                {laneKey}
              </span>
              <span className="text-[0.6875rem] text-[#9CA3AF]">{roles.length} roles</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.8125rem]">
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id} className="hover:bg-[#222D3D]/30">
                      <td className="py-1.5 pr-4 text-white">{r.role_name}</td>
                      <td className="py-1.5 pr-4 text-[#9CA3AF] text-[0.75rem]">
                        {r.aliases.length > 0 ? r.aliases.join(", ") : "—"}
                      </td>
                      <td className="py-1.5 w-16">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${r.is_active ? "bg-[#6AD7A3]" : "bg-[#4B5563]"}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="py-10 text-center text-[0.8125rem] text-[#9CA3AF]">No lanes configured</p>
      )}
    </div>
  );
}
