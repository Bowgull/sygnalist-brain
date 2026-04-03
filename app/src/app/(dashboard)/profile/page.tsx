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
      <div className="space-y-4 px-4 py-6">
        <div className="h-32 animate-pulse rounded-2xl bg-[#171F28]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#171F28]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-sm text-[#B8BFC8]">Profile not found</p>
        <button onClick={handleSignOut} className="mt-4 text-sm text-[#DC2626]">
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

  return (
    <div className="space-y-4 px-4 py-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#6AD7A3] px-4 py-2 text-sm font-medium text-[#0C1016] shadow-lg">
          {toast}
        </div>
      )}

      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28]">
        <div className="h-20 bg-gradient-to-r from-[#A9FFB5]/20 via-[#5EF2C7]/15 to-[#39D6FF]/20" />
        <div className="px-5 pb-5">
          <div className="-mt-8 flex items-end gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A9FFB5]/20 to-[#39D6FF]/20 text-2xl font-bold text-[#6AD7A3] ring-4 ring-[#171F28]">
              {profile.display_name[0]?.toUpperCase()}
            </div>
            <div className="mb-1">
              <h1 className="text-lg font-bold">{profile.display_name}</h1>
              <p className="text-[12px] text-[#9CA3AF]">{profile.email}</p>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <div className="flex-1 rounded-xl bg-[#0C1016] p-3 text-center">
              <p className="text-[10px] font-medium uppercase text-[#6B7280]">Member Since</p>
              <p className="mt-0.5 text-[13px] font-semibold text-white">{memberSince}</p>
            </div>
            <div className="flex-1 rounded-xl bg-[#0C1016] p-3 text-center">
              <p className="text-[10px] font-medium uppercase text-[#6B7280]">Last Scan</p>
              <p className="mt-0.5 text-[13px] font-semibold text-white">{lastScan}</p>
            </div>
            <div className="flex-1 rounded-xl bg-[#0C1016] p-3 text-center">
              <p className="text-[10px] font-medium uppercase text-[#6B7280]">Status</p>
              <p className={`mt-0.5 text-[13px] font-semibold ${profile.status === "active" ? "text-[#6AD7A3]" : "text-[#DC2626]"}`}>
                {profile.status === "active" ? "Active" : "Locked"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Roles */}
      {roles.length > 0 && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Target Roles</h2>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((r, i) => (
              <span key={i} className="rounded-full bg-[#6AD7A3]/10 px-3 py-1 text-[12px] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {profile.top_skills.length > 0 && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Top Skills</h2>
          <div className="flex flex-wrap gap-1.5">
            {profile.top_skills.map((s, i) => (
              <span key={i} className="rounded-full bg-[#38BDF8]/10 px-3 py-1 text-[12px] font-medium text-[#38BDF8] ring-1 ring-[#38BDF8]/20">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preferences — Editable */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Preferences</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-full bg-[#6AD7A3]/10 px-3 py-1 text-[11px] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20 transition hover:bg-[#6AD7A3]/20"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Display Name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-[#2A3544] bg-[#0C1016] px-3 py-2.5 text-sm text-white outline-none focus:border-[#6AD7A3]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-[#2A3544] bg-[#0C1016] px-3 py-2.5 text-sm text-white outline-none focus:border-[#6AD7A3]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Min Salary</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>
                <input
                  type="number"
                  value={salary || ""}
                  onChange={(e) => setSalary(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[#2A3544] bg-[#0C1016] py-2.5 pl-7 pr-3 text-sm text-white outline-none focus:border-[#6AD7A3]"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Work Mode</label>
              <div className="flex gap-2">
                {([
                  ["Remote", remote, setRemote],
                  ["Hybrid", hybrid, setHybrid],
                  ["Onsite", onsite, setOnsite],
                ] as const).map(([label, val, setter]) => (
                  <button
                    key={label}
                    onClick={() => (setter as (v: boolean) => void)(!val)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
                      val
                        ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                        : "bg-[#0C1016] text-[#6B7280] ring-1 ring-[#2A3544]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
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
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-[#2A3544] py-2.5 text-sm font-medium text-[#9CA3AF]">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-2.5 text-sm font-bold text-[#0C1016] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <PrefRow label="City" value={profile.current_city || "Not set"} />
            <PrefRow label="Min Salary" value={profile.salary_min > 0 ? `$${profile.salary_min.toLocaleString()}` : "Not set"} />
            <PrefRow label="Work Mode" value={[profile.accept_remote && "Remote", profile.accept_hybrid && "Hybrid", profile.accept_onsite && "Onsite"].filter(Boolean).join(", ") || "Any"} />
            <PrefRow label="Max Distance" value={`${profile.distance_range_km} km`} />
          </div>
        )}
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full rounded-xl border border-[#DC2626]/20 py-3 text-sm font-medium text-[#DC2626] transition hover:bg-[#DC2626]/10"
      >
        Sign Out
      </button>
    </div>
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#6B7280]">{label}</span>
      <span className="text-[13px] font-medium text-white">{value}</span>
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
