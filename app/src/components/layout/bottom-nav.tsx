"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, Target, AlignJustify, LayoutGrid } from "lucide-react";

const clientItems = [
  { label: "Inbox", href: "/inbox", icon: Radar },
  { label: "Tracker", href: "/tracker", icon: Target },
];

const adminItems = [
  ...clientItems,
  { label: "Logs", href: "/admin/logs", icon: AlignJustify },
  { label: "Admin", href: "/admin", icon: LayoutGrid },
];

export default function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const items = isAdmin ? adminItems : clientItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[#2A3544] bg-[#0C1016]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin" || (pathname.startsWith("/admin/") && !pathname.startsWith("/admin/logs"))
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors ${
                isActive
                  ? "text-[#6AD7A3]"
                  : "text-[#9CA3AF] hover:text-[#B8BFC8]"
              }`}
            >
              <Icon size={20} strokeWidth={2} />
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
