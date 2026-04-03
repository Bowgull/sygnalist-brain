"use client";

import { useState, useEffect } from "react";
import type { Database } from "@/types/database";

type Template = Database["public"]["Tables"]["message_templates"]["Row"];

export default function AdminMessagesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Fetch templates via service client would need an API route
      // For now, display info about the Message Hub
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-[#171F28]" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Message Hub</h1>

      <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#6AD7A3]/10">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold">Coming in Phase 12</h2>
        <p className="mt-2 text-[13px] text-[#B8BFC8]">
          The Message Hub will allow you to send coach-to-client emails using templates,
          AI-assisted drafts, and auto-triggers (interview reached, weekly digest, offer celebration).
        </p>
        <p className="mt-3 text-[11px] text-[#9CA3AF]">
          5 templates have been pre-loaded in the database and are ready to go.
        </p>
      </div>

      {/* Template preview */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4">
        <h2 className="mb-3 text-sm font-semibold">Pre-loaded Templates</h2>
        <div className="space-y-2">
          {[
            { name: "Welcome", trigger: "On signup" },
            { name: "Interview Prep", trigger: "interview_reached" },
            { name: "Weekly Digest", trigger: "weekly_digest" },
            { name: "Inactive Check-in", trigger: "Manual" },
            { name: "Offer Celebration", trigger: "offer_reached" },
          ].map((t) => (
            <div
              key={t.name}
              className="flex items-center justify-between rounded-lg bg-[#151C24] px-3 py-2"
            >
              <span className="text-[13px] text-white">{t.name}</span>
              <span className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[11px] text-[#6AD7A3]">
                {t.trigger}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
