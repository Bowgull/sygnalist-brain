"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, CardBody, Section } from "@/components/design-system";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetSent, setResetSent] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setDisplayName(data.display_name ?? "");
        setEmail(data.email ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleChangePassword() {
    if (!email) return;
    const res = await fetch("/api/auth/send-reset-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setResetSent(true);
      toast.success("Reset link sent", { description: "Check your email." });
    } else {
      toast.error("Couldn't send reset link");
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    fetch("/api/auth/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "logout" }),
    }).catch(() => {});
    document.cookie = "syg_session_start=;path=/;max-age=0";
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 font-[family-name:var(--font-ds-sans)]">
        <div className="h-24 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 font-[family-name:var(--font-ds-sans)] text-[var(--ds-text-1)]">
      <div className="max-w-[640px] mx-auto space-y-6">
        <Section eyebrow="Profile · account" title="Account">
          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--ds-radius-full)] border border-[var(--ds-border-2)] bg-[var(--ds-bg-2)]">
                  <span className="text-[15px] font-semibold text-[var(--ds-text-0)]">
                    {displayName.charAt(0)?.toUpperCase() ?? "?"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-semibold text-[var(--ds-text-0)] leading-tight tracking-[-0.01em]">
                    {displayName || "Unknown"}
                  </h2>
                  <p className="mt-0.5 font-[family-name:var(--font-ds-mono)] text-[12px] text-[var(--ds-text-2)] truncate">
                    {email}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </Section>

        <Section eyebrow="Security" title="Sign-in">
          <Card>
            <CardBody>
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleChangePassword}
                  disabled={resetSent}
                  icon={<KeyRound size={14} strokeWidth={2} />}
                  className="w-full justify-start"
                >
                  {resetSent ? "Reset link sent — check your email" : "Change password"}
                </Button>
                <Button
                  variant="destructive"
                  size="md"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  icon={<LogOut size={14} strokeWidth={2} />}
                  className="w-full justify-start"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </Section>
      </div>
    </div>
  );
}
