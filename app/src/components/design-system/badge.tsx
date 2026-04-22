import type { HTMLAttributes, ReactNode } from "react";

type BadgeTone = "neutral" | "accent" | "signal" | "ok" | "warn" | "err";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
}

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-[var(--ds-bg-2)] text-[var(--ds-text-1)] border-[var(--ds-border-2)]",
  accent: "bg-[var(--ds-accent-soft)] text-[var(--ds-accent-bright)] border-[rgba(132,191,160,0.25)]",
  signal: "bg-[var(--ds-signal-soft)] text-[var(--ds-signal)] border-[rgba(232,197,107,0.25)]",
  ok: "bg-[rgba(132,191,160,0.10)] text-[var(--ds-ok)] border-[rgba(132,191,160,0.25)]",
  warn: "bg-[rgba(232,197,107,0.10)] text-[var(--ds-warn)] border-[rgba(232,197,107,0.25)]",
  err: "bg-[rgba(212,105,92,0.10)] text-[var(--ds-err)] border-[rgba(212,105,92,0.25)]",
};

const dotColor: Record<BadgeTone, string> = {
  neutral: "bg-[var(--ds-text-2)]",
  accent: "bg-[var(--ds-accent)]",
  signal: "bg-[var(--ds-signal)]",
  ok: "bg-[var(--ds-ok)]",
  warn: "bg-[var(--ds-warn)]",
  err: "bg-[var(--ds-err)]",
};

export function Badge({ tone = "neutral", dot, icon, className = "", children, ...rest }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-[var(--ds-radius-full)] border px-2.5 py-[3px]",
        "text-[11px] font-medium font-[family-name:var(--font-ds-sans)]",
        toneClass[tone],
        className,
      ].join(" ")}
      {...rest}
    >
      {dot ? <span className={["h-1.5 w-1.5 rounded-full", dotColor[tone]].join(" ")} aria-hidden /> : null}
      {icon ? <span className="inline-flex shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}

export default Badge;
