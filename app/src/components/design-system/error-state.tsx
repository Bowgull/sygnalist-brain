import type { ReactNode } from "react";
import Button from "./button";

interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  retry?: () => void;
}

export default function ErrorState({
  title = "Something went wrong",
  description = "We couldn't complete that. Try again, or come back in a minute.",
  retry,
}: ErrorStateProps) {
  return (
    <div className="font-[family-name:var(--font-ds-sans)] flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--ds-radius-lg)] bg-[rgba(212,105,92,0.08)] border border-[rgba(212,105,92,0.22)] text-[var(--ds-err)]">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 2 L18 17 L2 17 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 8 V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="14.5" r="0.9" fill="currentColor" />
        </svg>
      </div>
      <h3 className="text-[16px] font-semibold text-[var(--ds-text-0)] leading-tight">{title}</h3>
      <p className="mt-1.5 max-w-[40ch] text-[13px] text-[var(--ds-text-2)] leading-relaxed">{description}</p>
      {retry ? (
        <Button variant="secondary" size="md" className="mt-5" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
