"use client";

import type { LucideIcon } from "lucide-react";

type Variant = "view" | "operate" | "navigate" | "destructive" | "ai";

const variantStyles: Record<Variant, string> = {
  view: "border-[#2A3544] text-[#B8BFC8] hover:border-[#6AD7A3]/40 hover:text-white",
  operate:
    "border-[#6AD7A3]/30 text-[#6AD7A3] hover:bg-[#6AD7A3]/10",
  navigate:
    "border-[#2A3544] text-[#9CA3AF] hover:text-[#B8BFC8] hover:border-[#9CA3AF]/30",
  destructive:
    "border-[#DC2626]/25 text-[#DC2626] hover:bg-[#DC2626]/10",
  ai: "border-[#C4CDD8]/15 bg-[rgba(196,205,216,0.04)] text-white ring-1 ring-[#C4CDD8]/10 hover:bg-[rgba(196,205,216,0.06)] hover:ring-[#C4CDD8]/20 font-semibold",
};

interface ActionButtonProps {
  icon: LucideIcon;
  label?: string;
  variant?: Variant;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: "button" | "submit";
}

export function ActionButton({
  icon: Icon,
  label,
  variant = "view",
  onClick,
  disabled,
  className = "",
  title,
  type = "button",
}: ActionButtonProps) {
  const base =
    "inline-flex h-[32px] items-center gap-1.5 rounded-full border px-3.5 text-[0.75rem] font-medium transition-all hover:-translate-y-px active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`${base} ${variantStyles[variant]} ${className}`}
    >
      <Icon size={16} strokeWidth={2} />
      {label && <span>{label}</span>}
    </button>
  );
}
