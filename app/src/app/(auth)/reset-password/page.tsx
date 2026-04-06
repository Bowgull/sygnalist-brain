"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function logAuth(event: string, method?: string, error?: string, email?: string) {
  fetch("/api/auth/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, method, error, email }),
  }).catch(() => {});
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

type Status = "loading" | "ready" | "saving" | "done" | "error";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function verifyToken() {
      const tokenHash = searchParams.get("token_hash");
      const code = searchParams.get("code");

      if (tokenHash) {
        // Direct flow: verify the hashed token from the email link
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (verifyError) {
          setError("This link has expired or is invalid. Please request a new one.");
          setStatus("error");
          logAuth("password_reset_failed", "password", verifyError.message);
          return;
        }
      } else if (code) {
        // Legacy flow: exchange auth code for session (callback redirect)
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("This link has expired or is invalid. Please request a new one.");
          setStatus("error");
          logAuth("password_reset_failed", "password", exchangeError.message);
          return;
        }
      } else {
        setError("No reset code found. Please request a new password reset link.");
        setStatus("error");
        return;
      }

      // Link profile if not already linked
      await fetch("/api/auth/profile-init", { method: "POST" }).catch(() => {});

      setStatus("ready");
    }
    verifyToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("saving");
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      logAuth("password_reset_failed", "password", updateError.message);
      return;
    }

    logAuth("password_set", "password");

    // Set session start cookie for 3-day expiry
    document.cookie = `syg_session_start=${Math.floor(Date.now() / 1000)};path=/;max-age=259200;samesite=lax`;

    setStatus("done");
    router.replace("/inbox");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B1512] to-[#0F2A23] ring-1 ring-[#6AD7A3]/20">
            <svg viewBox="0 0 64 64" className="h-10 w-10">
              <circle cx="32" cy="32" r="17" fill="none" stroke="url(#rpGrad)" strokeWidth="3.8" opacity="0.95" />
              <circle cx="32" cy="32" r="10" fill="none" stroke="#A9FFB5" strokeWidth="2" opacity="0.16" />
              <path d="M32 32 L49 22" stroke="url(#rpGrad)" strokeWidth="3" strokeLinecap="round" opacity="0.80" />
              <circle cx="49" cy="22" r="2.7" fill="#A9FFB5" opacity="0.95" />
              <circle cx="32" cy="32" r="4.4" fill="url(#rpGrad)" />
              <path d="M47.5 15.8 l1.3 2.5 2.5 1.3-2.5 1.3-1.3 2.5-1.3-2.5-2.5-1.3 2.5-1.3z" fill="#FFD77A" opacity="0.95" />
              <defs>
                <linearGradient id="rpGrad" x1="0" y1="0" x2="1" y2="1">
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

        <div className="rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-6 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
          {status === "loading" && (
            <div className="text-center">
              <p className="text-sm text-[#B8BFC8]">Verifying your link...</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DC2626]/10">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#DC2626]" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-sm text-[#DC2626]">{error}</p>
              <Link
                href="/forgot-password"
                className="mt-4 inline-block text-[13px] text-[#6AD7A3] hover:text-[#A9FFB5] transition-colors"
              >
                Request a new link
              </Link>
            </div>
          )}

          {(status === "ready" || status === "saving") && (
            <>
              <h2 className="mb-1 text-lg font-semibold text-center">Set Your Password</h2>
              <p className="mb-5 text-center text-[13px] text-[#9CA3AF]">
                Choose a password for your account. You&apos;ll use this to sign in from now on.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-[#B8BFC8]">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none transition-colors focus:border-[#6AD7A3]"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-[#B8BFC8]">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                    required
                    minLength={8}
                    placeholder="Re-enter your password"
                    className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none transition-colors focus:border-[#6AD7A3]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "saving"}
                  className="w-full rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-2.5 text-sm font-semibold text-[#0C1016] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {status === "saving" ? "Setting password..." : "Set Password"}
                </button>
              </form>

              {error && (
                <p className="mt-4 text-center text-sm text-[#DC2626]">{error}</p>
              )}
            </>
          )}

          {status === "done" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#6AD7A3]/10">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <p className="text-sm text-[#6AD7A3]">Password set. Redirecting...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
