"use client";

export default function Header({
  displayName,
  role,
}: {
  displayName?: string;
  role?: string;
}) {
  return (
    <header className="sticky top-0 z-40 bg-[#0C1016]/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-[56px] md:min-h-[var(--header-height)] max-w-[var(--layout-max-width)] items-center justify-between gap-3 md:gap-4 px-4 md:px-6 py-2 md:py-3">
        {/* Zone 1: Brand */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div className="flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-lg md:rounded-xl bg-gradient-to-br from-[#0B1512] to-[#0F2A23] ring-1 ring-[#6AD7A3]/20 animate-pulse-glow">
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
          {displayName && (
            <span className="font-semibold uppercase tracking-wider text-[#6AD7A3]" style={{ textShadow: "0 0 12px rgba(106,215,163,0.3)" }}>
              {displayName}
            </span>
          )}
          <span className="h-2 w-2 rounded-full bg-[#6AD7A3] animate-dot-pulse" />
          <span className="h-4 w-px bg-[#2A3544]" />
          <span className="font-mono text-[#9CA3AF] tabular-nums">
            <span className="text-[#B8BFC8]">Online</span>
          </span>
        </div>

        {/* Zone 3: Controls */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {role === "admin" && (
            <span className="hidden md:inline-flex rounded-full bg-[#FAD76A]/10 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-[#FAD76A] ring-1 ring-[#FAD76A]/25">
              Admin
            </span>
          )}
          {/* Mobile: compact name + active dot */}
          <div className="flex md:hidden items-center gap-1.5">
            {displayName && (
              <span className="text-[0.6875rem] text-[#B8BFC8] max-w-[100px] truncate">{displayName}</span>
            )}
            <span className="h-1.5 w-1.5 rounded-full bg-[#6AD7A3] animate-dot-pulse" />
          </div>
        </div>
      </div>

      {/* Glow seam */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#00ffc3]/40 to-transparent animate-seam-glow" />
    </header>
  );
}
