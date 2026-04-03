"use client";

import { useState, useEffect } from "react";

interface Lane {
  id: string;
  role_name: string;
  lane_key: string;
  keywords: string[];
  created_at: string;
}

export default function LanesPage() {
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadLanes();
  }, []);

  async function loadLanes() {
    setLoading(true);
    const res = await fetch("/api/admin/lanes");
    if (res.ok) setLanes(await res.json());
    setLoading(false);
  }

  async function handleAdd(data: { role_name: string; lane_key: string; keywords?: string[] }) {
    const res = await fetch("/api/admin/lanes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const newLane = await res.json();
      setLanes((prev) => [...prev, newLane]);
      setShowAdd(false);
    }
  }

  // Group by lane_key
  const grouped = lanes.reduce(
    (acc, lane) => {
      const key = lane.lane_key || "Ungrouped";
      if (!acc[key]) acc[key] = [];
      acc[key].push(lane);
      return acc;
    },
    {} as Record<string, Lane[]>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#171F28]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Role Lanes ({lanes.length})</h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="btn-gradient rounded-full px-3 py-1.5 text-[12px]"
        >
          + Add Role
        </button>
      </div>

      {showAdd && <AddRoleForm onAdd={handleAdd} onClose={() => setShowAdd(false)} />}

      {Object.keys(grouped).length === 0 ? (
        <div className="glass-card flex flex-col items-center py-16 text-center">
          <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M4 6h16M4 10h16M4 14h10M4 18h6" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-[#B8BFC8]">No role lanes configured</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">Add role lanes to organize job searches</p>
        </div>
      ) : (
        <div className="stagger-children space-y-4">
          {Object.entries(grouped).map(([laneKey, roles]) => (
            <div key={laneKey} className="glass-card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#6AD7A3]" />
                {laneKey}
                <span className="ml-auto text-[11px] font-normal text-[#9CA3AF]">
                  {roles.length} role{roles.length !== 1 ? "s" : ""}
                </span>
              </h2>
              <div className="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between rounded-lg bg-[#151C24] px-3 py-2"
                  >
                    <div>
                      <span className="text-[13px] font-medium text-white">{role.role_name}</span>
                      {role.keywords?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {role.keywords.map((kw) => (
                            <span
                              key={kw}
                              className="rounded-full bg-[#6AD7A3]/10 px-1.5 py-0.5 text-[10px] text-[#6AD7A3]"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddRoleForm({
  onAdd,
  onClose,
}: {
  onAdd: (data: { role_name: string; lane_key: string; keywords?: string[] }) => void;
  onClose: () => void;
}) {
  const [roleName, setRoleName] = useState("");
  const [laneKey, setLaneKey] = useState("");
  const [keywords, setKeywords] = useState("");

  return (
    <div className="glass-card glow-green-soft p-4">
      <h2 className="mb-3 text-sm font-semibold">Add Role to Lane</h2>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="Role Name *"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
          <input
            value={laneKey}
            onChange={(e) => setLaneKey(e.target.value)}
            placeholder="Lane Key *"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
        </div>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Keywords (comma-separated)"
          className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (!roleName || !laneKey) return;
              onAdd({
                role_name: roleName,
                lane_key: laneKey,
                keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
              });
            }}
            className="btn-gradient rounded-full px-4 py-1.5 text-[12px]"
          >
            Add
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-[#2A3544] px-4 py-1.5 text-[12px] text-[#9CA3AF]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
