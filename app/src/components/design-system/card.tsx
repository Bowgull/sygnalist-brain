import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  elevated?: boolean;
}

export function Card({ interactive = false, elevated = false, className = "", children, ...rest }: CardProps) {
  return (
    <div
      className={[
        "rounded-[var(--ds-radius-lg)] border bg-[var(--ds-bg-1)] border-[var(--ds-border-1)]",
        "font-[family-name:var(--font-ds-sans)] text-[var(--ds-text-1)]",
        elevated ? "shadow-[var(--ds-shadow-elevate)]" : "shadow-[var(--ds-shadow-raise)]",
        interactive
          ? "transition-colors duration-[var(--ds-duration-base)] ease-[var(--ds-ease)] hover:bg-[var(--ds-bg-2)] hover:border-[var(--ds-border-2)] cursor-pointer"
          : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function CardBody({ padded = true, className = "", children, ...rest }: CardBodyProps) {
  return (
    <div className={[padded ? "p-5" : "", className].join(" ")} {...rest}>
      {children}
    </div>
  );
}

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function CardHeader({ title, description, actions, className = "", ...rest }: CardHeaderProps) {
  return (
    <div className={["flex items-start justify-between gap-4 p-5 pb-0", className].join(" ")} {...rest}>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-[var(--ds-text-0)] leading-tight">{title}</h3>
        {description ? (
          <p className="mt-1 text-[13px] text-[var(--ds-text-2)] leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export default Card;
