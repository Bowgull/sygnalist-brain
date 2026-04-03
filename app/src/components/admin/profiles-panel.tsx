"use client";

import { useState, useEffect } from "react";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function ProfilesPanel() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState<Record<string, unknown>>({});

  useEffect(() => {
    fetch("/api/admin/profiles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setProfiles(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = profiles.filter((p) =>
    `${p.display_name} ${p.email} ${p.profile_id}`.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave(id: string) {
    const res = await fetch(`/api/admin/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editPatch),
    });
    if (res.ok) {
      const updated = await res.json();
      setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }
    setEditing(null);
    setEditPatch({});
  }

  if (loading) {
    return <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div>
      {/* Search */}
      <div className="sticky top-0 z-10 border-b border-[#2A3544] bg-[#151C24] px-4 py-2.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search profiles..."
          className="w-full rounded-lg border border-[#2A3544] bg-[#171F28] px-3 py-2 text-[0.8125rem] text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b border-[#2A3544] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">City</th>
              <th className="px-4 py-2.5">Salary Min</th>
              <th className="px-4 py-2.5">Last Fetch</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-[#2A3544]/50 hover:bg-[#222D3D]/50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-white">{p.display_name}</td>
                <td className="px-4 py-2.5 text-[#B8BFC8]">{p.email || "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium ${
                    p.status === "active"
                      ? "border-[#6AD7A3]/25 bg-[#6AD7A3]/10 text-[#6AD7A3]"
                      : "border-[#DC2626]/25 bg-[#DC2626]/10 text-[#DC2626]"
                  }`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {p.status === "active" ? "Active" : "Locked"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {p.role === "admin" ? (
                    <span className="text-[#FAD76A] text-[0.6875rem] font-semibold uppercase">Admin</span>
                  ) : (
                    <span className="text-[#9CA3AF]">Client</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#B8BFC8]">{p.current_city || "—"}</td>
                <td className="px-4 py-2.5 text-[#B8BFC8]">{p.salary_min > 0 ? `$${p.salary_min.toLocaleString()}` : "—"}</td>
                <td className="px-4 py-2.5 text-[#9CA3AF] text-[0.75rem] tabular-nums">
                  {p.last_fetch_at ? new Date(p.last_fetch_at).toLocaleDateString() : "Never"}
                </td>
                <td className="px-4 py-2.5">
                  {editing === p.id ? (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSave(p.id)}
                        className="rounded px-2 py-1 text-[0.6875rem] font-medium text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditing(null); setEditPatch({}); }}
                        className="rounded px-2 py-1 text-[0.6875rem] text-[#9CA3AF] hover:bg-[#222D3D]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(p.id);
                          setEditPatch({ status: p.status === "active" ? "inactive_soft_locked" : "active" });
                        }}
                        className={`rounded px-2 py-1 text-[0.6875rem] font-medium ${
                          p.status === "active"
                            ? "text-[#F59E0B] hover:bg-[#F59E0B]/10"
                            : "text-[#6AD7A3] hover:bg-[#6AD7A3]/10"
                        }`}
                      >
                        {p.status === "active" ? "Lock" : "Unlock"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="py-10 text-center text-[0.8125rem] text-[#9CA3AF]">No profiles found</p>
      )}
    </div>
  );
}
