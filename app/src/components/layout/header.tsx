"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useViewAs } from "@/components/view-as/view-as-context";
import { ArrowLeft, Eye, LogOut } from "lucide-react";
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
  const { active: viewAsActive, clientName, loading: viewAsLoading } = useViewAs();
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

  // Fetch last scan time on mount and refresh periodically
  useEffect(() => {
    async function load() {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setLastFetch(data.last_fetch_at ?? null);
      }
    }
    load();
    const interval = setInterval(load, 120000); // refresh every 2 min
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="header-scanlines sticky top-0 z-40 bg-[#0C1016]/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-[56px] md:min-h-[var(--header-height)] max-w-[var(--layout-max-width)] items-center justify-between gap-3 md:gap-4 px-4 md:px-6 py-2 md:py-3">
        {/* Zone 1: Brand */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div
            className={`flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-lg md:rounded-xl bg-gradient-to-br from-[#0B1512] to-[#0F2A23] ring-1 ring-[#6AD7A3]/20 animate-pulse-glow select-none transition-transform ${logoHolding ? "scale-90" : ""}`}
            onPointerDown={startLongPress}
            onPointerUp={clearLongPress}
            onPointerLeave={clearLongPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg viewBox="0 0 64 64" className="h-6 w-6 md:h-8 md:w-8">
              <circle cx="32" cy="32" r="17" fill="none" stroke="url(#hGrad)" strokeWidth="3.8" opacity="0.95" />
              <circle cx="32" cy="32" r="10" fill="none" stroke="#A9FFB5" strokeWidth="2" opacity="0.16" />
              <path d="M32 32 L49 22" stroke="url(#hGrad)" strokeWidth="3" strokeLinecap="round" opacity="0.80" />
              <circle cx="49" cy="22" r="2.7" fill="#A9FFB5" opacity="0.95" />
              <circle cx="32" cy="32" r="4.4" fill="url(#hGrad)" />
              <path d="M47.5 15.8 l1.3 2.5 2.5 1.3-2.5 1.3-1.3 2.5-1.3-2.5-2.5-1.3 2.5-1.3z" fill="#FFD77A" opacity="0.95" />
              <defs>
                <linearGradient id="hGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#A9FFB5" />
                  <stop offset="0.55" stopColor="#5EF2C7" />
                  <stop offset="1" stopColor="#39D6FF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[1rem] md:text-[1.375rem] font-bold tracking-[0.1em] text-[#6AD7A3] leading-tight" style={{ textShadow: "0 0 20px rgba(106,215,163,0.3)" }}>
              SYGNALIST
            </span>
            <span className="hidden sm:block text-[0.6875rem] font-medium uppercase tracking-[0.25em] text-[#9CA3AF]">
              FIND THE SIGNAL
            </span>
          </div>
        </div>

        {/* Zone 2: Status cluster (desktop only) */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          {viewAsActive ? (
            <>
              <Eye size={14} strokeWidth={2} className="text-[#FAD76A]" />
              <span className="font-semibold uppercase tracking-wider text-[#FAD76A]" style={{ textShadow: "0 0 12px rgba(250,215,106,0.3)" }}>
                {viewAsLoading ? "Loading..." : clientName}
              </span>
              <span className="h-2 w-2 rounded-full bg-[#FAD76A] animate-dot-pulse" />
              <span className="h-4 w-px bg-[#2A3544]" />
              <span className="font-mono text-[#9CA3AF]">viewing as client</span>
            </>
          ) : (
            <>
              {displayName && (
                <span className="font-semibold uppercase tracking-wider text-[#6AD7A3]" style={{ textShadow: "0 0 12px rgba(106,215,163,0.3)" }}>
                  {displayName}
                </span>
              )}
              <span className="h-2 w-2 rounded-full bg-[#6AD7A3] animate-dot-pulse" />
              <span className="h-4 w-px bg-[#2A3544]" />
              <span className="font-mono text-[#9CA3AF] tabular-nums">
                Last Scan: <span className="text-[#6AD7A3]">{lastScanText || "-"}</span>
              </span>
            </>
          )}
        </div>

        {/* Zone 3: Controls */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {role === "admin" && (
            <span className="hidden md:inline-flex rounded-full bg-[#FAD76A]/10 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-[#FAD76A] ring-1 ring-[#FAD76A]/25">
              Admin
            </span>
          )}
          <div className="flex md:hidden items-center gap-1.5">
            {viewAsActive ? (
              <>
                <button
                  onClick={() => router.push("/admin/clients")}
                  title="Back to Admin"
                  className="p-1 rounded-md text-[#FAD76A] hover:bg-[#FAD76A]/10 transition-colors"
                >
                  <ArrowLeft size={14} strokeWidth={2} />
                </button>
                <Eye size={12} strokeWidth={2} className="text-[#FAD76A]" />
                <span className="text-[0.6875rem] text-[#FAD76A] max-w-[100px] truncate">{viewAsLoading ? "..." : clientName}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#FAD76A] animate-dot-pulse" />
              </>
            ) : (
              <>
                {displayName && (
                  <span className="text-[0.6875rem] text-[#B8BFC8] max-w-[100px] truncate">{displayName}</span>
                )}
                <span className="h-1.5 w-1.5 rounded-full bg-[#6AD7A3] animate-dot-pulse" />
              </>
            )}
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            title="Sign out"
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#1E2730] transition-colors disabled:opacity-50"
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Glow seam */}
      <div className={`h-px bg-gradient-to-r from-transparent ${viewAsActive ? "via-[#FAD76A]/40" : "via-[#00ffc3]/40"} to-transparent animate-seam-glow`} />

      {feedbackOpen && <FeedbackSheet onClose={() => setFeedbackOpen(false)} />}
    </header>
  );
}
