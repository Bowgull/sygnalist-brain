"use client";

import { useViewAs } from "./view-as-context";
import { Eye } from "lucide-react";

export default function ImpersonationBanner() {
  const { active, clientName, loading } = useViewAs();

  if (!active) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#F59E0B] via-[#F97316] to-[#F59E0B] px-4 py-2.5 text-[#0C1016] shadow-[0_2px_12px_rgba(245,158,11,0.3)]">
      <Eye size={18} strokeWidth={2.5} />
      <span className="text-[0.8125rem] font-bold uppercase tracking-[0.08em]">
        {loading ? "Loading client..." : `Viewing as ${clientName}`}
      </span>
      <span className="text-[0.6875rem] font-medium opacity-70">
        — All actions affect this client's account
      </span>
    </div>
  );
}
