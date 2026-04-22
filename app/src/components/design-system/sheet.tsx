"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Desktop placement. "right" slides from the right edge (default).
   * "bottom" slides from the bottom. On mobile, always slides from bottom.
   */
  placement?: "right" | "bottom";
}

export default function Sheet({ open, onClose, title, description, children, footer, placement = "right" }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // On mobile (<768px), always slide from bottom regardless of placement prop.
  const mobileClasses = "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:rounded-b-none max-md:animate-ds-sheet-up max-md:max-h-[88vh]";
  const desktopClasses =
    placement === "right"
      ? "md:top-0 md:right-0 md:bottom-0 md:w-[420px] md:rounded-none md:rounded-l-[var(--ds-radius-lg)] md:animate-ds-sheet-right"
      : "md:inset-x-0 md:bottom-0 md:rounded-b-none md:animate-ds-sheet-up md:max-h-[75vh]";

  return (
    <div className="fixed inset-0 z-[60] font-[family-name:var(--font-ds-sans)]" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-[rgba(5,6,10,0.72)] backdrop-blur-[2px] animate-ds-fade-in"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={[
          "absolute overflow-hidden border border-[var(--ds-border-2)] bg-[var(--ds-bg-1)]",
          "shadow-[var(--ds-shadow-elevate)] outline-none rounded-t-[var(--ds-radius-lg)]",
          "flex flex-col",
          mobileClasses,
          desktopClasses,
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[var(--ds-border-3)]" />
        </div>

        {(title || description) && (
          <div className="px-5 pt-4 md:pt-5 pb-3 border-b border-[var(--ds-border-1)]">
            {title ? (
              <h3 className="text-[17px] font-semibold text-[var(--ds-text-0)] leading-tight tracking-[-0.01em]">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="mt-1.5 text-[13px] text-[var(--ds-text-2)] leading-relaxed">{description}</p>
            ) : null}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 text-[14px] text-[var(--ds-text-1)]">
          {children}
        </div>

        {footer ? (
          <div className="px-5 py-4 border-t border-[var(--ds-border-1)] bg-[var(--ds-bg-0)]/40 flex items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
