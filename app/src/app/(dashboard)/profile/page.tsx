"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-16 animate-pulse rounded-[var(--radius-lg)]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4 md:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#A9FFB5]/20 to-[#39D6FF]/20 ring-1 ring-[#6AD7A3]/20">
            <span className="text-lg font-bold text-[#6AD7A3]">
              {displayName.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[1rem] md:text-[1.3125rem] font-bold text-white">{displayName}</h2>
            <p className="text-[0.8125rem] text-[#9CA3AF]">{email}</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="w-full rounded-full border border-[#2A3544] py-2.5 text-[0.875rem] font-medium text-[#9CA3AF] transition-all hover:border-[#DC2626]/40 hover:text-[#DC2626]"
      >
        Sign Out
      </button>
    </div>
  );
}
