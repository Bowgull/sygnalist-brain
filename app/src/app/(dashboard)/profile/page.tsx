"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [toast, setToast] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setDraft(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: draft.display_name,
        current_city: draft.current_city,
        salary_min: Number(draft.salary_min) || 0,
        accept_remote: draft.accept_remote,
        accept_hybrid: draft.accept_hybrid,
        accept_onsite: draft.accept_onsite,
        distance_range_km: Number(draft.distance_range_km) || 50,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProfile(updated);
      setEditing(false);
      showToast("Profile updated");
    } else {
      showToast("Failed to save changes");
    }
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="stagger-children mx-auto max-w-2xl space-y-4 p-4 lg:px-0">
        <div className="h-28 animate-pulse rounded-2xl bg-[#171F28]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#171F28]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#171F28]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-[#B8BFC8]">Profile not found</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 rounded-full border border-[#2A3544] px-4 py-2 text-sm text-[#9CA3AF]"
        >
          Sign Out
        </button>
      </div>
    );
  }

  const memberSince = profile.created_at
    ? new Date(profile.created_at as string).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "—";

  return (
    <div className="stagger-children mx-auto max-w-2xl space-y-4 p-4 lg:px-0">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-full bg-[#6AD7A3] px-4 py-2 text-sm font-medium text-[#0C1016] shadow-lg">
          {toast}
        </div>
      )}

      {/* Profile banner with gradient mesh */}
      <div className="glass-card relative overflow-hidden">
        {/* Gradient mesh background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[#6AD7A3]/20 blur-3xl" />
          <div className="absolute -right-8 top-0 h-24 w-24 rounded-full bg-[#39D6FF]/15 blur-3xl" />
        </div>

        <div className="relative p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#A9FFB5]/30 to-[#39D6FF]/30 ring-2 ring-[#6AD7A3]/20">
              <span className="text-xl font-bold text-[#6AD7A3]">
                {(profile.display_name as string)?.charAt(0)?.toUpperCase() ?? "?"}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{profile.display_name as string}</h2>
              <p className="text-xs text-[#9CA3AF]">{profile.email as string}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                profile.status === "active"
                  ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-[#6AD7A3]/30"
                  : "bg-[#DC2626]/15 text-[#DC2626] ring-[#DC2626]/30"
              }`}
            >
              {profile.status === "active" ? "Active" : "Locked"}
            </span>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex gap-6 border-t border-[rgba(255,255,255,0.06)] pt-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">Member since</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{memberSince}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">Role</p>
              <p className="mt-0.5 text-sm font-semibold capitalize text-[#6AD7A3]">{profile.role as string}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            Preferences
          </h3>
          {!editing && (
            <button
              type="button"
              onClick={() => { setEditing(true); setDraft({ ...profile }); }}
              className="flex items-center gap-1.5 rounded-full border border-[#2A3544] px-3 py-1 text-[11px] font-medium text-[#B8BFC8] transition hover:border-[#6AD7A3]/50 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">Name</label>
                <input
                  value={draft.display_name as string}
                  onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">City</label>
                <input
                  value={draft.current_city as string}
                  onChange={(e) => setDraft({ ...draft, current_city: e.target.value })}
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">Min Salary</label>
                <input
                  type="number"
                  value={String(draft.salary_min ?? "")}
                  onChange={(e) => setDraft({ ...draft, salary_min: e.target.value })}
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">Distance (km)</label>
                <input
                  type="number"
                  value={String(draft.distance_range_km ?? 50)}
                  onChange={(e) => setDraft({ ...draft, distance_range_km: e.target.value })}
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
                />
              </div>
            </div>

            {/* Work mode toggles */}
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">Work Mode</label>
              <div className="flex gap-2">
                {(["Remote", "Hybrid", "Onsite"] as const).map((mode) => {
                  const key = `accept_${mode.toLowerCase()}` as string;
                  const active = !!draft[key];
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDraft({ ...draft, [key]: !active })}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        active
                          ? "bg-[#6AD7A3]/20 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/40"
                          : "bg-[#151C24] text-[#9CA3AF] ring-1 ring-[#2A3544]"
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-gradient rounded-full px-5 py-2 text-[12px] font-semibold disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setDraft({ ...profile }); }}
                className="rounded-full border border-[#2A3544] px-4 py-2 text-[12px] text-[#9CA3AF]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#B8BFC8]">Location</span>
              <span className="text-white">{(profile.current_city as string) || "Not set"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B8BFC8]">Min Salary</span>
              <span className="text-white">
                {(profile.salary_min as number) > 0
                  ? `$${(profile.salary_min as number).toLocaleString()}`
                  : "Not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B8BFC8]">Work Mode</span>
              <div className="flex gap-1.5">
                {([
                  profile.accept_remote && "Remote",
                  profile.accept_hybrid && "Hybrid",
                  profile.accept_onsite && "Onsite",
                ].filter(Boolean) as string[]).map((mode) => (
                    <span
                      key={mode}
                      className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[11px] text-[#6AD7A3]"
                    >
                      {mode}
                    </span>
                  ))}
                {!profile.accept_remote && !profile.accept_hybrid && !profile.accept_onsite && (
                  <span className="text-[#9CA3AF]">Not set</span>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B8BFC8]">Distance Range</span>
              <span className="text-white">{profile.distance_range_km as number}km</span>
            </div>
          </div>
        )}
      </div>

      {/* Skills */}
      {(profile.top_skills as string[])?.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            Top Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(profile.top_skills as string[]).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-[#6AD7A3]/10 px-2.5 py-1 text-[12px] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Role Tracks */}
      {(profile.role_tracks as { label: string }[])?.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            Target Roles
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(profile.role_tracks as { label: string }[]).map((track) => (
              <span
                key={track.label}
                className="rounded-full bg-[#38BDF8]/10 px-2.5 py-1 text-[12px] font-medium text-[#38BDF8] ring-1 ring-[#38BDF8]/20"
              >
                {track.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sign out */}
      <button
        type="button"
        onClick={handleSignOut}
        className="w-full rounded-full border border-[#2A3544] py-2.5 text-sm font-medium text-[#9CA3AF] transition-colors hover:border-[#DC2626]/50 hover:text-[#DC2626]"
      >
        Sign Out
      </button>
    </div>
  );
}
