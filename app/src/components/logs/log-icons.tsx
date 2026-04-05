/** Inline SVG icons for log rows — 2px stroke, 24x24 viewBox */
import type { ReactNode } from "react";

type IconProps = { className?: string };
type IconComponent = (props: IconProps) => ReactNode;

const defaults = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// ── Domain Icons ────────────────────────────────────────────────────────

function LockIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ArrowDownIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

function InboxIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function CrosshairIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  );
}

function MailIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .5-.87l7-4a1 1 0 0 1 1 0l7 4A1 1 0 0 1 20 6z" />
    </svg>
  );
}

function MailOpenIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6z" />
      <path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />
    </svg>
  );
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function ServerIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

// ── Severity Icons ──────────────────────────────────────────────────────

function AlertOctagonIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CircleXIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function TriangleAlertIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoCircleIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

// ── Status Icons ────────────────────────────────────────────────────────

function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XCircleIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function OpenCircleIcon({ className }: IconProps) {
  return (
    <svg {...defaults} className={className}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

// ── Lookup helpers ──────────────────────────────────────────────────────

const domainIcons: Record<string, IconComponent> = {
  auth: LockIcon,
  fetch: ArrowDownIcon,
  inbox: InboxIcon,
  tracker: CrosshairIcon,
  message: MailIcon,
  admin: ShieldIcon,
  gmail: MailOpenIcon,
  cron: ClockIcon,
  enrich: SparkleIcon,
  system: ServerIcon,
};

const severityIcons: Record<string, IconComponent> = {
  critical: AlertOctagonIcon,
  error: CircleXIcon,
  warning: TriangleAlertIcon,
  info: InfoCircleIcon,
};

export function getDomainIcon(domain: string): IconComponent {
  return domainIcons[domain] ?? ServerIcon;
}

export function getSeverityIcon(severity: string): IconComponent {
  return severityIcons[severity] ?? InfoCircleIcon;
}

export function getStatusIcon(status: "success" | "failed" | "resolved" | "unresolved"): IconComponent {
  switch (status) {
    case "success":
    case "resolved":
      return CheckCircleIcon;
    case "failed":
      return XCircleIcon;
    case "unresolved":
      return OpenCircleIcon;
  }
}

export {
  LockIcon, ArrowDownIcon, InboxIcon, CrosshairIcon, MailIcon,
  ShieldIcon, MailOpenIcon, ClockIcon, SparkleIcon, ServerIcon,
  AlertOctagonIcon, CircleXIcon, TriangleAlertIcon, InfoCircleIcon,
  CheckCircleIcon, XCircleIcon, OpenCircleIcon,
};
