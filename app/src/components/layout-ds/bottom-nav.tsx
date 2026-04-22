"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Radar, Target, AlignJustify, LayoutGrid, MessageSquare } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>;
}

const clientItems: NavItem[] = [
  { label: "Inbox", href: "/inbox", icon: Radar },
  { label: "Tracker", href: "/tracker", icon: Target },
];

const adminItems: NavItem[] = [
  ...clientItems,
  { label: "Logs", href: "/admin/logs", icon: AlignJustify },
  { label: "Admin", href: "/admin", icon: LayoutGrid },
];

export default function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewAsId = searchParams.get("view_as");

  const viewAsItems: NavItem[] | null = viewAsId
    ? [
        { label: "Inbox", href: `/inbox?view_as=${viewAsId}`, icon: Radar },
        { label: "Tracker", href: `/tracker?view_as=${viewAsId}`, icon: Target },
        { label: "Messages", href: `/messages?view_as=${viewAsId}`, icon: MessageSquare },
      ]
    : null;

  const items: NavItem[] = viewAsItems ?? (isAdmin ? adminItems : clientItems);
  const accentColor = viewAsId ? "var(--ds-signal)" : "var(--ds-accent)";

  return (
    <nav
      aria-label="Primary"
      className={[
        "md:hidden fixed bottom-0 left-0 right-0 z-40",
        "font-[family-name:var(--font-ds-sans)]",
        "border-t border-[var(--ds-border-1)] bg-[var(--ds-bg-0)]/92 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const itemPath = item.href.split("?")[0];
          const isActive =
            itemPath === "/admin"
              ? pathname === "/admin" || (pathname.startsWith("/admin/") && !pathname.startsWith("/admin/logs"))
              : pathname.startsWith(itemPath);
          const isMessages = item.label === "Messages";
          const activeColor = isMessages || viewAsId ? "var(--ds-signal)" : accentColor;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-1 py-2 px-3 min-h-[52px] text-[11px] font-medium transition-colors"
              style={{ color: isActive ? activeColor : "var(--ds-text-2)" }}
            >
              <Icon size={20} strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
