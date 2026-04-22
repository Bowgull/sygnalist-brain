import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}

export default function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="font-[family-name:var(--font-ds-sans)] px-4 md:px-8 py-6 md:py-8 border-b border-[var(--ds-border-1)]">
      <div className="max-w-[1280px] mx-auto flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          {eyebrow ? (
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ds-text-3)] font-[family-name:var(--font-ds-mono)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[26px] md:text-[32px] font-semibold text-[var(--ds-text-0)] leading-[1.1] tracking-[-0.02em]">
            {title}
          </h1>
          {description ? (
            <p className="text-[14px] md:text-[15px] text-[var(--ds-text-2)] leading-relaxed max-w-[60ch]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
