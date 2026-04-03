"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "INBOX", href: "/inbox" },
  { label: "TRACKER", href: "/tracker" },
  { label: "PROFILE", href: "/profile" },
  { label: "ADMIN", href: "/admin" },
];

export default function TopTabs({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const visibleTabs = isAdmin ? tabs : tabs.filter((t) => t.href !== "/admin");

  return (
    <div className="hidden md:block rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#151C24] p-[3px] mb-1">
      <div className="flex gap-[1px]">
        {visibleTabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 min-h-[32px] flex items-center justify-center rounded-[var(--radius-md)] px-5 text-[0.875rem] font-semibold uppercase tracking-[0.04em] transition-all ${
                isActive
                  ? "bg-[#171F28] text-[#6AD7A3] border border-[rgba(106,215,163,0.2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border-b-2 border-b-[#2F8A63]"
                  : "text-[#9CA3AF] hover:text-[#B8BFC8] border border-transparent"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
