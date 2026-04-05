"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const standardTabs = [
  { label: "INBOX", href: "/inbox" },
  { label: "TRACKER", href: "/tracker" },
  { label: "ADMIN", href: "/admin" },
];

export default function TopTabs({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewAsId = searchParams.get("view_as");

  // In view_as mode: show INBOX, TRACKER, MESSAGES (replace ADMIN)
  const viewAsTabs = viewAsId
    ? [
        { label: "INBOX", href: `/inbox?view_as=${viewAsId}` },
        { label: "TRACKER", href: `/tracker?view_as=${viewAsId}` },
        { label: "MESSAGES", href: `/messages?view_as=${viewAsId}` },
      ]
    : null;

  const tabs = viewAsTabs ?? (isAdmin ? standardTabs : standardTabs.filter((t) => t.href !== "/admin"));

  return (
    <div className="hidden md:block rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#151C24] p-[3px] mb-1">
      <div className="flex gap-[1px]">
        {tabs.map((tab) => {
          // For view_as tabs, match on the pathname portion
          const tabPath = tab.href.split("?")[0];
          const isActive = pathname.startsWith(tabPath);
          const isMessages = tab.label === "MESSAGES";
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex-1 min-h-[32px] flex items-center justify-center rounded-[var(--radius-md)] px-5 text-[0.875rem] font-semibold uppercase tracking-[0.04em] transition-all ${
                isActive
                  ? isMessages
                    ? "bg-[#171F28] text-[#F59E0B] border border-[rgba(245,158,11,0.2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border-b-2 border-b-[#B45309]"
                    : "bg-[#171F28] text-[#6AD7A3] border border-[rgba(106,215,163,0.2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border-b-2 border-b-[#2F8A63]"
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
