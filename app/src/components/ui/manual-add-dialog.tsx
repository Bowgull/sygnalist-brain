"use client";

import { useState } from "react";

const STAGES = [
  { label: "Prospect", color: "#1DD3B0" },
  { label: "Applied", color: "#3B82F6" },
  { label: "Interview 1", color: "#8B5CF6" },
  { label: "Interview 2", color: "#8B5CF6" },
  { label: "Final", color: "#F59E0B" },
  { label: "Offer", color: "#22C55E" },
];

interface ManualAddDialogProps {
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    company: string;
    url?: string;
    location?: string;
    notes?: string;
    status?: string;
  }) => void;
}

export default function ManualAddDialog({ onClose, onSubmit }: ManualAddDialogProps) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Prospect");

  const inputClass =
    "w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none transition-colors focus:border-[#6AD7A3]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-[rgba(5,6,10,0.9)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg animate-slide-up rounded-t-[20px] md:rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-[#6AD7A3]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Job Manually
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              title,
              company,
              url: url || undefined,
              location: location || undefined,
              notes: notes || undefined,
              status,
            });
          }}
          className="space-y-3"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Job Title *"
            className={inputClass}
          />
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
            placeholder="Company *"
            className={inputClass}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Job URL (optional)"
            className={inputClass}
          />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className={inputClass}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes (optional)"
            className={inputClass}
          />

          {/* Stage selector */}
          <div>
            <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
              Stage
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setStatus(s.label)}
                  className={`rounded-full px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-all ${
                    status === s.label
                      ? "ring-1"
                      : "opacity-50 hover:opacity-75 ring-1 ring-[#2A3544]"
                  }`}
                  style={{
                    color: s.color,
                    ...(status === s.label
                      ? {
                          backgroundColor: `${s.color}15`,
                          boxShadow: `inset 0 0 0 1px ${s.color}40`,
                        }
                      : {}),
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-[#2A3544] py-2.5 text-sm font-medium text-[#9CA3AF]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-full border border-[rgba(169,255,181,0.35)] bg-gradient-to-r from-[rgba(14,18,24,0.6)] to-[rgba(21,28,36,0.60)] py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(106,215,163,0.15)]"
            >
              Add to Tracker
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
