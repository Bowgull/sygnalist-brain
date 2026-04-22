/** Shared constants for the Phase 4 Tracker redesign. */

export const STAGES: { label: string; display: string; color: string }[] = [
  { label: "Prospect", display: "Prospect", color: "#1DD3B0" },
  { label: "Applied", display: "Applied", color: "#3B82F6" },
  { label: "Interview 1", display: "1st Interview", color: "#8B5CF6" },
  { label: "Interview 2", display: "2nd Interview", color: "#8B5CF6" },
  { label: "Final", display: "Final", color: "#F59E0B" },
  { label: "Offer", display: "Offer", color: "#22C55E" },
];

export const CLOSED_STAGES: { label: string; display: string; color: string }[] = [
  { label: "Rejected", display: "Rejected", color: "#DC2626" },
  { label: "Ghosted", display: "Ghosted", color: "#6B7280" },
  { label: "Withdrawn", display: "Withdrawn", color: "#6B7280" },
];

export const CLOSED_STATUSES = CLOSED_STAGES.map((s) => s.label);

export const ALL_STAGE_META: Record<string, { display: string; color: string }> = {
  ...Object.fromEntries(STAGES.map((s) => [s.label, { display: s.display, color: s.color }])),
  ...Object.fromEntries(CLOSED_STAGES.map((s) => [s.label, { display: s.display, color: s.color }])),
};

export const STALE_THRESHOLDS: Record<string, [number, number]> = {
  Prospect: [7, 14],
  Applied: [5, 10],
  "Interview 1": [3, 7],
  "Interview 2": [3, 7],
  Final: [3, 5],
  Offer: [2, 5],
};

export const TRANSITION_PLACEHOLDERS: Record<string, string> = {
  Applied: "When did you apply?",
  "Interview 1": "Interview date or details?",
  "Interview 2": "Interview date or details?",
  Final: "Final round details?",
  Offer: "Offer details?",
  Rejected: "What happened?",
  Ghosted: "How long since last contact?",
  Withdrawn: "Reason for withdrawing?",
};

/** Stage-specific text color for days-in-stage based on staleness. */
export function getDaysColor(status: string, days: number): string {
  const thresholds = STALE_THRESHOLDS[status] ?? [3, 7];
  if (days < thresholds[0]) return "var(--ds-accent)";
  if (days < thresholds[1]) return "var(--ds-warn)";
  return "var(--ds-err)";
}

/** Pick the first sentence of the first GoodFit block, capped at 120 chars. */
export function extractFitSummary(goodFit: string | null): string | null {
  if (!goodFit) return null;
  const firstBlock = goodFit.split(/\n\s*\n/)[0] ?? "";
  const firstSentence = firstBlock.split(/\.\s/)[0];
  if (!firstSentence) return null;
  const trimmed = firstSentence.trim();
  if (trimmed.length <= 120) return trimmed.endsWith(".") ? trimmed : trimmed + ".";
  return trimmed.slice(0, 117) + "…";
}

/** Relative time formatter — "3m ago", "2h ago", "5d ago", "2mo ago". */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export interface ActivityNote {
  id: string;
  text: string;
  timestamp: string;
}

/** Parse notes column into an array of typed activity notes. */
export function parseNotes(raw: string, fallbackDate: string): ActivityNote[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0 && arr[0].text !== undefined) return arr;
  } catch {
    /* not JSON — legacy plain text */
  }
  return [{ id: "legacy", text: raw, timestamp: fallbackDate }];
}

export function serializeNotes(notes: ActivityNote[]): string {
  return JSON.stringify(notes);
}

export function getActionHint(
  status: string,
  days: number,
  notes: ActivityNote[],
  isTerminal: boolean,
): string | null {
  if (isTerminal) return null;
  const latestNote = notes[0];
  const thresholds = STALE_THRESHOLDS[status] ?? [3, 7];

  if (status === "Prospect" && days >= thresholds[1]) {
    return "No movement — consider applying or dismissing";
  }
  if (status === "Applied" && days >= thresholds[0]) {
    return `No response in ${days} days`;
  }
  if (
    (status === "Interview 1" || status === "Interview 2" || status === "Final") &&
    days >= thresholds[0]
  ) {
    return `${days} days since stage change — follow up?`;
  }
  if (latestNote) {
    const snippet = latestNote.text.length > 60 ? latestNote.text.slice(0, 57) + "…" : latestNote.text;
    return `${snippet} — ${relativeTime(latestNote.timestamp)}`;
  }
  if (days > 0) {
    return `Added ${days}d ago`;
  }
  return null;
}
