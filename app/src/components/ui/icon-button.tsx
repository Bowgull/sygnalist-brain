"use client";

import type { LucideIcon } from "lucide-react";

type Variant = "view" | "operate" | "navigate" | "destructive";
type Size = "sm" | "md";

const variantStyles: Record<Variant, string> = {
  view: "text-[#9CA3AF] hover:bg-[#6AD7A3]/10 hover:text-[#6AD7A3]",
  operate: "text-[#9CA3AF] hover:bg-[#6AD7A3]/10 hover:text-[#6AD7A3]",
  navigate: "text-[#9CA3AF] hover:bg-[#171F28] hover:text-[#B8BFC8]",
  destructive: "text-[#6B7280] hover:bg-[#DC2626]/10 hover:text-[#DC2626]",
};

const sizeStyles: Record<Size, { padding: string; iconSize: number }> = {
  sm: { padding: "p-2.5", iconSize: 14 },
  md: { padding: "p-2.5", iconSize: 16 },
};

interface IconButtonProps {
  icon: LucideIcon;
  variant?: Variant;
  size?: Size;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title: string;
  className?: string;
}

export function IconButton({
  icon: Icon,
  variant = "view",
  size = "md",
  onClick,
  disabled,
  title,
  className = "",
}: IconButtonProps) {
  const { padding, iconSize } = sizeStyles[size];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-full ${padding} transition-all hover:-translate-y-px active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${variantStyles[variant]} ${className}`}
    >
      <Icon size={iconSize} strokeWidth={2} />
    </button>
  );
}
