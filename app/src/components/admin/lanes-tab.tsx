"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import type { Database, Json } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface RoleTrack {
  label: string;
  roleKeywords: string[];
  priorityWeight: number;
}

interface LaneControl {
  laneKey: string;
  laneLabel: string;
  enabled: boolean;
  roles: string[];
}

interface LaneBankEntry {
  id: string;
  lane_key: string;
  role_name: string;
}

const inputClass = "w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]";
const labelClass = "mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]";

export default function LanesTab({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [tracks, setTracks] = useState<RoleTrack[]>(() => {
    const raw = profile.role_tracks as unknown;
    return Array.isArray(raw) ? raw.map(normalizeTrack) : [];
  });

  const [lanes, setLanes] = useState<LaneControl[]>(() => {
    const raw = profile.lane_controls as unknown;
    return Array.isArray(raw) ? raw.map(normalizeLane) : [];
  });

  const [bankLanes, setBankLanes] = useState<LaneBankEntry[]>([]);

  useEffect(() => {
    fetch("/api/admin/lanes")
      .then((r) => r.json())
      .then((data) => setBankLanes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function addTrack() {
    setTracks((prev) => [...prev, { label: "", roleKeywords: [], priorityWeight: 1.0 }]);
  }

  function removeTrack(idx: number) {
    setTracks((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateTrack(idx: number, field: keyof RoleTrack, value: unknown) {
    setTracks((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }

  function toggleLane(laneKey: string, laneLabel: string) {
    setLanes((prev) => {
      const existing = prev.find((l) => l.laneKey === laneKey);
      if (existing) {
        return prev.map((l) => (l.laneKey === laneKey ? { ...l, enabled: !l.enabled } : l));
      }
      return [...prev, { laneKey, laneLabel, enabled: true, roles: [] }];
    });
  }

  function updateLaneRoles(laneKey: string, rolesStr: string) {
    const roles = rolesStr.split(",").map((r) => r.trim()).filter(Boolean);
    setLanes((prev) => prev.map((l) => (l.laneKey === laneKey ? { ...l, roles } : l)));
  }

  function handleSave() {
    const cleanTracks = tracks.filter((t) => t.label.trim());
    onSave({
      role_tracks: cleanTracks as unknown as Json,
      lane_controls: lanes as unknown as Json,
    });
  }

  // Merge bank lanes with existing lane_controls
  const allLaneKeys = new Set([
    ...lanes.map((l) => l.laneKey),
    ...bankLanes.map((b) => b.lane_key),
  ]);
  const mergedLanes = Array.from(allLaneKeys).map((key) => {
    const existing = lanes.find((l) => l.laneKey === key);
    const bank = bankLanes.find((b) => b.lane_key === key);
    return {
      laneKey: key,
      laneLabel: existing?.laneLabel ?? bank?.role_name ?? key,
      enabled: existing?.enabled ?? false,
      roles: existing?.roles ?? [],
    };
  });

  return (
    <div className="space-y-5">
      {/* Role Tracks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-[#B8BFC8]">Role Tracks</h3>
          <button
            type="button"
            onClick={addTrack}
            className="flex items-center gap-1 rounded-full border border-[#2A3544] px-2.5 py-1 text-[11px] font-medium text-[#9CA3AF] hover:text-white hover:border-[#6AD7A3]"
          >
            <Plus size={12} strokeWidth={2.5} /> Add Track
          </button>
        </div>

        {tracks.length === 0 && (
          <p className="text-[12px] text-[#6B7280]">No role tracks defined. Add one to start matching jobs.</p>
        )}

        <div className="space-y-2">
          {tracks.map((track, idx) => (
            <div key={idx} className="rounded-xl border border-[#2A3544] bg-[#0C1016] p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelClass}>Label</label>
                    <input
                      value={track.label}
                      onChange={(e) => updateTrack(idx, "label", e.target.value)}
                      placeholder="e.g. Product Manager"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Keywords (comma-sep)</label>
                    <input
                      value={track.roleKeywords.join(", ")}
                      onChange={(e) => updateTrack(idx, "roleKeywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                      placeholder="PM, product lead"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Weight (0-1)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={track.priorityWeight}
                      onChange={(e) => updateTrack(idx, "priorityWeight", parseFloat(e.target.value) || 0)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeTrack(idx)}
                  className="mt-5 rounded-lg p-1.5 text-[#6B7280] hover:bg-[#DC2626]/10 hover:text-[#DC2626]"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lane Controls */}
      <div>
        <h3 className="text-[13px] font-semibold text-[#B8BFC8] mb-2">Lane Controls</h3>
        {mergedLanes.length === 0 && (
          <p className="text-[12px] text-[#6B7280]">No lanes in the bank yet.</p>
        )}
        <div className="space-y-1.5">
          {mergedLanes.map((lane) => (
            <div
              key={lane.laneKey}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                lane.enabled
                  ? "border-[#6AD7A3]/30 bg-[#6AD7A3]/5"
                  : "border-[#2A3544] bg-[#0C1016]"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleLane(lane.laneKey, lane.laneLabel)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  lane.enabled
                    ? "border-[#6AD7A3] bg-[#6AD7A3] text-[#0C1016]"
                    : "border-[#4B5563]"
                }`}
              >
                {lane.enabled && (
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className="text-[13px] font-medium text-white min-w-[120px]">{lane.laneLabel}</span>
              <input
                value={lane.roles.join(", ")}
                onChange={(e) => updateLaneRoles(lane.laneKey, e.target.value)}
                placeholder="Mapped role labels (comma-sep)"
                className="flex-1 rounded-lg border border-[#2A3544] bg-[#151C24] px-2 py-1 text-[12px] text-white outline-none focus:border-[#6AD7A3]"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016]"
      >
        Save Lanes
      </button>
    </div>
  );
}

function normalizeTrack(t: unknown): RoleTrack {
  const obj = t as Record<string, unknown>;
  return {
    label: String(obj.label ?? ""),
    roleKeywords: Array.isArray(obj.roleKeywords) ? obj.roleKeywords.map(String) : [],
    priorityWeight: Number(obj.priorityWeight ?? 1.0),
  };
}

function normalizeLane(l: unknown): LaneControl {
  const obj = l as Record<string, unknown>;
  return {
    laneKey: String(obj.laneKey ?? ""),
    laneLabel: String(obj.laneLabel ?? ""),
    enabled: Boolean(obj.enabled ?? true),
    roles: Array.isArray(obj.roles) ? obj.roles.map(String) : [],
  };
}
