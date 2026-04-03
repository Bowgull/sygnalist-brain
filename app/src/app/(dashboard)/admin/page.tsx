"use client";

import { useState } from "react";
import ProfilesPanel from "@/components/admin/profiles-panel";
import LogsPanel from "@/components/admin/logs-panel";
import LanesPanel from "@/components/admin/lanes-panel";
import JobBankPanel from "@/components/admin/job-bank-panel";
import AnalyticsPanel from "@/components/admin/analytics-panel";
import OpsPanel from "@/components/admin/ops-panel";

const SUB_TABS = [
  { key: "profiles", label: "Profiles" },
  { key: "intake", label: "Jobs Intake" },
  { key: "lanes", label: "Lanes" },
  { key: "bank", label: "Job Bank" },
  { key: "logs", label: "Logs" },
  { key: "analytics", label: "Analytics" },
  { key: "ops", label: "Ops" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["key"];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<SubTab>("profiles");

  return (
    <div>
      {/* Sub-tab navigation */}
      <div className="sticky top-0 z-10 border-b border-[#2A3544] bg-[#151C24] px-4 py-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
                activeTab === tab.key
                  ? "bg-[#171F28] text-[#FAD76A] border border-[#FAD76A]/20"
                  : "text-[#9CA3AF] hover:text-[#B8BFC8] border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel content */}
      {activeTab === "profiles" && <ProfilesPanel />}
      {activeTab === "intake" && <JobsIntakePanel />}
      {activeTab === "lanes" && <LanesPanel />}
      {activeTab === "bank" && <JobBankPanel />}
      {activeTab === "logs" && <LogsPanel />}
      {activeTab === "analytics" && <AnalyticsPanel />}
      {activeTab === "ops" && <OpsPanel />}
    </div>
  );
}

/**
 * Jobs Intake panel — shows recent inbox jobs across all profiles for curation.
 * Uses the global job bank as the data source since cross-profile inbox
 * viewing would require a new API endpoint.
 */
function JobsIntakePanel() {
  return (
    <div>
      <div className="border-b border-[#2A3544] bg-[#151C24] px-4 py-2.5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
          Jobs Intake — Curate from Global Job Bank
        </p>
      </div>
      <JobBankPanel />
    </div>
  );
}
