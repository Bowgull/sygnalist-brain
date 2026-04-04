"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Health", href: "/admin" },
  { label: "Clients", href: "/admin/clients" },
  { label: "Job Bank", href: "/admin/job-bank" },
  { label: "Lanes", href: "/admin/lanes" },
  { label: "Ingest", href: "/admin/ingest" },
  { label: "Onboard", href: "/admin/onboard" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Logs", href: "/admin/logs" },
  { label: "Messages", href: "/admin/messages" },
];

export default function AdminSubTabs() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-10 border-b border-[#2A3544] bg-[#151C24] px-4 py-2">
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.04em] transition-colors ${
                isActive
                  ? "bg-[#171F28] text-[#FAD76A] border border-[#FAD76A]/20"
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
