"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, LogOut } from "lucide-react";
import { useViewAs } from "@/components/view-as/view-as-context";
import FeedbackSheet from "@/components/feedback/feedback-sheet";

function useRelativeTime(iso: string | null) {
  const [text, setText] = useState("");
  useEffect(() => {
    function update() {
      if (!iso) { setText("Never"); return; }
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) setText("Just now");
      else if (mins < 60) setText(`${mins}m ago`);
      else {
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) setText(`${hrs}h ago`);
        else setText(`${Math.floor(hrs / 24)}d ago`);
      }
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [iso]);
  return text;
}

export default function Header({
  displayName,
  role,
}: {
  displayName?: string;
  role?: string;
}) {
  const router = useRouter();
  const { active: viewAsActive, clientId: viewAsId, clientName, loading: viewAsLoading } = useViewAs();
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [logoHolding, setLogoHolding] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanText = useRelativeTime(lastFetch);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setLogoHolding(false);
  }, []);

  const startLongPress = useCallback(() => {
    setLogoHolding(true);
    longPressTimer.current = setTimeout(() => {
      setLogoHolding(false);
      setFeedbackOpen(true);
      longPressTimer.current = null;
    }, 800);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/login?force=1");
  }

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setLastFetch(data.last_fetch_at ?? null);
      }
    }
    load();
    const interval = setInterval(load, 120000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header
        className={[
          "sticky top-0 z-40 font-[family-name:var(--font-ds-sans)]",
          "bg-[var(--ds-bg-0)]/92 backdrop-blur-md",
          "border-b",
          // View-As lens: subtle amber top seam + warmer border when impersonating
          viewAsActive
            ? "border-[rgba(232,197,107,0.22)] shadow-[0_1px_0_0_rgba(232,197,107,0.12)]"
            : "border-[var(--ds-border-1)]",
        ].join(" ")}
      >
        {/* View-As lens: breathing signal-gold seam at the very top */}
        {viewAsActive && (
          <div
            aria-hidden
            className="h-px bg-gradient-to-r from-transparent via-[var(--ds-signal)] to-transparent animate-ds-signal-breathe"
          />
        )}

        <div className="mx-auto flex min-h-[56px] md:min-h-[72px] max-w-[var(--layout-max-width)] items-center justify-between gap-3 md:gap-6 px-4 md:px-6">
          {/* Left: brand */}
          <Link href={viewAsActive && viewAsId ? `/inbox?view_as=${viewAsId}` : "/inbox"} className="flex items-center gap-2.5 md:gap-3 shrink-0">
            <div
              className={[
                "relative flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-[var(--ds-radius-md)]",
                "bg-[var(--ds-bg-2)] border border-[var(--ds-border-2)] select-none transition-transform",
                logoHolding ? "scale-95" : "",
              ].join(" ")}
              onPointerDown={startLongPress}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              onContextMenu={(e) => e.preventDefault()}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-[18px] md:w-[18px]" fill="none" aria-hidden>
                {/* Outer ring — quietest */}
                <circle cx="12" cy="12" r="9" stroke="var(--ds-accent)" strokeWidth="1" opacity="0.22" />
                {/* Mid ring */}
                <circle cx="12" cy="12" r="6" stroke="var(--ds-accent)" strokeWidth="1.1" opacity="0.55" />
                {/* Sweep line */}
                <path d="M12 12 L18.5 7.5" stroke="var(--ds-accent)" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
                {/* Ping dot at sweep tip */}
                <circle cx="18.5" cy="7.5" r="1.2" fill="var(--ds-accent-bright)" className="animate-ds-signal-breathe" />
                {/* Center dot */}
                <circle cx="12" cy="12" r="1.8" fill="var(--ds-accent)" />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[14px] md:text-[15px] font-semibold tracking-[0.02em] text-[var(--ds-text-0)]">
                Sygnalist
              </span>
              <span className="hidden sm:block font-[family-name:var(--font-ds-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--ds-text-3)]">
                Find the signal
              </span>
            </div>
          </Link>

          {/* Middle: status cluster (desktop) */}
          <div className="hidden md:flex items-center gap-3 text-[12px] min-w-0 flex-1 justify-end">
            {viewAsActive ? (
              <ViewAsChip
                clientName={viewAsLoading ? "Loading…" : clientName ?? "Unknown"}
              />
            ) : (
              <>
                {displayName && (
                  <span className="text-[var(--ds-text-1)] font-medium truncate max-w-[200px]">
                    {displayName}
                  </span>
                )}
                <span className="h-3 w-px bg-[var(--ds-border-2)]" aria-hidden />
                <span className="font-[family-name:var(--font-ds-mono)] text-[var(--ds-text-2)] tabular-nums">
                  Last scan <span className="text-[var(--ds-accent)]">{lastScanText || "—"}</span>
                </span>
              </>
            )}
          </div>

          {/* Right: role + mobile identity + sign out */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {role === "admin" && !viewAsActive && (
              <span className="hidden md:inline-flex items-center rounded-[var(--ds-radius-full)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-2)] px-2 py-[3px] font-[family-name:var(--font-ds-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--ds-text-2)]">
                Admin
              </span>
            )}

            {/* Mobile: compact status */}
            <div className="flex md:hidden items-center gap-1.5 min-w-0">
              {viewAsActive ? (
                <>
                  <button
                    onClick={() => router.push("/admin/clients")}
                    title="Back to Admin"
                    aria-label="Exit view-as"
                    className="p-1 rounded-[var(--ds-radius-sm)] text-[var(--ds-signal)] hover:bg-[var(--ds-signal-soft)] transition-colors"
                  >
                    <ArrowLeft size={14} strokeWidth={2} />
                  </button>
                  <Eye size={12} strokeWidth={2} className="text-[var(--ds-signal)] shrink-0" />
                  <span className="text-[12px] text-[var(--ds-signal)] truncate max-w-[120px]">
                    {viewAsLoading ? "…" : clientName}
                  </span>
                </>
              ) : (
                <>
                  {displayName && (
                    <span className="text-[12px] text-[var(--ds-text-1)] truncate max-w-[120px]">
                      {displayName}
                    </span>
                  )}
                </>
              )}
            </div>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out"
              aria-label="Sign out"
              className="p-2 rounded-[var(--ds-radius-sm)] text-[var(--ds-text-2)] hover:text-[var(--ds-text-0)] hover:bg-[var(--ds-bg-2)] transition-colors disabled:opacity-40"
            >
              <LogOut size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {feedbackOpen && <FeedbackSheet onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}

/**
 * View-As lens chip. The shell-level affordance that replaces the old
 * sticky gold banner. Visible in the header right zone on desktop; the
 * mobile version lives inline in the header controls.
 */
function ViewAsChip({ clientName }: { clientName: string }) {
  const router = useRouter();

  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-[var(--ds-radius-full)] border px-3 py-[5px]",
        "bg-[var(--ds-signal-soft)] border-[rgba(232,197,107,0.32)]",
        "font-[family-name:var(--font-ds-sans)]",
      ].join(" ")}
    >
      <Eye size={12} strokeWidth={2} className="text-[var(--ds-signal)] shrink-0" />
      <span className="text-[12px] text-[var(--ds-signal)] truncate max-w-[220px]">
        Viewing as <span className="font-semibold">{clientName}</span>
      </span>
      <span className="h-3 w-px bg-[rgba(232,197,107,0.32)]" aria-hidden />
      <button
        onClick={() => router.push("/admin/clients")}
        className="inline-flex items-center gap-1 rounded-[var(--ds-radius-sm)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-signal)] hover:text-[var(--ds-text-0)] transition-colors"
      >
        Exit
      </button>
    </div>
  );
}

