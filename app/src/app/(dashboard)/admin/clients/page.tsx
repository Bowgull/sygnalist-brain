"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function AdminClientsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; step: 1 | 2 } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/profiles");
      if (res.ok) setProfiles(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

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
      showToast("Profile updated");
    } else {
      showToast("Failed to update");
    }
  }

  async function handleFetch(profileId: string, name: string) {
    if (!confirm(`Run job fetch for ${name}? This will scan all sources and deliver jobs to their inbox.`)) return;
    setFetchingId(profileId);
    showToast(`Running fetch for ${name}...`);
    const res = await fetch("/api/admin/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`${name}: ${data.jobs_delivered} jobs delivered (${data.duration_ms}ms)`);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`Fetch failed: ${data.error ?? "unknown error"}`);
    }
    setFetchingId(null);
  }

  function copyLink(profileId: string) {
    const url = `${window.location.origin}/inbox`;
    navigator.clipboard.writeText(url).then(() => showToast("Portal link copied"));
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/admin/profiles/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      showToast("Profile permanently deleted");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Failed to delete");
    }
    setDeleting(false);
    setDeleteConfirm(null);
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
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#6AD7A3] px-4 py-2 text-[0.8125rem] font-semibold text-[#0C1016] shadow-lg">
          {toast}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#DC2626]/30 bg-[#171F28] p-6 shadow-2xl">
            {deleteConfirm.step === 1 ? (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DC2626]/10">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#DC2626]" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="text-center text-[15px] font-semibold text-white">Delete {deleteConfirm.name}?</h3>
                <p className="mt-2 text-center text-[13px] leading-relaxed text-[#9CA3AF]">
                  This will permanently delete this profile and all their data including inbox items and tracker entries. This cannot be undone.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 rounded-full border border-[#2A3544] py-2 text-[13px] font-medium text-[#9CA3AF] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ ...deleteConfirm, step: 2 })}
                    className="flex-1 rounded-full border border-[#DC2626]/40 py-2 text-[13px] font-medium text-[#DC2626] hover:bg-[#DC2626]/10"
                  >
                    Yes, Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DC2626]/20">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#DC2626]" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="text-center text-[15px] font-semibold text-[#DC2626]">Are you absolutely sure?</h3>
                <p className="mt-2 text-center text-[13px] leading-relaxed text-[#9CA3AF]">
                  This is permanent. All data for <span className="text-white font-medium">{deleteConfirm.name}</span> will be gone forever. There is no undo.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 rounded-full border border-[#2A3544] py-2 text-[13px] font-medium text-[#9CA3AF] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(deleteConfirm.id)}
                    disabled={deleting}
                    className="flex-1 rounded-full bg-[#DC2626] py-2 text-[13px] font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clients ({profiles.length})</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/onboard")}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-3 py-1.5 text-[12px] font-semibold text-[#0C1016]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Onboard
          </button>
        </div>
      </div>

      {/* Client cards */}
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
                <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#B8BFC8] ring-1 ring-[#2A3544]">{p.current_city}</span>
              )}
              {p.salary_min > 0 && (
                <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#B8BFC8] ring-1 ring-[#2A3544]">${p.salary_min.toLocaleString()}+</span>
              )}
              {p.last_fetch_at && (
                <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#9CA3AF] ring-1 ring-[#2A3544]">
                  Last scan: {formatTimeAgo(new Date(p.last_fetch_at))}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                className="rounded-full border border-[#2A3544] px-3 py-1 text-[11px] font-medium text-[#B8BFC8] hover:border-[#6AD7A3]/50"
              >
                {editingId === p.id ? "Close" : "Edit"}
              </button>
              <button
                type="button"
                onClick={() => handleFetch(p.id, p.display_name)}
                disabled={fetchingId === p.id || p.status !== "active"}
                className="rounded-full border border-[#6AD7A3]/30 px-3 py-1 text-[11px] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10 disabled:opacity-40"
              >
                {fetchingId === p.id ? "Fetching..." : "Fetch"}
              </button>
              <button
                type="button"
                onClick={() => window.open(`/inbox?view_as=${p.id}`, '_blank')}
                className="rounded-full border border-[#38BDF8]/30 px-3 py-1 text-[11px] font-medium text-[#38BDF8] hover:bg-[#38BDF8]/10"
              >
                View As
              </button>
              <button
                type="button"
                onClick={() => router.push(`/admin/lanes?profile=${p.id}`)}
                className="rounded-full border border-[#8B5CF6]/30 px-3 py-1 text-[11px] font-medium text-[#8B5CF6] hover:bg-[#8B5CF6]/10"
              >
                Lanes
              </button>
              <button
                type="button"
                onClick={() => copyLink(p.id)}
                className="rounded-full border border-[#2A3544] px-3 py-1 text-[11px] font-medium text-[#9CA3AF] hover:text-[#B8BFC8]"
              >
                Get Link
              </button>
              <div className="ml-auto flex items-center gap-2">
                {p.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => handleUpdate(p.id, { status: "inactive_soft_locked", status_reason: "Locked by admin" })}
                    className="rounded-full border border-[#DC2626]/30 px-3 py-1 text-[11px] font-medium text-[#DC2626] hover:bg-[#DC2626]/10"
                  >
                    Lock
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpdate(p.id, { status: "active", status_reason: "" })}
                    className="rounded-full border border-[#6AD7A3]/30 px-3 py-1 text-[11px] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
                  >
                    Unlock
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ id: p.id, name: p.display_name, step: 1 })}
                  className="rounded-full border border-[#DC2626]/20 px-2 py-1 text-[11px] text-[#6B7280] hover:border-[#DC2626]/40 hover:text-[#DC2626]"
                  title="Delete profile"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

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

  const inputClass = "w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]";

  return (
    <div className="mt-3 space-y-3 border-t border-[#2A3544] pt-3 animate-slide-down">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Min Salary</label>
          <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            <option value="client">Client</option>
            <option value="coach">Coach</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSave({ display_name: name, current_city: city, salary_min: parseInt(salary) || 0, role })}
        className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016]"
      >
        Save Changes
      </button>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
