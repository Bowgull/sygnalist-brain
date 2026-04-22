"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Max width in px for the dialog on desktop. Default 520. */
  maxWidth?: number;
}

export default function Dialog({ open, onClose, title, description, children, footer, maxWidth = 520 }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] font-[family-name:var(--font-ds-sans)]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(5,6,10,0.72)] backdrop-blur-[2px] animate-ds-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          tabIndex={-1}
          style={{ maxWidth }}
          className="w-full max-h-[85vh] overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-1)] shadow-[var(--ds-shadow-elevate)] animate-ds-dialog-enter outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {(title || description) && (
            <div className="px-5 pt-5 pb-3 border-b border-[var(--ds-border-1)]">
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

          <div className="px-5 py-4 overflow-y-auto max-h-[60vh] text-[14px] text-[var(--ds-text-1)]">
            {children}
          </div>

          {footer ? (
            <div className="px-5 py-4 border-t border-[var(--ds-border-1)] bg-[var(--ds-bg-0)]/40 flex items-center justify-end gap-2">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
