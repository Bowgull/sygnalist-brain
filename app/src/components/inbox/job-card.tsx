"use client";

import { useState, useRef } from "react";
import TierBadge from "@/components/ui/tier-badge";
import type { Database } from "@/types/database";

type InboxJob = Database["public"]["Tables"]["inbox_jobs"]["Row"];

interface JobCardProps {
  job: InboxJob;
  onPromote: (id: string) => void;
  onDismiss: (id: string) => void;
}

const tierBorderColor: Record<string, string> = {
  S: "#FAD76A",
  A: "#6AD7A3",
  B: "#38BDF8",
  C: "#9CA3AF",
  F: "#4B5563",
  X: "#DC2626",
};

export default function JobCard({ job, onPromote, onDismiss }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const threshold = 100;

  // Mobile-only swipe handlers
  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!swiping) return;
    setSwipeX(e.touches[0].clientX - startX.current);
  }

  function handleTouchEnd() {
    setSwiping(false);
    if (swipeX > threshold) {
      handlePromote();
    } else if (swipeX < -threshold) {
      onDismiss(job.id);
    }
    setSwipeX(0);
  }

  function handlePromote() {
    setPromoted(true);
    onPromote(job.id);
  }

  const borderColor = tierBorderColor[job.tier] ?? "#9CA3AF";
  const isTierS = job.tier === "S";

  const swipeBg =
    swipeX > 30
      ? "bg-[#6AD7A3]/10"
      : swipeX < -30
        ? "bg-[#DC2626]/10"
        : "";

  return (
    <div
      className={`group relative max-w-[960px] overflow-hidden rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-[1px] ${swipeBg} ${
        isTierS ? "shadow-[0_0_30px_rgba(250,215,106,0.08)]" : ""
      }`}
      style={{ borderTopWidth: "2px", borderTopColor: borderColor }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Tier S gold star indicator */}
      {isTierS && (
        <span className="absolute top-3 right-3 text-[#FAD76A] text-sm">&#9733;</span>
      )}

      {/* Mobile swipe indicators */}
      {swipeX > 30 && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6AD7A3] md:hidden">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      {swipeX < -30 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#DC2626] md:hidden">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      )}

      {/* Card content */}
      <div
        className="relative p-4 md:p-6"
        style={{ transform: swipeX ? `translateX(${swipeX * 0.3}px)` : undefined }}
      >
        {/* Header: title + company + tier */}
        <button
          type="button"
          className="w-full text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[1rem] md:text-[1.3125rem] font-bold leading-tight text-white">
                {job.title}
              </h3>
              <p className="mt-0.5 md:mt-1 text-[0.8125rem] md:text-[0.9375rem] text-[#B8BFC8]">
                {job.company}
              </p>
            </div>
            <TierBadge tier={job.tier} score={job.score} />
          </div>

          {/* Chips row */}
          <div className="mt-3 flex flex-wrap gap-2">
            {job.salary && (
              <span
                className={`inline-flex h-[26px] items-center rounded-full px-3 text-[0.6875rem] font-medium ${
                  job.salary_below_min
                    ? "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20"
                    : "bg-[rgba(0,245,212,0.08)] text-white border border-[rgba(0,245,212,0.2)]"
                }`}
              >
                {job.salary}
              </span>
            )}
            {job.location && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-[#2A3544] bg-[#151C24] px-3 text-[0.6875rem] text-[#B8BFC8]">
                {job.location}
              </span>
            )}
            {job.lane_label && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-[#6AD7A3]/20 bg-[#6AD7A3]/8 px-3 text-[0.6875rem] font-medium text-[#6AD7A3]">
                {job.lane_label}
              </span>
            )}
            {job.source && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-[#2A3544] bg-[#151C24] px-3 text-[0.6875rem] text-[#9CA3AF]">
                {job.source}
              </span>
            )}
          </div>
        </button>

        {/* Expanded: summary + why fit + actions */}
        {expanded && (
          <div className="mt-4 space-y-3 animate-slide-down">
            {/* Job summary */}
            {job.job_summary && (
              <p className="text-[0.9375rem] leading-relaxed text-[#B8BFC8] italic">
                {job.job_summary}
              </p>
            )}

            {/* Why it fits — expandable block with left accent border */}
            {job.why_fit && (
              <div className="rounded-lg border-l-[3px] border-l-[#2F8A63] bg-[#6AD7A3]/5 p-4">
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#6AD7A3]">
                  WHY IT FITS
                </p>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[#B8BFC8]">
                  {job.why_fit}
                </p>
              </div>
            )}

            {/* Action buttons — always visible on desktop, supplement swipe on mobile */}
            <div className="flex flex-wrap gap-2 pt-1">
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#2A3544] px-4 text-[0.8125rem] font-medium text-[#B8BFC8] transition-all hover:border-[#6AD7A3]/40 hover:text-white hover:-translate-y-px"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View Full
                </a>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePromote();
                }}
                disabled={promoted}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] px-4 text-[0.8125rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.1)] transition-all hover:shadow-[0_0_30px_rgba(106,215,163,0.2)] hover:-translate-y-px disabled:opacity-50"
              >
                {promoted ? (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    In Tracker
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add to Tracker
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(job.id);
                }}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#2A3544] px-4 text-[0.8125rem] font-medium text-[#9CA3AF] transition-all hover:border-[#DC2626]/40 hover:text-[#DC2626] hover:-translate-y-px"
              >
                Not Interested
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
