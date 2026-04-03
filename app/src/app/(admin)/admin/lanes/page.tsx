"use client";

import { useState, useEffect } from "react";

interface Lane {
  id: string;
  lane_key: string;
  role_name: string;
  aliases: string[];
  is_active: boolean;
  status: string;
  source: string;
  created_at: string;
}

export default function AdminLanesPage() {
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

  // Group by lane_key
  const grouped = lanes.reduce(
    (acc, lane) => {
      if (!acc[lane.lane_key]) acc[lane.lane_key] = [];
      acc[lane.lane_key].push(lane);
      return acc;
    },
    {} as Record<string, Lane[]>,
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
        <h1 className="text-lg font-semibold">Lane &amp; Role Bank ({lanes.length})</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-3 py-1.5 text-[12px] font-semibold text-[#0C1016]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Role
        </button>
      </div>

      <p className="text-[12px] text-[#9CA3AF]">
        Lanes group related job roles. When a client searches, the scoring engine matches jobs to these roles and assigns the right lane.
      </p>

      {showAdd && <AddLaneForm onAdded={() => { loadLanes(); setShowAdd(false); }} />}

      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-sm font-medium text-[#B8BFC8]">No lanes configured</p>
          <p className="mt-1 text-[11px] text-[#6B7280]">Add roles to group them into lanes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([laneKey, roles]) => (
            <div
              key={laneKey}
              className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28]"
            >
              {/* Lane header */}
              <div className="flex items-center justify-between bg-gradient-to-r from-[#6AD7A3]/8 to-transparent px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6AD7A3]/15 text-[13px] font-bold text-[#6AD7A3]">
                    {laneKey[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold capitalize">{laneKey.replace(/_/g, " ")}</h3>
                    <p className="text-[11px] text-[#6B7280]">{roles.length} role{roles.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>

              {/* Roles */}
              <div className="divide-y divide-[#2A3544]/50 px-4">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-[13px] font-medium text-white">{role.role_name}</p>
                      {role.aliases.length > 0 && (
                        <p className="text-[11px] text-[#6B7280]">
                          Aliases: {role.aliases.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        role.is_active
                          ? "bg-[#6AD7A3]/10 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20"
                          : "bg-[#DC2626]/10 text-[#DC2626] ring-1 ring-[#DC2626]/20"
                      }`}>
                        {role.is_active ? "Active" : "Inactive"}
                      </span>
                      <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[10px] text-[#6B7280] ring-1 ring-[#2A3544]">
                        {role.source}
                      </span>
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

function AddLaneForm({ onAdded }: { onAdded: () => void }) {
  const [laneKey, setLaneKey] = useState("");
  const [roleName, setRoleName] = useState("");
  const [aliases, setAliases] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!laneKey || !roleName) return;
    setSubmitting(true);

    const res = await fetch("/api/admin/lanes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lane_key: laneKey.toLowerCase().replace(/\s+/g, "_"),
        role_name: roleName,
        aliases: aliases ? aliases.split(",").map((a) => a.trim()).filter(Boolean) : [],
        source: "admin",
      }),
    });

    if (res.ok) onAdded();
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[#6AD7A3]/30 bg-[#171F28] p-4">
      <h2 className="mb-3 text-sm font-semibold">Add Role to Lane</h2>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Lane Key</label>
            <input value={laneKey} onChange={(e) => setLaneKey(e.target.value)} placeholder="e.g. product" required className="w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Role Name</label>
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Product Manager" required className="w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-[#6B7280]">Aliases (comma-separated)</label>
          <input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="PM, Product Lead, Product Owner" className="w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016] disabled:opacity-50">
          {submitting ? "Adding..." : "Add Role"}
        </button>
      </div>
    </form>
  );
}
