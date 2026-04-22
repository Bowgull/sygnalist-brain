"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Pencil,
  Radar,
  Eye,
  Lock,
  Unlock,
  Trash2,
  X,
  Plus,
  MoreVertical,
  AlertTriangle,
} from "lucide-react";
import ClientEditor from "@/components/admin/client-editor";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  Section,
} from "@/components/design-system";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function AdminClientsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    step: 1 | 2;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
      toast.success("Profile updated");
    } else {
      toast.error("Failed to update");
    }
  }

  async function handleFetch(profileId: string, name: string) {
    if (!confirm(`Run a scan for ${name}? Jobs will land in their inbox.`)) return;
    setFetchingId(profileId);
    toast.info(`Running scan for ${name}…`);
    const res = await fetch("/api/admin/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId }),
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`${name}: ${data.jobs_delivered} sygnals delivered`, {
        description: `${data.duration_ms}ms`,
      });
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(`Scan failed: ${data.error ?? "unknown error"}`);
    }
    setFetchingId(null);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/admin/profiles/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      toast.success("Profile permanently deleted");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to delete");
    }
    setDeleting(false);
    setDeleteConfirm(null);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-ds-shimmer rounded-[var(--ds-radius-md)]" />
        ))}
      </div>
    );
  }

  return (
    <>
      <Section
        eyebrow="Admin · clients"
        title={`Clients (${profiles.length})`}
        description="Edit profiles, trigger scans, view as client, and lock or delete accounts."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push("/admin/onboard")}
            icon={<Plus size={14} strokeWidth={2} />}
          >
            Onboard
          </Button>
        }
      >
        <div className="space-y-2">
          {profiles.map((p) => (
            <ClientRow
              key={p.id}
              profile={p}
              editing={editingId === p.id}
              fetching={fetchingId === p.id}
              menuOpen={openMenuId === p.id}
              onToggleEdit={() => setEditingId(editingId === p.id ? null : p.id)}
              onToggleMenu={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
              onCloseMenu={() => setOpenMenuId(null)}
              onFetch={() => handleFetch(p.id, p.display_name)}
              onLock={() =>
                handleUpdate(p.id, {
                  status: "inactive_soft_locked",
                  status_reason: "Locked by admin",
                })
              }
              onUnlock={() => handleUpdate(p.id, { status: "active", status_reason: "" })}
              onDelete={() =>
                setDeleteConfirm({ id: p.id, name: p.display_name, step: 1 })
              }
              onSave={(patch) => handleUpdate(p.id, patch)}
            />
          ))}
        </div>
      </Section>

      {/* Delete confirmation — 2-step DS Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={
          deleteConfirm?.step === 1
            ? `Delete ${deleteConfirm.name}?`
            : "Are you absolutely sure?"
        }
        description={
          deleteConfirm?.step === 1
            ? "This permanently deletes the profile, inbox items, and tracker entries. No undo."
            : `All data for ${deleteConfirm?.name ?? "this client"} will be gone forever.`
        }
        maxWidth={440}
        footer={
          deleteConfirm?.step === 1 ? (
            <>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  setDeleteConfirm(
                    deleteConfirm ? { ...deleteConfirm, step: 2 } : null,
                  )
                }
              >
                Yes, delete
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}
                disabled={deleting}
                icon={<Trash2 size={14} strokeWidth={2} />}
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </Button>
            </>
          )
        }
      >
        <div className="flex justify-center py-2">
          <div
            className={[
              "flex h-12 w-12 items-center justify-center rounded-[var(--ds-radius-md)]",
              "border",
              deleteConfirm?.step === 1
                ? "bg-[rgba(212,105,92,0.08)] border-[rgba(212,105,92,0.25)] text-[var(--ds-err)]"
                : "bg-[rgba(212,105,92,0.15)] border-[rgba(212,105,92,0.40)] text-[var(--ds-err)]",
            ].join(" ")}
          >
            <AlertTriangle size={22} strokeWidth={2} />
          </div>
        </div>
      </Dialog>
    </>
  );
}

function ClientRow({
  profile,
  editing,
  fetching,
  menuOpen,
  onToggleEdit,
  onToggleMenu,
  onCloseMenu,
  onFetch,
  onLock,
  onUnlock,
  onDelete,
  onSave,
}: {
  profile: Profile;
  editing: boolean;
  fetching: boolean;
  menuOpen: boolean;
  onToggleEdit: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onFetch: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onDelete: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const isLocked = profile.status !== "active";
  const isStale =
    !isLocked &&
    profile.last_fetch_at &&
    Date.now() - new Date(profile.last_fetch_at).getTime() > 7 * 24 * 60 * 60 * 1000;

  const stats: string[] = [];
  if (profile.current_city) stats.push(profile.current_city);
  if (profile.salary_min > 0) stats.push(`$${profile.salary_min.toLocaleString()}+`);
  if (profile.last_fetch_at) stats.push(formatTimeAgo(new Date(profile.last_fetch_at)));

  const accentColor = isLocked
    ? "var(--ds-err)"
    : isStale
      ? "var(--ds-warn)"
      : "var(--ds-accent)";

  return (
    <div>
      <Card>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderLeft: `2px solid ${accentColor}` }}>
          {/* Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-full)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-2)]">
            <span className="font-[family-name:var(--font-ds-sans)] text-[13px] font-semibold text-[var(--ds-text-0)]">
              {profile.display_name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Name + email */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold text-[var(--ds-text-0)]">
                {profile.display_name}
              </h3>
              {isLocked ? (
                <Badge tone="err" dot>
                  Locked
                </Badge>
              ) : isStale ? (
                <Badge tone="warn" dot>
                  Stale
                </Badge>
              ) : (
                <Badge tone="ok" dot>
                  Active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--ds-text-3)] mt-0.5">
              <span className="truncate text-[var(--ds-text-2)]">
                {profile.email ?? "No email"}
              </span>
              {stats.length > 0 ? (
                <>
                  <span className="text-[var(--ds-text-3)]">·</span>
                  <span className="font-[family-name:var(--font-ds-mono)] truncate">
                    {stats.join(" · ")}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              title={editing ? "Close editor" : "Edit profile"}
              onClick={onToggleEdit}
            >
              {editing ? <X size={14} strokeWidth={2} /> : <Pencil size={14} strokeWidth={2} />}
            </IconButton>
            <IconButton
              title="View as client"
              onClick={() => window.open(`/inbox?view_as=${profile.id}`, "_blank")}
            >
              <Eye size={14} strokeWidth={2} />
            </IconButton>
            <OverflowMenu
              isOpen={menuOpen}
              onToggle={onToggleMenu}
              onClose={onCloseMenu}
              items={[
                {
                  icon: Radar,
                  label: fetching ? "Scanning…" : "Run scan",
                  tone: "accent",
                  disabled: fetching || isLocked,
                  onClick: onFetch,
                },
                isLocked
                  ? {
                      icon: Unlock,
                      label: "Unlock",
                      tone: "accent",
                      onClick: onUnlock,
                    }
                  : {
                      icon: Lock,
                      label: "Lock",
                      tone: "destructive",
                      onClick: onLock,
                    },
                {
                  icon: Trash2,
                  label: "Delete",
                  tone: "destructive",
                  onClick: onDelete,
                },
              ]}
            />
          </div>
        </div>
      </Card>

      {editing ? (
        <div className="ml-3 mt-1 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-1)] bg-[var(--ds-bg-1)] p-4">
          <ClientEditor profile={profile} onSave={onSave} />
        </div>
      ) : null}
    </div>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-sm)] text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)] hover:bg-[var(--ds-bg-2)] transition-colors"
    >
      {children}
    </button>
  );
}

