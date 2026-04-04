"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function logAuth(event: string, method?: string, error?: string) {
  fetch("/api/auth/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, method, error }),
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
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [denied, setDenied] = useState(false);
  const supabase = createClient();
  const searchParams = useSearchParams();

  // Handle Google OAuth denial redirect
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

    // Step 1: Check if admin has added this email
    const allowed = await checkAccess(email);
    if (!allowed) {
      setDenied(true);
      setLoading(false);
      return;
    }

    // Step 2: Try sign in
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes("Invalid login")) {
        // First time — create auth account
        const { error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) {
          setMessage(signUpErr.message);
          logAuth("login_failed", "password", signUpErr.message);
          setLoading(false);
          return;
        }
        // Sign in after signup
        const { error: retryErr } = await supabase.auth.signInWithPassword({ email, password });
        if (retryErr) {
          setMessage(retryErr.message);
          logAuth("login_failed", "password", retryErr.message);
          setLoading(false);
          return;
        }
      } else {
        setMessage(error.message);
        logAuth("login_failed", "password", error.message);
        setLoading(false);
        return;
      }
    }

    // Step 3: Link auth user to profile
    await fetch("/api/auth/profile-init", { method: "POST" });
    logAuth("login", "password");
    window.location.href = "/inbox";
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
      logAuth("login_failed", "magic", error.message);
    } else {
      setMessage("Check your email for the login link.");
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    // Google OAuth can't be pre-checked — we check after callback
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
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
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none transition-colors focus:border-[#6AD7A3]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-2.5 text-sm font-semibold text-[#0C1016] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Checking access..." : mode === "password" ? "Sign In" : "Send Magic Link"}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#2A3544]" />
              <span className="text-xs text-[#9CA3AF]">or</span>
              <div className="h-px flex-1 bg-[#2A3544]" />
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[#2A3544] px-4 py-2.5 text-sm font-medium transition-colors hover:border-[#6AD7A3]/50 hover:bg-[#222D3D] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </button>

            <div className="mt-4 text-center">
              <button
                onClick={() => setMode(mode === "password" ? "magic" : "password")}
                className="text-xs text-[#6AD7A3] hover:underline"
              >
                {mode === "password" ? "Use magic link instead" : "Use password instead"}
              </button>
            </div>

            {message && (
              <p className={`mt-3 text-center text-xs ${message.includes("Check") ? "text-[#6AD7A3]" : "text-[#DC2626]"}`}>
                {message}
              </p>
            )}

            <p className="mt-4 text-center text-[11px] text-[#9CA3AF]">
              Invite-only platform. Contact your coach for access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
