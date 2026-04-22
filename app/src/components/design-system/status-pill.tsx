import type { HTMLAttributes } from "react";

type StatusTone = "prospect" | "applied" | "interview" | "final" | "offer" | "rejected" | "ghosted" | "withdrawn";

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusTone;
  label?: string;
}

const toneColor: Record<StatusTone, { fg: string; bg: string; border: string; label: string }> = {
  prospect: { fg: "#A3E4CE", bg: "rgba(29,211,176,0.10)", border: "rgba(29,211,176,0.28)", label: "Prospect" },
  applied: { fg: "#8DB1FF", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.28)", label: "Applied" },
  interview: { fg: "#C9B1FF", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.28)", label: "Interview" },
  final: { fg: "#FAC97A", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)", label: "Final" },
  offer: { fg: "#9AE2B4", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.28)", label: "Offer" },
  rejected: { fg: "#E89187", bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.22)", label: "Rejected" },
  ghosted: { fg: "var(--ds-text-2)", bg: "var(--ds-bg-2)", border: "var(--ds-border-2)", label: "Ghosted" },
  withdrawn: { fg: "var(--ds-text-2)", bg: "var(--ds-bg-2)", border: "var(--ds-border-2)", label: "Withdrawn" },
};

export default function StatusPill({ status, label, className = "", ...rest }: StatusPillProps) {
  const tone = toneColor[status];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-[var(--ds-radius-full)] border px-2.5 py-[3px]",
        "text-[11px] font-medium font-[family-name:var(--font-ds-sans)] uppercase tracking-[0.06em]",
        className,
      ].join(" ")}
      style={{ color: tone.fg, backgroundColor: tone.bg, borderColor: tone.border }}
      {...rest}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.fg }} aria-hidden />
      {label ?? tone.label}
    </span>
  );
}
