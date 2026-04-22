"use client";

import { useState } from "react";
import { ExternalLink, Plus, Check, X, ChevronDown } from "lucide-react";
import { Badge, Button, Card, StatusPill as _unused, Tag } from "@/components/design-system";
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
    onPromote(job.id);
  }

  const tone = tierTone(job.tier);
  const isTierS = job.tier === "S";

  return (
    <Card
      className={[
        "relative",
        // S-tier rare emphasis: faint signal-gold top seam
        isTierS ? "before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--ds-signal)] before:opacity-60" : "",
      ].join(" ")}
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
            <Badge tone={tone} dot>
              {job.tier}
              {typeof job.score === "number" ? (
                <span className="ml-1 font-[family-name:var(--font-ds-mono)] text-[10px] opacity-80">
                  {job.score}
                </span>
              ) : null}
            </Badge>
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
