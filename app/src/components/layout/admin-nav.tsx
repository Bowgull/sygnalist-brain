"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Health", href: "/admin" },
  { label: "Clients", href: "/admin/clients" },
  { label: "Job Bank", href: "/admin/job-bank" },
  { label: "Lanes", href: "/admin/lanes" },
  { label: "Ingest", href: "/admin/ingest" },
  { label: "Review", href: "/admin/review" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Logs", href: "/admin/logs" },
  { label: "Messages", href: "/admin/messages" },
];

export default function AdminNav({ displayName }: { displayName?: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-[#0C1016]/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0B1512] to-[#0F2A23] ring-1 ring-[#6AD7A3]/20">
            <svg viewBox="0 0 64 64" className="h-5 w-5">
              <circle cx="32" cy="32" r="17" fill="none" stroke="url(#aGrad)" strokeWidth="3.8" opacity="0.95" />
              <path d="M32 32 L49 22" stroke="url(#aGrad)" strokeWidth="3" strokeLinecap="round" opacity="0.80" />
              <circle cx="49" cy="22" r="2.7" fill="#A9FFB5" opacity="0.95" />
              <circle cx="32" cy="32" r="4.4" fill="url(#aGrad)" />
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#A9FFB5" />
                  <stop offset="0.55" stopColor="#5EF2C7" />
                  <stop offset="1" stopColor="#39D6FF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <span className="text-sm font-extrabold tracking-wider">ADMIN</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/inbox"
            className="rounded-full border border-[#2A3544] px-3 py-1 text-[11px] font-medium text-[#9CA3AF] hover:border-[#6AD7A3]/50 hover:text-white"
          >
            Back to App
          </Link>
          {displayName && (
            <span className="text-xs text-[#B8BFC8]">{displayName}</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto px-4 pb-2 scrollbar-none">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                isActive
                  ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                  : "text-[#9CA3AF] hover:text-[#B8BFC8]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#00ffc3]/40 to-transparent" />
    </header>
  );
}
