"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Ops", href: "/admin" },
  { label: "Clients", href: "/admin/clients" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Ingest", href: "/admin/ingest" },
  { label: "Job Bank", href: "/admin/job-bank" },
  { label: "Lanes", href: "/admin/lanes" },
  { label: "Logs", href: "/admin/logs" },
];

export default function AdminSubTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="sticky top-0 z-10 border-b border-[var(--ds-border-1)] bg-[var(--ds-bg-1)] px-4 md:px-6 font-[family-name:var(--font-ds-sans)]"
    >
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative whitespace-nowrap inline-flex items-center h-10 px-3 text-[13px] font-medium",
                "transition-colors duration-[var(--ds-duration-fast)]",
                isActive
                  ? "text-[var(--ds-signal)]"
                  : "text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)]",
              ].join(" ")}
            >
              {tab.label}
              {isActive ? (
                <span
                  className="absolute inset-x-0 -bottom-px h-[2px] rounded-t-[2px] bg-[var(--ds-signal)]"
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
