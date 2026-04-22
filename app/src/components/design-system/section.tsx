import type { HTMLAttributes, ReactNode } from "react";

interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}

export function Section({ title, description, actions, eyebrow, className = "", children, ...rest }: SectionProps) {
  return (
    <section
      className={[
        "font-[family-name:var(--font-ds-sans)] text-[var(--ds-text-1)]",
        "space-y-5",
        className,
      ].join(" ")}
      {...rest}
    >
      {(title || description || actions || eyebrow) && (
        <div className="flex items-end justify-between gap-4 border-b border-[var(--ds-border-1)] pb-4">
          <div className="min-w-0 flex-1 space-y-1">
            {eyebrow ? (
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ds-text-3)] font-[family-name:var(--font-ds-mono)]">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="text-[20px] font-semibold text-[var(--ds-text-0)] leading-tight tracking-[-0.01em]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-[13px] text-[var(--ds-text-2)] leading-relaxed max-w-[60ch]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export default Section;
