"use client";

import { useState, useEffect } from "react";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function AdminClientsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/profiles");
      if (res.ok) setProfiles(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
    }
  }

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clients ({profiles.length})</h1>
      </div>

      {profiles.map((p) => (
        <div
          key={p.id}
          className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#A9FFB5]/20 to-[#39D6FF]/20">
                  <span className="text-sm font-bold text-[#6AD7A3]">
                    {p.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold">{p.display_name}</h3>
                  <p className="text-[12px] text-[#9CA3AF]">{p.email ?? "No email"}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                  p.role === "admin"
                    ? "bg-[#FAD76A]/15 text-[#FAD76A] ring-[#FAD76A]/30"
                    : "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-[#6AD7A3]/30"
                }`}
              >
                {p.role}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                  p.status === "active"
                    ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-[#6AD7A3]/30"
                    : "bg-[#DC2626]/15 text-[#DC2626] ring-[#DC2626]/30"
                }`}
              >
                {p.status === "active" ? "Active" : "Locked"}
              </span>
            </div>
          </div>

          {/* Quick info */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.current_city && (
              <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#B8BFC8] ring-1 ring-[#2A3544]">
                {p.current_city}
              </span>
            )}
            {p.salary_min > 0 && (
              <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#B8BFC8] ring-1 ring-[#2A3544]">
                ${p.salary_min.toLocaleString()}+
              </span>
            )}
            {[
              p.accept_remote && "Remote",
              p.accept_hybrid && "Hybrid",
              p.accept_onsite && "Onsite",
            ]
              .filter(Boolean)
              .map((mode) => (
                <span
                  key={mode as string}
                  className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#B8BFC8] ring-1 ring-[#2A3544]"
                >
                  {mode}
                </span>
              ))}
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setEditingId(editingId === p.id ? null : p.id)}
              className="rounded-full border border-[#2A3544] px-3 py-1 text-[11px] font-medium text-[#B8BFC8] hover:border-[#6AD7A3]/50"
            >
              {editingId === p.id ? "Close" : "Edit"}
            </button>
            {p.status === "active" ? (
              <button
                type="button"
                onClick={() =>
                  handleUpdate(p.id, {
                    status: "inactive_soft_locked",
                    status_reason: "Locked by admin",
                  })
                }
                className="rounded-full border border-[#DC2626]/30 px-3 py-1 text-[11px] font-medium text-[#DC2626] hover:bg-[#DC2626]/10"
              >
                Lock
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  handleUpdate(p.id, { status: "active", status_reason: "" })
                }
                className="rounded-full border border-[#6AD7A3]/30 px-3 py-1 text-[11px] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
              >
                Unlock
              </button>
            )}
          </div>

          {/* Inline edit */}
          {editingId === p.id && (
            <ProfileEditor profile={p} onSave={(patch) => handleUpdate(p.id, patch)} />
          )}
        </div>
      ))}
    </div>
  );
}

function ProfileEditor({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [city, setCity] = useState(profile.current_city);
  const [salary, setSalary] = useState(String(profile.salary_min));
  const [role, setRole] = useState(profile.role);

  return (
    <div className="mt-3 space-y-3 border-t border-[#2A3544] pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            City
          </label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            Min Salary
          </label>
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
          >
            <option value="client">Client</option>
            <option value="coach">Coach</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={() =>
          onSave({
            display_name: name,
            current_city: city,
            salary_min: parseInt(salary) || 0,
            role,
          })
        }
        className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016]"
      >
        Save Changes
      </button>
    </div>
  );
}
