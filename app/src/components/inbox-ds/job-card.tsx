"use client";

import { useState } from "react";
import { ExternalLink, Plus, Check, X, ChevronDown, Star } from "lucide-react";
import { Badge, Button, Card, Tag } from "@/components/design-system";
import type { Database } from "@/types/database";

type InboxJob = Database["public"]["Tables"]["inbox_jobs"]["Row"];

interface JobCardProps {
  job: InboxJob;
  onPromote: (id: string) => void;
  onDismiss: (id: string) => void;
}

/**
 * Tier → DS mapping. Signal gold is reserved for S (rare emphasis).
 * A gets the accent, B/C stay neutral, F/X tip into warning tones.
 */
function tierTone(tier: string): "signal" | "accent" | "neutral" | "warn" | "err" {
  switch (tier) {
    case "S":
      return "signal";
    case "A":
      return "accent";
    case "B":
    case "C":
      return "neutral";
    case "F":
      return "warn";
    case "X":
      return "err";
    default:
      return "neutral";
  }
}

export default function JobCard({ job, onPromote, onDismiss }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [promoted, setPromoted] = useState(false);

  function handlePromote(e: React.MouseEvent) {
    e.stopPropagation();
    setPromoted(true);
    // Let the lift animation play before the list removes the card.
    setTimeout(() => onPromote(job.id), 280);
  }

  const tone = tierTone(job.tier);
  const isTierS = job.tier === "S";

  return (
    <Card
      className={[
        "relative overflow-hidden",
        // S-tier: gold top seam + subtle one-shot pulse on first render
        isTierS ? "ring-1 ring-[rgba(232,197,107,0.22)] animate-ds-stier-reveal" : "",
        // Promote lift: card gently rises and fades before being removed
        promoted ? "animate-ds-promote-lift" : "",
      ].join(" ")}
      style={
        isTierS
          ? {
              borderTop: "1px solid var(--ds-signal)",
              boxShadow: "var(--ds-shadow-raise), 0 0 24px -10px var(--ds-signal-glow)",
            }
          : undefined
      }
    >
      <div className="p-5">
        {/* Row 1: title + tier */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] md:text-[18px] font-semibold text-[var(--ds-text-0)] leading-snug tracking-[-0.01em]">
              {job.title}
            </h3>
            <p className="mt-1 text-[13px] text-[var(--ds-text-2)]">
              {job.company}
              {job.location ? <span className="text-[var(--ds-text-3)]"> · {job.location}</span> : null}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {isTierS ? (
              <span
                className="inline-flex items-center gap-1 rounded-[var(--ds-radius-full)] border border-[rgba(232,197,107,0.45)] bg-[var(--ds-signal-soft)] px-2.5 py-[3px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ds-signal)]"
                title="S-tier fit — worth a close look"
              >
                <Star size={11} strokeWidth={2} fill="currentColor" />
                S-tier
                {typeof job.score === "number" ? (
                  <span className="ml-1 font-[family-name:var(--font-ds-mono)] text-[10px] opacity-80">
                    {job.score}
                  </span>
                ) : null}
              </span>
            ) : (
              <Badge tone={tone} dot>
                {job.tier}
                {typeof job.score === "number" ? (
                  <span className="ml-1 font-[family-name:var(--font-ds-mono)] text-[10px] opacity-80">
                    {job.score}
                  </span>
                ) : null}
              </Badge>
            )}
          </div>
        </div>

        {/* Row 2: metadata tags (mono for values) */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {job.salary ? (
            <Tag
              className={
                job.salary_below_min
                  ? "text-[var(--ds-err)] border-[rgba(212,105,92,0.30)] bg-[rgba(212,105,92,0.08)]"
                  : ""
              }
            >
              {job.salary}
            </Tag>
          ) : null}
          {job.lane_label ? <Tag>{job.lane_label}</Tag> : null}
          {job.source && job.source !== "manual" ? <Tag>{job.source}</Tag> : null}
        </div>

        {/* Row 3: summary (expandable). If summary exists, whole card toggles on tap. */}
        {job.job_summary ? (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={[
                "mt-3 inline-flex items-center gap-1 text-[12px] text-[var(--ds-text-2)]",
                "hover:text-[var(--ds-text-0)] transition-colors",
                "font-[family-name:var(--font-ds-mono)] uppercase tracking-[0.08em]",
              ].join(" ")}
            >
              {expanded ? "Hide summary" : "Read summary"}
              <ChevronDown
                size={12}
                strokeWidth={2}
                className={["transition-transform", expanded ? "rotate-180" : ""].join(" ")}
              />
            </button>
            {expanded ? (
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--ds-text-1)] max-w-[70ch]">
                {job.job_summary}
              </p>
            ) : null}
          </>
        ) : null}

        {/* Row 4: actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant={promoted ? "secondary" : "primary"}
            size="sm"
            onClick={handlePromote}
            disabled={promoted}
            icon={promoted ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2} />}
          >
            {promoted ? "In Tracker" : "Promote to Tracker"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(job.id);
            }}
            icon={<X size={14} strokeWidth={2} />}
          >
            Dismiss
          </Button>
          {job.url ? (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={[
                "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-[var(--ds-radius-md)]",
                "text-[13px] font-medium text-[var(--ds-text-2)]",
                "hover:text-[var(--ds-text-0)] hover:bg-[var(--ds-bg-2)] transition-colors",
                "ml-auto",
              ].join(" ")}
            >
              View listing
              <ExternalLink size={12} strokeWidth={2} />
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
