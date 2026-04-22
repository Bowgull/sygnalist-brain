"use client";

interface RadarMarkProps {
  size?: number;
  active?: boolean;
  /** CSS color. Defaults to currentColor. */
  color?: string;
  className?: string;
}

/**
 * Sygnalist's radar iconography — concentric rings + a sweep line.
 * When `active`, the sweep line rotates (used during Scan). Otherwise static.
 * This is the operator-grade answer to "generic spinner."
 */
export default function RadarMark({ size = 14, active = false, color = "currentColor", className = "" }: RadarMarkProps) {
  return (
    <span
      className={["relative inline-flex items-center justify-center", className].join(" ")}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Static rings + center */}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="absolute inset-0">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1" opacity="0.22" />
        <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="1.1" opacity="0.5" />
        <circle cx="12" cy="12" r="1.8" fill={color} />
      </svg>
      {/* Sweep line — rotates when active */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={["absolute inset-0", active ? "animate-ds-radar-sweep" : ""].join(" ")}
      >
        <path d="M12 12 L18.5 7.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
        <circle cx="18.5" cy="7.5" r="1.3" fill={color} />
      </svg>
    </span>
  );
}
