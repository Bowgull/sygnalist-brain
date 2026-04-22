import type { ReactNode } from "react";
import Button from "./button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, primaryAction, secondaryAction }: EmptyStateProps) {
  return (
    <div className="font-[family-name:var(--font-ds-sans)] flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon ? (
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[var(--ds-radius-lg)] bg-[var(--ds-bg-2)] border border-[var(--ds-border-1)] text-[var(--ds-text-2)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-[17px] font-semibold text-[var(--ds-text-0)] leading-tight">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-[40ch] text-[13px] text-[var(--ds-text-2)] leading-relaxed">{description}</p>
      ) : null}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex items-center gap-2">
          {primaryAction ? (
            <Button variant="primary" size="md" icon={primaryAction.icon} onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button variant="ghost" size="md" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
