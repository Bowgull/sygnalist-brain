// ── Domain badge styles ─────────────────────────────────────────────────
export const domainStyles: Record<string, { badge: string; dot: string; color: string; label: string }> = {
  auth:    { badge: "border-[#3B82F6] bg-[#3B82F6]/12 text-[#3B82F6]", dot: "bg-[#3B82F6]", color: "#3B82F6", label: "Auth" },
  inbox:   { badge: "border-[#22C55E] bg-[#22C55E]/12 text-[#22C55E]", dot: "bg-[#22C55E]", color: "#22C55E", label: "Inbox" },
  tracker: { badge: "border-[#8B5CF6] bg-[#8B5CF6]/12 text-[#8B5CF6]", dot: "bg-[#8B5CF6]", color: "#8B5CF6", label: "Tracker" },
  fetch:   { badge: "border-[#22C55E] bg-[#22C55E]/12 text-[#22C55E]", dot: "bg-[#22C55E]", color: "#22C55E", label: "Fetch" },
  admin:   { badge: "border-[#A855F7] bg-[#A855F7]/12 text-[#A855F7]", dot: "bg-[#A855F7]", color: "#A855F7", label: "Admin" },
  message: { badge: "border-[#FAD76A] bg-[#FAD76A]/12 text-[#FAD76A]", dot: "bg-[#FAD76A]", color: "#FAD76A", label: "Message" },
  gmail:   { badge: "border-[#14B8A6] bg-[#14B8A6]/12 text-[#14B8A6]", dot: "bg-[#14B8A6]", color: "#14B8A6", label: "Gmail" },
  cron:    { badge: "border-[#14B8A6] bg-[#14B8A6]/12 text-[#14B8A6]", dot: "bg-[#14B8A6]", color: "#14B8A6", label: "Cron" },
  enrich:  { badge: "border-[#38BDF8] bg-[#38BDF8]/12 text-[#38BDF8]", dot: "bg-[#38BDF8]", color: "#38BDF8", label: "Enrich" },
  system:  { badge: "border-[#9CA3AF] bg-[#9CA3AF]/10 text-[#9CA3AF]", dot: "bg-[#9CA3AF]", color: "#9CA3AF", label: "System" },
};
const defaultDomain = { badge: "border-[#9CA3AF] bg-[#9CA3AF]/10 text-[#9CA3AF]", dot: "bg-[#9CA3AF]", color: "#9CA3AF", label: "Event" };

export function getDomainStyle(eventType: string) {
  const domain = domainFromEventType(eventType);
  return domainStyles[domain] || defaultDomain;
}

export function domainFromEventType(eventType: string): string {
  return (eventType || "").split(".")[0];
}

// ── Severity styles ─────────────────────────────────────────────────────
export const severityStyles: Record<string, { badge: string; row: string }> = {
  critical: { badge: "border-[#DC2626] bg-[#DC2626]/20 text-[#DC2626]", row: "bg-[#DC2626]/5" },
  error:    { badge: "border-[#DC2626] bg-[#DC2626]/12 text-[#DC2626]", row: "" },
  warning:  { badge: "border-[#F59E0B] bg-[#F59E0B]/12 text-[#F59E0B]", row: "" },
  info:     { badge: "border-[#9CA3AF] bg-[#9CA3AF]/10 text-[#9CA3AF]", row: "" },
};

export function getSeverityStyle(severity: string) {
  return severityStyles[severity] || severityStyles.info;
}

// ── Time helpers ────────────────────────────────────────────────────────
export function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function fullTime(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Event helpers ───────────────────────────────────────────────────────
export function actionLabel(eventType: string): string {
  const action = (eventType || "").split(".").slice(1).join(" ");
  if (!action) return eventType || "unknown";
  return action.replace(/_/g, " ");
}

// ── Metadata preview ────────────────────────────────────────────────────
const priorityKeys = [
  "email", "reason", "cause", "stage", "method", "display_name",
  "client_id", "target_profile_id", "tracker_entry_id", "batch_id", "inbox_job_id",
];

/** Returns up to 3 key metadata entries for inline preview */
export function formatMetaPreview(meta: Record<string, unknown> | null): string[] {
  if (!meta || Object.keys(meta).length === 0) return [];
  const result: string[] = [];
  // Priority keys first
  for (const key of priorityKeys) {
    if (meta[key] !== undefined && meta[key] !== null && result.length < 3) {
      result.push(`${key}: ${meta[key]}`);
    }
  }
  // Fill remaining with other keys
  if (result.length < 3) {
    for (const [k, v] of Object.entries(meta)) {
      if (!priorityKeys.includes(k) && v !== null && v !== undefined && result.length < 3) {
        result.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
      }
    }
  }
  return result;
}

/** Single-string preview for tight spaces */
export function previewMeta(meta: Record<string, unknown> | null): string {
  const items = formatMetaPreview(meta);
  return items.length > 0 ? items.join(" · ") : "";
}

// ── Batch status helpers ────────────────────────────────────────────────
type FetchLog = Record<string, unknown>;

export type BatchStatus = "success" | "warning" | "failed";

/** Derive overall batch status from source rows (excludes summary row) */
export function deriveBatchStatus(sourceLogs: FetchLog[]): BatchStatus {
  const sources = sourceLogs.filter((l) => l.source_name !== "summary");
  if (sources.length === 0) return "success";
  if (sources.some((s) => !(s.success as boolean))) return "failed";
  if (sources.some((s) => (s.success as boolean) && (s.jobs_returned as number) === 0)) return "warning";
  return "success";
}

const batchStatusStyles = {
  success: { text: "text-[#22C55E]", bg: "bg-[#22C55E]/10", border: "border-[#22C55E]/20", label: "SUCCESS" },
  warning: { text: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/20", label: "WARNING" },
  failed:  { text: "text-[#DC2626]", bg: "bg-[#DC2626]/10", border: "border-[#DC2626]/20", label: "FAILED" },
};

export function getBatchStatusStyle(status: BatchStatus) {
  return batchStatusStyles[status];
}

/** Human-readable warning text for 0-result sources */
export function getWarningText(sourceLogs: FetchLog[]): string | null {
  const sources = sourceLogs.filter((l) => l.source_name !== "summary");
  const zeroResult = sources.filter((s) => (s.success as boolean) && (s.jobs_returned as number) === 0);
  if (zeroResult.length === 0) return null;
  return `${zeroResult.length} source${zeroResult.length > 1 ? "s" : ""} returned 0 results`;
}

/** Short batch ID for display (last 8 chars) */
export function shortBatchId(id: string): string {
  if (!id || id.length <= 8) return id || "";
  return id.slice(-8);
}

// ── Domain list for filters ─────────────────────────────────────────────
export const allDomains = Object.keys(domainStyles);
