"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "Inbox",
    href: "/inbox",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" opacity={0.4} />
        <path d="M12 12L18 8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Tracker",
    href: "/tracker",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/profile",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function DesktopSidebar({
  isAdmin,
  displayName,
}: {
  isAdmin: boolean;
  displayName?: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-[#2A3544]/50 lg:block">
      <nav className="sticky top-[57px] flex flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                isActive
                  ? "bg-[#6AD7A3]/10 text-[#6AD7A3] shadow-[inset_0_1px_0_rgba(106,215,163,0.1)]"
                  : "text-[#9CA3AF] hover:bg-[#171F28] hover:text-white"
              }`}
            >
              <span className={`transition-colors ${isActive ? "text-[#6AD7A3]" : "text-[#6B7280] group-hover:text-white"}`}>
                {item.icon}
              </span>
              {item.label}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#6AD7A3]" />
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="mx-3 my-2 h-px bg-[#2A3544]/50" />
            <Link
              href="/admin"
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                pathname.startsWith("/admin")
                  ? "bg-[#FAD76A]/10 text-[#FAD76A]"
                  : "text-[#9CA3AF] hover:bg-[#171F28] hover:text-white"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
              Admin
            </Link>
          </>
        )}

        {/* User info at bottom */}
        {displayName && (
          <div className="mt-auto pt-6">
            <div className="flex items-center gap-2.5 rounded-xl bg-[#171F28]/50 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#A9FFB5]/15 to-[#39D6FF]/15 text-xs font-bold text-[#6AD7A3]">
                {displayName[0]?.toUpperCase()}
              </div>
              <span className="text-[12px] font-medium text-[#B8BFC8]">{displayName}</span>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
