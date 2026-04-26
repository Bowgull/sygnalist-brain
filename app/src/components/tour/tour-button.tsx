"use client";

import { HelpCircle } from "lucide-react";
import { useTour } from "./tour-provider";

export default function TourButton() {
  const { openPicker, enabled } = useTour();
  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={openPicker}
      title="Replay tour"
      className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#6AD7A3] hover:bg-[#1E2730] transition-colors"
    >
      <HelpCircle size={16} strokeWidth={2} />
    </button>
  );
}
