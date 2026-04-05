"use client";

import { useState } from "react";
import type { Database } from "@/types/database";
import ProfileTab from "./profile-tab";
import LanesTab from "./lanes-tab";
import ResumeTab from "./resume-tab";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const tabs = ["Profile", "Lanes", "Resume"] as const;
type Tab = (typeof tabs)[number];

export default function ClientEditor({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Profile");

  return (
    <div className="mt-3 border-t border-[#2A3544] pt-3 animate-slide-down">
      {/* Tab bar */}
      <div className="flex gap-1 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
              activeTab === tab
                ? "bg-[#171F28] text-[#FAD76A] border border-[#FAD76A]/20"
                : "text-[#9CA3AF] hover:text-[#B8BFC8] border border-transparent"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Profile" && <ProfileTab profile={profile} onSave={onSave} />}
      {activeTab === "Lanes" && <LanesTab profile={profile} onSave={onSave} />}
      {activeTab === "Resume" && <ResumeTab profile={profile} onSave={onSave} />}
    </div>
  );
}
