"use client";

import { useState, useEffect } from "react";
import { X, Pencil, Check, Search, ChevronDown, ChevronUp } from "lucide-react";

interface Lane {
  id: string;
  lane_key: string;
  role_name: string;
  aliases: string[];
  is_active: boolean;
  status: string;
  source: string;
  job_count: number;
  created_at: string;
}

export default function AdminLanesPage() {
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; jobCount: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedView, setExpandedView] = useState(false);

  useEffect(() => {
    loadLanes();
  }, []);

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

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/admin/lanes?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setLanes((prev) => prev.filter((l) => l.id !== id));
      showToast("Lane removed");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Failed to remove lane");
    }
    setDeleting(false);
    setDeleteConfirm(null);
  }

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/admin/lanes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLanes((prev) => prev.map((l) => (l.id === id ? { ...updated, job_count: l.job_count } : l)));
      setEditing(null);
      showToast("Lane updated");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Failed to update lane");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  const filtered = search
    ? lanes.filter(
        (l) =>
          l.role_name.toLowerCase().includes(search.toLowerCase()) ||
          l.lane_key.toLowerCase().includes(search.toLowerCase()) ||
          (l.aliases ?? []).some((a) => a.toLowerCase().includes(search.toLowerCase())),
      )
    : lanes;

  const activeLanes = filtered.filter((l) => l.is_active !== false);
  const inactiveLanes = filtered.filter((l) => l.is_active === false);

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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[#2A3544] bg-[#151C24] p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DC2626]/20">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#DC2626]" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-center text-[15px] font-semibold text-[#DC2626]">Delete Lane?</h3>
            <p className="mt-2 text-center text-[13px] leading-relaxed text-[#9CA3AF]">
              Remove <span className="font-medium text-white">{deleteConfirm.name}</span>?
              {deleteConfirm.jobCount > 0 && (
                <span className="mt-1 block text-[#FBBF24]">
                  {deleteConfirm.jobCount} job(s) reference this lane and will be blocked by the server.
                </span>
              )}
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
                {deleting ? "Deleting..." : "Delete Lane"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Job Lanes ({lanes.length})</h1>
        <button
          onClick={() => setExpandedView(!expandedView)}
          className="flex items-center gap-1 text-[12px] text-[#9CA3AF] hover:text-white"
        >
          {expandedView ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expandedView ? "Compact" : "Expanded"}
        </button>
      </div>

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

      {/* Search */}
      {lanes.length > 6 && (
        <div className="relative">
          <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter lanes..."
            className="w-full rounded-xl border border-[#2A3544] bg-[#171F28] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]"
          />
        </div>
      )}

      {/* Lanes list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <p className="text-sm font-medium text-[#B8BFC8]">
            {search ? "No matching lanes" : "No lanes yet"}
          </p>
          <p className="mt-1 text-[11px] text-[#6B7280]">
            {search ? "Try a different search" : "Type a job role above to create your first lane"}
          </p>
        </div>
      ) : expandedView ? (
        <div className="space-y-2">
          {activeLanes.map((lane) => (
            <LaneRow
              key={lane.id}
              lane={lane}
              isEditing={editing === lane.id}
              onEdit={() => setEditing(editing === lane.id ? null : lane.id)}
              onUpdate={(patch) => handleUpdate(lane.id, patch)}
              onDelete={() => setDeleteConfirm({ id: lane.id, name: lane.role_name, jobCount: lane.job_count })}
              onCancel={() => setEditing(null)}
            />
          ))}
          {inactiveLanes.length > 0 && (
            <>
              <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Inactive</p>
              {inactiveLanes.map((lane) => (
                <LaneRow
                  key={lane.id}
                  lane={lane}
                  isEditing={editing === lane.id}
                  onEdit={() => setEditing(editing === lane.id ? null : lane.id)}
                  onUpdate={(patch) => handleUpdate(lane.id, patch)}
                  onDelete={() => setDeleteConfirm({ id: lane.id, name: lane.role_name, jobCount: lane.job_count })}
                  onCancel={() => setEditing(null)}
                />
              ))}
            </>
          )}
        </div>
      ) : (
        /* Compact pill view */
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {activeLanes.map((lane) => (
              <div
                key={lane.id}
                className="group flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#171F28] px-4 py-2 transition hover:border-[#6AD7A3]/30"
              >
                <span className="text-[13px] font-medium text-white">{lane.role_name}</span>
                {lane.job_count > 0 && (
                  <span className="text-[10px] text-[#6AD7A3]">{lane.job_count}</span>
                )}
                <button
                  onClick={() => setEditing(lane.id)}
                  className="ml-0.5 inline-flex rounded-full p-0.5 text-[#4B5563] transition hover:bg-[#6AD7A3]/10 hover:text-[#6AD7A3] sm:hidden sm:group-hover:inline-flex"
                  title="Edit lane"
                >
                  <Pencil size={12} strokeWidth={2} />
                </button>
                <button
                  onClick={() => setDeleteConfirm({ id: lane.id, name: lane.role_name, jobCount: lane.job_count })}
                  className="inline-flex rounded-full p-0.5 text-[#4B5563] transition hover:bg-[#DC2626]/10 hover:text-[#DC2626] sm:hidden sm:group-hover:inline-flex"
                  title="Remove lane"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
          {inactiveLanes.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Inactive</p>
              <div className="flex flex-wrap gap-2">
                {inactiveLanes.map((lane) => (
                  <div
                    key={lane.id}
                    className="group flex items-center gap-2 rounded-full border border-[#2A3544]/50 bg-[#171F28]/60 px-4 py-2 opacity-60 transition hover:opacity-100"
                  >
                    <span className="text-[13px] font-medium text-[#6B7280]">{lane.role_name}</span>
                    <button
                      onClick={() => handleUpdate(lane.id, { is_active: true })}
                      className="ml-0.5 inline text-[10px] text-[#6AD7A3] hover:underline sm:hidden sm:group-hover:inline"
                    >
                      Activate
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Inline edit modal for compact view */}
          {editing && (
            <LaneEditModal
              lane={lanes.find((l) => l.id === editing)!}
              onUpdate={(patch) => handleUpdate(editing, patch)}
              onCancel={() => setEditing(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LaneRow({
  lane,
  isEditing,
  onEdit,
  onUpdate,
  onDelete,
  onCancel,
}: {
  lane: Lane;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (patch: Record<string, unknown>) => void | Promise<void>;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [roleName, setRoleName] = useState(lane.role_name);
  const [aliases, setAliases] = useState((lane.aliases ?? []).join(", "));
  const [isActive, setIsActive] = useState(lane.is_active !== false);

  const inputClass =
    "w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[0.8125rem] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]";

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-[#6AD7A3]/30 bg-[#171F28] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
              Name
            </label>
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Lane name" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
              Aliases (comma-separated)
            </label>
            <input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="e.g. PM, prod mgr" className={inputClass} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              isActive ? "border-[#6AD7A3] bg-[#6AD7A3] text-[#0C1016]" : "border-[#4B5563]"
            }`}
          >
            {isActive && (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <span className="text-[12px] text-[#9CA3AF]">Active</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onUpdate({
                role_name: roleName.trim() || lane.role_name,
                aliases: aliases
                  .split(",")
                  .map((a) => a.trim())
                  .filter(Boolean),
                is_active: isActive,
              })
            }
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016]"
          >
            <Check size={14} strokeWidth={2} />
            Save
          </button>
          <button type="button" onClick={onCancel} className="rounded-full border border-[#2A3544] px-4 py-1.5 text-[12px] text-[#9CA3AF]">
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#DC2626]/30 px-3 py-1.5 text-[12px] text-[#DC2626] hover:bg-[#DC2626]/10"
          >
            <X size={14} strokeWidth={2} />
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center justify-between rounded-2xl border bg-[#171F28] px-4 py-3 transition ${
        lane.is_active !== false
          ? "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]"
          : "border-[#2A3544]/50 opacity-60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold">{lane.role_name}</span>
          {lane.job_count > 0 && (
            <span className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[10px] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20">
              {lane.job_count} job{lane.job_count !== 1 ? "s" : ""}
            </span>
          )}
          {lane.is_active === false && (
            <span className="rounded-full bg-[#DC2626]/10 px-2 py-0.5 text-[10px] text-[#DC2626] ring-1 ring-[#DC2626]/20">
              inactive
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#6B7280]">
          <span>{lane.lane_key}</span>
          {lane.aliases && lane.aliases.length > 0 && (
            <span className="text-[#4B5563]">aliases: {lane.aliases.join(", ")}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="rounded-lg p-1.5 text-[#6B7280] transition hover:bg-[#6AD7A3]/10 hover:text-[#6AD7A3]"
          title="Edit"
        >
          <Pencil size={16} strokeWidth={2} />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-[#6B7280] transition hover:bg-[#DC2626]/10 hover:text-[#DC2626]"
          title="Delete"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function LaneEditModal({
  lane,
  onUpdate,
  onCancel,
}: {
  lane: Lane;
  onUpdate: (patch: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [roleName, setRoleName] = useState(lane.role_name);
  const [aliases, setAliases] = useState((lane.aliases ?? []).join(", "));
  const [isActive, setIsActive] = useState(lane.is_active !== false);

  const inputClass =
    "w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[0.8125rem] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-[#2A3544] bg-[#151C24] p-6 space-y-4">
        <h3 className="text-[15px] font-semibold">Edit Lane</h3>
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Name</label>
          <input value={roleName} onChange={(e) => setRoleName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
            Aliases (comma-separated)
          </label>
          <input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="e.g. PM, prod mgr" className={inputClass} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              isActive ? "border-[#6AD7A3] bg-[#6AD7A3] text-[#0C1016]" : "border-[#4B5563]"
            }`}
          >
            {isActive && (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <span className="text-[12px] text-[#9CA3AF]">Active</span>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-full border border-[#2A3544] py-2 text-[13px] font-medium text-[#9CA3AF] hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdate({
                role_name: roleName.trim() || lane.role_name,
                aliases: aliases
                  .split(",")
                  .map((a) => a.trim())
                  .filter(Boolean),
                is_active: isActive,
              })
            }
            className="flex-1 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-2 text-[13px] font-semibold text-[#0C1016]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
