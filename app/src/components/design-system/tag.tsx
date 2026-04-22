import type { HTMLAttributes, ReactNode } from "react";

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: ReactNode;
  onRemove?: () => void;
}

export function Tag({ icon, onRemove, className = "", children, ...rest }: TagProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-[var(--ds-radius-sm)] border px-2 py-1",
        "text-[12px] font-[family-name:var(--font-ds-mono)] text-[var(--ds-text-1)]",
        "bg-[var(--ds-bg-2)] border-[var(--ds-border-1)]",
        className,
      ].join(" ")}
      {...rest}
    >
      {icon ? <span className="inline-flex shrink-0 text-[var(--ds-text-2)]">{icon}</span> : null}
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-3)] hover:text-[var(--ds-text-0)] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}

export default Tag;
