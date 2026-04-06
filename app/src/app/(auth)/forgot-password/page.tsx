"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  useSearchParams(); // forces dynamic rendering
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/send-reset-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong. Try again.");
    } else if (data.ok === false && data.reason === "no_access") {
      setError("No account found for this email. Contact your coach to get set up.");
    } else {
      setSent(true);
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
              <circle cx="32" cy="32" r="17" fill="none" stroke="url(#fpGrad)" strokeWidth="3.8" opacity="0.95" />
              <circle cx="32" cy="32" r="10" fill="none" stroke="#A9FFB5" strokeWidth="2" opacity="0.16" />
              <path d="M32 32 L49 22" stroke="url(#fpGrad)" strokeWidth="3" strokeLinecap="round" opacity="0.80" />
              <circle cx="49" cy="22" r="2.7" fill="#A9FFB5" opacity="0.95" />
              <circle cx="32" cy="32" r="4.4" fill="url(#fpGrad)" />
              <path d="M47.5 15.8 l1.3 2.5 2.5 1.3-2.5 1.3-1.3 2.5-1.3-2.5-2.5-1.3 2.5-1.3z" fill="#FFD77A" opacity="0.95" />
              <defs>
                <linearGradient id="fpGrad" x1="0" y1="0" x2="1" y2="1">
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
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#6AD7A3]/10">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold">Check Your Email</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#B8BFC8]">
                We sent a password reset link to <span className="text-white">{email}</span>.
                Click the link in your email to set your password.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-block text-[13px] text-[#6AD7A3] hover:text-[#A9FFB5] transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold text-center">Set Up or Reset Password</h2>
              <p className="mb-5 text-center text-[13px] text-[#9CA3AF]">
                Enter your email and we&apos;ll send you a link to set your password.
              </p>

              <form onSubmit={handleSubmit}>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-2.5 text-sm font-semibold text-[#0C1016] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              {error && (
                <p className="mt-4 text-center text-sm text-[#DC2626]">{error}</p>
              )}

              <div className="mt-4 text-center">
                <Link href="/login" className="text-[12px] text-[#9CA3AF] hover:text-white transition-colors">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
