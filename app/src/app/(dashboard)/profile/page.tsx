"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/profile");
      if (res.ok) {
        setProfile(await res.json());
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-20 animate-pulse rounded-2xl bg-[#171F28]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#171F28]" />
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

  return (
    <div className="space-y-4 p-4">
      {/* Profile header */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#A9FFB5]/20 to-[#39D6FF]/20">
            <span className="text-lg font-bold text-[#6AD7A3]">
              {(profile.display_name as string)?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{profile.display_name as string}</h2>
            <p className="text-xs text-[#9CA3AF]">{profile.email as string}</p>
          </div>
          <div className="ml-auto">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                profile.status === "active"
                  ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-[#6AD7A3]/30"
                  : "bg-[#DC2626]/15 text-[#DC2626] ring-[#DC2626]/30"
              }`}
            >
              {profile.status === "active" ? "Active" : "Locked"}
            </span>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4">
        <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[#9CA3AF]">
          Preferences
        </h3>
        <div className="space-y-2.5 text-sm">
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
            <span className="text-white">
              {[
                profile.accept_remote && "Remote",
                profile.accept_hybrid && "Hybrid",
                profile.accept_onsite && "Onsite",
              ]
                .filter(Boolean)
                .join(", ") || "Not set"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8BFC8]">Distance Range</span>
            <span className="text-white">{profile.distance_range_km as number}km</span>
          </div>
        </div>
      </div>

      {/* Skills */}
      {(profile.top_skills as string[])?.length > 0 && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4">
          <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            Top Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(profile.top_skills as string[]).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-[#6AD7A3]/10 px-2.5 py-0.5 text-[12px] text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20"
              >
                {skill}
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
