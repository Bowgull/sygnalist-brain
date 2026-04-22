import type { ReactNode } from "react";

interface LoadingStateProps {
  label?: ReactNode;
  lines?: number;
}

/**
 * Calm skeleton loader. Three stacked lines by default, each a shimmering
 * rectangle at varying widths. No spinner — spinners signal "something's
 * wrong," skeletons signal "something's coming."
 */
export function LoadingState({ label, lines = 3 }: LoadingStateProps) {
  return (
    <div className="font-[family-name:var(--font-ds-sans)] space-y-3" aria-live="polite" aria-busy="true">
      {label ? (
        <p className="text-[12px] text-[var(--ds-text-3)] font-[family-name:var(--font-ds-mono)] uppercase tracking-[0.12em]">
          {label}
        </p>
      ) : null}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} widthPct={[100, 86, 70][i % 3]} />
      ))}
    </div>
  );
}

interface SkeletonProps {
  widthPct?: number;
  height?: number;
}

export function Skeleton({ widthPct = 100, height = 14 }: SkeletonProps) {
  return (
    <div
      className="animate-ds-shimmer rounded-[var(--ds-radius-sm)]"
      style={{ width: `${widthPct}%`, height }}
    />
  );
}

export default LoadingState;