/* ── Overflow menu ── */

interface MenuItem {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  tone: "neutral" | "accent" | "destructive";
  disabled?: boolean;
  onClick: () => void;
}

function OverflowMenu({
  isOpen,
  onToggle,
  onClose,
  items,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: MenuItem[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = items.length * 36 + 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight + 8 ? rect.top - menuHeight - 4 : rect.bottom + 4;
      setPos({ top, left: rect.right - 184 });
    }
  }, [isOpen, items.length]);

  const toneColor: Record<MenuItem["tone"], string> = {
    neutral: "text-[var(--ds-text-1)] hover:text-[var(--ds-text-0)] hover:bg-[var(--ds-bg-3)]",
    accent: "text-[var(--ds-accent-bright)] hover:bg-[var(--ds-accent-soft)]",
    destructive: "text-[var(--ds-err)] hover:bg-[rgba(212,105,92,0.08)]",
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        title="More actions"
        aria-label="More actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-sm)] text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)] hover:bg-[var(--ds-bg-2)] transition-colors"
      >
        <MoreVertical size={14} strokeWidth={2} />
      </button>

      {isOpen && pos ? (
        <div
          className="fixed z-50 w-[184px] overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-2)] py-1 shadow-[var(--ds-shadow-elevate)]"
          style={{ top: pos.top, left: Math.max(8, pos.left) }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className={[
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  "disabled:opacity-40 disabled:pointer-events-none",
                  toneColor[item.tone],
                ].join(" ")}
              >
                <Icon size={14} strokeWidth={2} />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
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
