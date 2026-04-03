"use client";

export default function Header({ displayName }: { displayName?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-[#0C1016]/90 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0B1512] to-[#0F2A23] ring-1 ring-[#6AD7A3]/20">
            <svg viewBox="0 0 64 64" className="h-5 w-5">
              <circle cx="32" cy="32" r="17" fill="none" stroke="url(#hGrad)" strokeWidth="3.8" opacity="0.95" />
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
          <div>
            <span className="text-sm font-extrabold tracking-wider">SYGNALIST</span>
            <span className="ml-2 text-[10px] text-[#9CA3AF]">FIND THE SIGNAL</span>
          </div>
        </div>

        {/* User name */}
        {displayName && (
          <span className="text-xs text-[#B8BFC8]">{displayName}</span>
        )}
      </div>

      {/* Glow seam */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#00ffc3]/40 to-transparent" />
    </header>
  );
}
