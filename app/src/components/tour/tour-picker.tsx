"use client";

import { TOURS, type TourId } from "@/lib/tour/tours";

export default function TourPicker({
  onPick,
  onSkip,
}: {
  onPick: (id: TourId) => void;
  onSkip: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={onSkip}
    >
      <div
        className="w-full max-w-md rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">Pick your tour.</h2>
        <p className="mt-1 text-[13px] text-[#9CA3AF]">
          Run both, either, or skip. Replay anytime from the <span className="text-[#6AD7A3]">?</span> in the header.
        </p>

        <div className="mt-5 space-y-2.5">
          {(Object.keys(TOURS) as TourId[]).map((id) => {
            const tour = TOURS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPick(id)}
                className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-4 py-3 text-left transition-colors hover:border-[#6AD7A3]/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{tour.label}</span>
                  <span className="text-[11px] font-mono text-[#9CA3AF]">{tour.duration}</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[#B8BFC8]">{tour.blurb}</p>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="mt-4 w-full text-center text-[12px] text-[#9CA3AF] transition-colors hover:text-white"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
