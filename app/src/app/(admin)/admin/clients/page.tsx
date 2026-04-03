"use client";

import { useState, useEffect } from "react";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function AdminClientsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);

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
        <button
          type="button"
          onClick={() => setShowOnboard(true)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-3 py-1.5 text-[12px] font-semibold text-[#0C1016]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Onboard Client
        </button>
      </div>

      {showOnboard && (
        <OnboardSheet
          onClose={() => setShowOnboard(false)}
          onCreated={(p) => {
            setProfiles((prev) => [...prev, p]);
            setShowOnboard(false);
          }}
        />
      )}

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

function OnboardSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (profile: Profile) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [salary, setSalary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const profileId = `client-${email.split("@")[0]}-${Date.now().toString(36)}`;

    const res = await fetch("/api/admin/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileId,
        display_name: name,
        email: email.trim().toLowerCase(),
        current_city: city || undefined,
        salary_min: parseInt(salary) || 0,
        role: "client",
      }),
    });

    if (res.ok) {
      const profile = await res.json();
      onCreated(profile);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create profile");
    }
    setSubmitting(false);
  }

  return (
    <div className="rounded-2xl border border-[#6AD7A3]/30 bg-[#171F28] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="17" y1="11" x2="23" y2="11" />
          </svg>
          Onboard New Client
        </h2>
        <button type="button" onClick={onClose} className="text-[#9CA3AF] hover:text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <p className="mb-3 text-[12px] text-[#9CA3AF]">
        Add the client&apos;s email below. They&apos;ll be able to log in once saved.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Full Name *"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email *"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (optional)"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="Min Salary (optional)"
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
          />
        </div>

        {error && <p className="text-xs text-[#DC2626]">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-[#2A3544] py-2 text-sm font-medium text-[#9CA3AF]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-2 text-sm font-semibold text-[#0C1016] disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Grant Access"}
          </button>
        </div>
      </form>
    </div>
  );
}
