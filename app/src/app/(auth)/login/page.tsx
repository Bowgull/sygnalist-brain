"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function logAuth(event: string, method?: string, error?: string, email?: string) {
  fetch("/api/auth/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, method, error, email }),
  }).catch(() => {});
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [denied, setDenied] = useState(false);
  const [mode, setMode] = useState<"password" | "magic">("password");
  const supabase = createClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "no_access") {
      setDenied(true);
    }
  }, [searchParams]);

  async function checkAccess(userEmail: string): Promise<boolean> {
    const res = await fetch("/api/auth/check-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail }),
    });
    const data = await res.json();
    return data.allowed === true;
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setDenied(false);

    const allowed = await checkAccess(email);
    if (!allowed) {
      setDenied(true);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const hint = error.message === "Invalid login credentials"
        ? "Wrong email or password. Haven't set up your password yet?"
        : error.message;
      setMessage(hint);
      logAuth("login_failed", "password", error.message, email);
    } else {
      logAuth("login", "password", undefined, email);
      // Set session start cookie for 3-day expiry
      document.cookie = `syg_session_start=${Math.floor(Date.now() / 1000)};path=/;max-age=259200;samesite=lax`;
      window.location.href = "/inbox";
      return;
    }
    setLoading(false);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setDenied(false);

    const allowed = await checkAccess(email);
    if (!allowed) {
      setDenied(true);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });
    if (error) {
      setMessage(error.message);
      logAuth("login_failed", "magic", error.message, email);
    } else {
      setMessage("Check your email - we just sent you a sign-in link.");
      logAuth("magic_link_sent", "magic", undefined, email);
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B1512] to-[#0F2A23] ring-1 ring-[#6AD7A3]/20">
            <svg viewBox="0 0 64 64" className="h-10 w-10">
              <circle cx="32" cy="32" r="17" fill="none" stroke="url(#loginGrad)" strokeWidth="3.8" opacity="0.95" />
              <circle cx="32" cy="32" r="10" fill="none" stroke="#A9FFB5" strokeWidth="2" opacity="0.16" />
              <path d="M32 32 L49 22" stroke="url(#loginGrad)" strokeWidth="3" strokeLinecap="round" opacity="0.80" />
              <circle cx="49" cy="22" r="2.7" fill="#A9FFB5" opacity="0.95" />
              <circle cx="32" cy="32" r="4.4" fill="url(#loginGrad)" />
              <path d="M47.5 15.8 l1.3 2.5 2.5 1.3-2.5 1.3-1.3 2.5-1.3-2.5-2.5-1.3 2.5-1.3z" fill="#FFD77A" opacity="0.95" />
              <defs>
                <linearGradient id="loginGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#A9FFB5" />
                  <stop offset="0.55" stopColor="#5EF2C7" />
                  <stop offset="1" stopColor="#39D6FF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider">SYGNALIST</h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">FIND THE SIGNAL</p>
        </div>

        {/* Denied state */}
        {denied ? (
          <div className="rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-6 text-center shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DC2626]/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#DC2626]" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">Access Required</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#B8BFC8]">
              Sygnalist is an invite-only platform. To get access, reach out to your coach
              and they&apos;ll set up your account.
            </p>
            <p className="mt-3 text-[12px] text-[#9CA3AF]">
              Email entered: <span className="text-white">{email}</span>
            </p>
            <button
              type="button"
              onClick={() => { setDenied(false); setMessage(""); }}
              className="mt-4 rounded-full border border-[#2A3544] px-4 py-2 text-sm font-medium text-[#9CA3AF] hover:border-[#6AD7A3]/50 hover:text-white"
            >
              Try a different email
            </button>
          </div>
        ) : (
          /* Card */
          <div className="rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-6 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
            <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}>
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-[#B8BFC8]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none transition-colors focus:border-[#6AD7A3]"
                />
              </div>

              {mode === "password" && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-[#B8BFC8]">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none transition-colors focus:border-[#6AD7A3]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-2.5 text-sm font-semibold text-[#0C1016] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading
                  ? "Checking access..."
                  : mode === "password"
                  ? "Sign In"
                  : "Send Sign-In Link"}
              </button>
            </form>

            {message && (
              <div className="mt-4 text-center text-sm">
                <p className={message.includes("Check") ? "text-[#6AD7A3]" : "text-[#DC2626]"}>
                  {message}
                </p>
                {message.includes("Haven't set up") && (
                  <Link href="/forgot-password" className="mt-1 inline-block text-[#6AD7A3] underline underline-offset-2 text-[13px]">
                    Set up your password
                  </Link>
                )}
              </div>
            )}

            {mode === "password" && (
              <div className="mt-4 space-y-2 text-center">
                <Link href="/forgot-password" className="block text-[12px] text-[#9CA3AF] hover:text-white transition-colors">
                  Forgot password?
                </Link>
                <Link href="/forgot-password" className="block text-[12px] text-[#6AD7A3] hover:text-[#A9FFB5] transition-colors">
                  First time? Set up your password
                </Link>
              </div>
            )}

            <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-3 text-center">
              <button
                type="button"
                onClick={() => { setMode(mode === "password" ? "magic" : "password"); setMessage(""); }}
                className="text-[11px] text-[#9CA3AF] hover:text-white transition-colors"
              >
                {mode === "password" ? "Or sign in with email link" : "Or sign in with password"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
