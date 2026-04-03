"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "Inbox",
    href: "/inbox",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" opacity={0.4} />
        <path d="M12 12L18 8" strokeLinecap="round" />
        <circle cx="18" cy="8" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Tracker",
    href: "/tracker",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/profile",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="9" r="4" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const items = isAdmin
    ? [
        ...navItems,
        {
          label: "Admin",
          href: "/admin",
          icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          ),
        },
      ]
    : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#2A3544] bg-[#0C1016]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
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
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
