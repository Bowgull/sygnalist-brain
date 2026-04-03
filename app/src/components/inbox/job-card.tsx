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

export default function JobCard({ job, onPromote, onDismiss }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const threshold = 100;

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!swiping) return;
    const diff = e.touches[0].clientX - startX.current;
    setSwipeX(diff);
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

  const swipeBg =
    swipeX > 30
      ? "bg-[#6AD7A3]/20"
      : swipeX < -30
        ? "bg-[#DC2626]/20"
        : "";

  return (
    <div
      className={`glass-card relative overflow-hidden transition-all ${swipeBg}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe indicators */}
      {swipeX > 30 && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6AD7A3]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      {swipeX < -30 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#DC2626]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      )}

      {/* Card content */}
      <div
        className="relative p-4"
        style={{ transform: `translateX(${swipeX * 0.3}px)` }}
      >
        {/* Collapsed: title + company + tier + salary */}
        <button
          type="button"
          className="w-full text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold leading-tight text-white">
                {job.title}
              </h3>
              <p className="mt-0.5 truncate text-[13px] text-[#B8BFC8]">
                {job.company}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <TierBadge tier={job.tier} score={job.score} />
            </div>
          </div>

          {/* Chips row */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.salary && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${
                  job.salary_below_min
                    ? "bg-[#DC2626]/10 text-[#DC2626] ring-[#DC2626]/30"
                    : "bg-[#151C24] text-[#B8BFC8] ring-[#2A3544]"
                }`}
              >
                {job.salary}
              </span>
            )}
            {job.location && (
              <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#B8BFC8] ring-1 ring-[#2A3544]">
                {job.location}
              </span>
            )}
            {job.lane_label && (
              <span className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[11px] text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30">
                {job.lane_label}
              </span>
            )}
            {job.source && (
              <span className="rounded-full bg-[#151C24] px-2 py-0.5 text-[11px] text-[#9CA3AF] ring-1 ring-[#2A3544]">
                {job.source}
              </span>
            )}
          </div>
        </button>

        {/* Expanded: summary + actions */}
        {expanded && (
          <div className="mt-3 border-t border-[#2A3544] pt-3">
            {job.job_summary && (
              <p className="text-[13px] leading-relaxed text-[#B8BFC8]">
                {job.job_summary}
              </p>
            )}
            {job.why_fit && (
              <div className="mt-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#6AD7A3]">
                  Why it fits
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#B8BFC8]">
                  {job.why_fit}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-3 flex gap-2">
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-[#2A3544] px-3 py-1.5 text-[12px] font-medium text-[#B8BFC8] transition-colors hover:border-[#6AD7A3]/50 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View
                </a>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePromote();
                }}
                disabled={promoted}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-3 py-1.5 text-[12px] font-semibold text-[#0C1016] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  {promoted ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <>
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </>
                  )}
                </svg>
                {promoted ? "In Tracker" : "Add to Tracker"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(job.id);
                }}
                className="flex items-center gap-1.5 rounded-full border border-[#2A3544] px-3 py-1.5 text-[12px] font-medium text-[#9CA3AF] transition-colors hover:border-[#DC2626]/50 hover:text-[#DC2626]"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
