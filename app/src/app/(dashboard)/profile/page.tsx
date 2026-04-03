"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ProfileData {
  id: string;
  display_name: string;
  email: string | null;
  status: string;
  current_city: string;
  salary_min: number;
  accept_remote: boolean;
  accept_hybrid: boolean;
  accept_onsite: boolean;
  distance_range_km: number;
  preferred_locations: string[];
  top_skills: string[];
  skill_keywords_plus: string[];
  banned_keywords: string[];
  role_tracks: Array<{ label?: string }> | null;
  last_fetch_at: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Editable state
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [salary, setSalary] = useState(0);
  const [remote, setRemote] = useState(true);
  const [hybrid, setHybrid] = useState(true);
  const [onsite, setOnsite] = useState(false);
  const [distance, setDistance] = useState(50);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setDisplayName(data.display_name);
        setCity(data.current_city);
        setSalary(data.salary_min);
        setRemote(data.accept_remote);
        setHybrid(data.accept_hybrid);
        setOnsite(data.accept_onsite);
        setDistance(data.distance_range_km);
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
        display_name: displayName,
        current_city: city,
        salary_min: salary,
        accept_remote: remote,
        accept_hybrid: hybrid,
        accept_onsite: onsite,
        distance_range_km: distance,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setProfile(updated);
      setEditing(false);
      showToast("Profile updated!");
    } else {
      showToast("Failed to save");
    }
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="space-y-3 md:space-y-4 p-3 md:p-6">
        <div className="h-24 animate-pulse rounded-[var(--radius-lg)]" />
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[0.9375rem] text-[#B8BFC8]">Profile not found</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 inline-flex h-[34px] items-center rounded-full border border-[#2A3544] px-4 text-[0.8125rem] text-[#9CA3AF]"
        >
          Sign Out
        </button>
      </div>
    );
  }

  const roles = (profile.role_tracks ?? []).map((t) => t.label).filter(Boolean);
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const lastScan = profile.last_fetch_at
    ? formatTimeAgo(new Date(profile.last_fetch_at))
    : "Never";

  const inputClass = "w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-[0.8125rem] text-white outline-none transition-colors focus:border-[#6AD7A3]";

  return (
    <div className="space-y-3 md:space-y-4 p-3 md:p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#6AD7A3] px-4 py-2 text-[0.8125rem] font-semibold text-[#0C1016] shadow-lg animate-slide-up">
          {toast}
        </div>
      )}

      {/* Profile header */}
      <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 md:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#A9FFB5]/20 to-[#39D6FF]/20 ring-1 ring-[#6AD7A3]/20">
            <span className="text-xl font-bold text-[#6AD7A3]">
              {profile.display_name[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[1rem] md:text-[1.3125rem] font-bold text-white">{profile.display_name}</h2>
            <p className="text-[0.8125rem] text-[#9CA3AF]">{profile.email}</p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] ${
              profile.status === "active"
                ? "border-[#6AD7A3]/25 bg-[#6AD7A3]/12 text-[#6AD7A3]"
                : "border-[#DC2626]/25 bg-[#DC2626]/12 text-[#DC2626]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {profile.status === "active" ? "Active" : "Locked"}
          </span>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex gap-3">
          {[
            { label: "Member Since", value: memberSince },
            { label: "Last Scan", value: lastScan },
          ].map((s) => (
            <div key={s.label} className="flex-1 rounded-lg bg-[#0C1016] p-3 text-center">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">{s.label}</p>
              <p className="mt-0.5 text-[0.8125rem] font-semibold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Roles */}
      {roles.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 md:p-6">
          <h3 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Target Roles</h3>
          <div className="flex flex-wrap gap-2">
            {roles.map((r, i) => (
              <span key={i} className="inline-flex h-[26px] items-center rounded-full border border-[#6AD7A3]/20 bg-[#6AD7A3]/8 px-3 text-[0.6875rem] font-medium text-[#6AD7A3]">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {profile.top_skills.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 md:p-6">
          <h3 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Top Skills</h3>
          <div className="flex flex-wrap gap-2">
            {profile.top_skills.map((s, i) => (
              <span key={i} className="inline-flex h-[26px] items-center rounded-full border border-[#38BDF8]/20 bg-[#38BDF8]/8 px-3 text-[0.6875rem] font-medium text-[#38BDF8]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preferences — Editable */}
      <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Preferences</h3>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-full bg-[#171F28] px-3 py-1 text-[0.6875rem] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20 hover:bg-[#6AD7A3]/10"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3 animate-slide-down">
            <div>
              <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Display Name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Min Salary</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-[#9CA3AF]">$</span>
                <input
                  type="number"
                  value={salary || ""}
                  onChange={(e) => setSalary(parseInt(e.target.value) || 0)}
                  className={`${inputClass} pl-7`}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Work Mode</label>
              <div className="flex gap-2">
                {([
                  ["Remote", remote, setRemote],
                  ["Hybrid", hybrid, setHybrid],
                  ["Onsite", onsite, setOnsite],
                ] as const).map(([label, val, setter]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => (setter as (v: boolean) => void)(!val)}
                    className={`flex-1 rounded-full py-2 text-[0.8125rem] font-medium transition-colors ${
                      val
                        ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                        : "bg-[#151C24] text-[#9CA3AF] ring-1 ring-[#2A3544]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
                Max Distance: {distance} km
              </label>
              <input
                type="range"
                min={10}
                max={200}
                step={10}
                value={distance}
                onChange={(e) => setDistance(parseInt(e.target.value))}
                className="w-full accent-[#6AD7A3]"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-full border border-[#2A3544] py-2.5 text-[0.8125rem] font-medium text-[#9CA3AF] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] py-2.5 text-[0.8125rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.1)] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-[0.9375rem]">
            <PrefRow label="City" value={profile.current_city || "Not set"} />
            <PrefRow label="Min Salary" value={profile.salary_min > 0 ? `$${profile.salary_min.toLocaleString()}` : "Not set"} />
            <PrefRow label="Work Mode" value={[profile.accept_remote && "Remote", profile.accept_hybrid && "Hybrid", profile.accept_onsite && "Onsite"].filter(Boolean).join(", ") || "Any"} />
            <PrefRow label="Max Distance" value={`${profile.distance_range_km} km`} />
          </div>
        )}
      </div>

      {/* Sign Out */}
      <button
        type="button"
        onClick={handleSignOut}
        className="w-full rounded-full border border-[#2A3544] py-2.5 text-[0.875rem] font-medium text-[#9CA3AF] transition-all hover:border-[#DC2626]/40 hover:text-[#DC2626]"
      >
        Sign Out
      </button>
    </div>
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#B8BFC8]">{label}</span>
      <span className="font-medium text-white">{value}</span>
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
