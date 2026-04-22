"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface Tab {
  label: string;
  href: string;
}

const standardTabs: Tab[] = [
  { label: "Inbox", href: "/inbox" },
  { label: "Tracker", href: "/tracker" },
  { label: "Admin", href: "/admin" },
];

export default function TopTabs({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewAsId = searchParams.get("view_as");

  const viewAsTabs: Tab[] | null = viewAsId
    ? [
        { label: "Inbox", href: `/inbox?view_as=${viewAsId}` },
        { label: "Tracker", href: `/tracker?view_as=${viewAsId}` },
        { label: "Messages", href: `/messages?view_as=${viewAsId}` },
      ]
    : null;

  const tabs: Tab[] = viewAsTabs ?? (isAdmin ? standardTabs : standardTabs.filter((t) => t.href !== "/admin"));

  return (
    <nav
      aria-label="Primary"
      className="hidden md:block font-[family-name:var(--font-ds-sans)] border-b border-[var(--ds-border-1)] mb-5"
    >
      <div className="flex items-center gap-1">
        {tabs.map((tab) => {
          const tabPath = tab.href.split("?")[0];
          const isActive = pathname.startsWith(tabPath);
          const isMessages = tab.label === "Messages";
          const accent = isMessages || viewAsId ? "var(--ds-signal)" : "var(--ds-accent)";
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={[
                "relative inline-flex items-center h-10 px-3 text-[13px] font-medium",
                "transition-colors duration-[var(--ds-duration-fast)]",
                isActive
                  ? "text-[var(--ds-text-0)]"
                  : "text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)]",
              ].join(" ")}
              style={isActive ? { color: accent } : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
              {isActive ? (
                <span
                  className="absolute inset-x-0 -bottom-px h-[2px] rounded-t-[2px]"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
