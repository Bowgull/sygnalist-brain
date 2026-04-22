"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--ds-accent)] text-[#0F1115] border border-[var(--ds-accent)] hover:bg-[var(--ds-accent-bright)] hover:border-[var(--ds-accent-bright)]",
  secondary:
    "bg-[var(--ds-bg-2)] text-[var(--ds-text-0)] border border-[var(--ds-border-2)] hover:bg-[var(--ds-bg-3)] hover:border-[var(--ds-border-3)]",
  ghost:
    "bg-transparent text-[var(--ds-text-1)] border border-transparent hover:bg-[var(--ds-bg-2)] hover:text-[var(--ds-text-0)]",
  destructive:
    "bg-transparent text-[var(--ds-err)] border border-[var(--ds-border-2)] hover:bg-[rgba(212,105,92,0.08)] hover:border-[rgba(212,105,92,0.40)]",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconPosition = "left", children, className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        "inline-flex items-center justify-center rounded-[var(--ds-radius-md)] font-medium",
        "font-[family-name:var(--font-ds-sans)]",
        "transition-colors duration-[var(--ds-duration-fast)] ease-[var(--ds-ease)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-bg-0)]",
        "disabled:opacity-40 disabled:pointer-events-none",
        sizeClass[size],
        variantClass[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {icon && iconPosition === "left" ? <span className="shrink-0 inline-flex">{icon}</span> : null}
      {children}
      {icon && iconPosition === "right" ? <span className="shrink-0 inline-flex">{icon}</span> : null}
    </button>
  );
});

export default Button;
