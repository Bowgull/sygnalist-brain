"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // If user doesn't exist, try signing up
      if (error.message.includes("Invalid login")) {
        const { error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) {
          setMessage(signUpErr.message);
          setLoading(false);
          return;
        }
      } else {
        setMessage(error.message);
        setLoading(false);
        return;
      }
    }
    // Auto-create profile if needed
    await fetch("/api/auth/profile-init", { method: "POST" });
    window.location.href = "/inbox";
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for the login link.");
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
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

        {/* Card */}
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
              {loading ? "Loading..." : mode === "password" ? "Sign In" : "Send Magic Link"}
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
        </div>
      </div>
    </div>
  );
}
