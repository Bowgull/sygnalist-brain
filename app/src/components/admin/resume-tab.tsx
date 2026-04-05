"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Download, Check, X, Loader2 } from "lucide-react";
import type { Database, Json } from "@/types/database";
import type { ParsedResume } from "@/types/resume";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ClientResume {
  id: string;
  profile_id: string;
  file_path: string | null;
  file_name: string;
  file_size: number;
  parsed_data: ParsedResume | null;
  status: string;
  applied_at: string | null;
  created_at: string;
}

// Fields we can diff between parsed resume and current profile
const DIFF_FIELDS: Array<{
  key: string;
  label: string;
  profileKey: string;
  format: (val: unknown) => string;
}> = [
  { key: "display_name", label: "Name", profileKey: "display_name", format: String },
  { key: "current_city", label: "City", profileKey: "current_city", format: String },
  { key: "top_skills", label: "Top Skills", profileKey: "top_skills", format: (v) => Array.isArray(v) ? v.join(", ") : String(v) },
  { key: "skill_keywords_plus", label: "Skill Keywords", profileKey: "skill_keywords_plus", format: (v) => Array.isArray(v) ? v.join(", ") : String(v) },
  { key: "role_tracks", label: "Role Tracks", profileKey: "role_tracks", format: (v) => Array.isArray(v) ? v.map((t: { label?: string }) => t.label ?? "").join(", ") : String(v) },
  { key: "preferred_locations", label: "Locations", profileKey: "preferred_locations", format: (v) => Array.isArray(v) ? v.join(", ") : String(v) },
  { key: "accept_remote", label: "Remote", profileKey: "accept_remote", format: (v) => v ? "Yes" : "No" },
  { key: "accept_hybrid", label: "Hybrid", profileKey: "accept_hybrid", format: (v) => v ? "Yes" : "No" },
  { key: "accept_onsite", label: "Onsite", profileKey: "accept_onsite", format: (v) => v ? "Yes" : "No" },
  { key: "salary_estimate", label: "Salary Min", profileKey: "salary_min", format: (v) => typeof v === "number" ? `$${v.toLocaleString()}` : String(v) },
  { key: "summary", label: "Profile Summary", profileKey: "skill_profile_text", format: String },
];

// Map parsed field keys to profile column names for the approve API
const PARSED_TO_PROFILE: Record<string, string> = {
  display_name: "display_name",
  current_city: "current_city",
  top_skills: "top_skills",
  skill_keywords_plus: "skill_keywords_plus",
  role_tracks: "role_tracks",
  preferred_locations: "preferred_locations",
  accept_remote: "accept_remote",
  accept_hybrid: "accept_hybrid",
  accept_onsite: "accept_onsite",
  salary_estimate: "salary_min",
  summary: "skill_profile_text",
};

export default function ResumeTab({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [resumes, setResumes] = useState<ClientResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadResumes();
  }, [profile.id]);

  async function loadResumes() {
    const res = await fetch(`/api/admin/client-resumes?profile_id=${profile.id}`);
    if (res.ok) {
      const data = await res.json();
      setResumes(data);
      // Auto-select all diff fields for pending resumes
      const pending = data.find((r: ClientResume) => r.status === "pending");
      if (pending?.parsed_data) {
        setSelectedFields(new Set(Object.keys(PARSED_TO_PROFILE)));
      }
    }
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleUpload() {
    setUploading(true);
    const formData = new FormData();
    formData.append("profile_id", profile.id);

    if (mode === "file") {
      const file = fileRef.current?.files?.[0];
      if (!file) { setUploading(false); return showToast("Select a file"); }
      formData.append("file", file);
    } else {
      if (pasteText.trim().length < 50) { setUploading(false); return showToast("Text too short (min 50 chars)"); }
      formData.append("text", pasteText);
    }

    const res = await fetch("/api/admin/client-resumes", { method: "POST", body: formData });
    if (res.ok) {
      showToast("Resume parsed successfully");
      if (fileRef.current) fileRef.current.value = "";
      setPasteText("");
      await loadResumes();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Upload failed");
    }
    setUploading(false);
  }

  async function handleApprove(resumeId: string) {
    setApproving(true);
    const profileFields = Array.from(selectedFields).map((k) => PARSED_TO_PROFILE[k]).filter(Boolean);
    const res = await fetch(`/api/admin/client-resumes/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", selected_fields: profileFields }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast("Resume approved & applied");
      // Refresh parent profile
      if (data.profile) onSave(data.profile);
      await loadResumes();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Approve failed");
    }
    setApproving(false);
  }

  async function handleReject(resumeId: string) {
    const res = await fetch(`/api/admin/client-resumes/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    if (res.ok) {
      showToast("Resume rejected");
      await loadResumes();
    }
  }

  async function handleDownload(resumeId: string) {
    const res = await fetch(`/api/admin/client-resumes/${resumeId}/download`);
    if (res.ok) {
      const data = await res.json();
      window.open(data.url, "_blank");
    } else {
      showToast("Download failed");
    }
  }

  const pendingResume = resumes.find((r) => r.status === "pending");
  const historyResumes = resumes.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-5">
      {toast && (
        <div className="rounded-full bg-[#6AD7A3] px-4 py-2 text-[0.8125rem] font-semibold text-[#0C1016] text-center">
          {toast}
        </div>
      )}

      {/* Upload Section */}
      <div>
        <h3 className="text-[13px] font-semibold text-[#B8BFC8] mb-2">Upload Resume</h3>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium border ${
              mode === "file" ? "border-[#6AD7A3] text-[#6AD7A3] bg-[#6AD7A3]/10" : "border-[#2A3544] text-[#9CA3AF]"
            }`}
          >
            File Upload
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium border ${
              mode === "paste" ? "border-[#6AD7A3] text-[#6AD7A3] bg-[#6AD7A3]/10" : "border-[#2A3544] text-[#9CA3AF]"
            }`}
          >
            Paste Text
          </button>
        </div>

        {mode === "file" ? (
          <div className="rounded-xl border border-dashed border-[#2A3544] bg-[#0C1016] p-4 text-center">
            <Upload size={20} strokeWidth={2} className="mx-auto mb-2 text-[#6B7280]" />
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.doc,.txt,.md"
              className="text-[12px] text-[#9CA3AF] file:mr-3 file:rounded-full file:border-0 file:bg-[#2A3544] file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-white"
            />
            <p className="mt-1 text-[11px] text-[#6B7280]">.docx, .txt, or .md (max 5MB)</p>
          </div>
        ) : (
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste resume text here (minimum 50 characters)..."
            rows={5}
            className="w-full rounded-xl border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-[13px] text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]"
          />
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016] disabled:opacity-50"
        >
          {uploading ? <><Loader2 size={14} className="animate-spin" /> Parsing...</> : "Parse Resume"}
        </button>
      </div>

      {/* Diff View (for pending resume) */}
      {pendingResume?.parsed_data && (
        <div>
          <h3 className="text-[13px] font-semibold text-[#B8BFC8] mb-2">Review Changes</h3>
          <div className="rounded-xl border border-[#FAD76A]/30 bg-[#FAD76A]/5 p-3 space-y-2">
            {DIFF_FIELDS.map((field) => {
              const parsed = pendingResume.parsed_data as ParsedResume;
              const newVal = parsed[field.key as keyof ParsedResume];
              const currentVal = profile[field.profileKey as keyof Profile];

              // For salary, map salary_estimate to a number for comparison
              const newFormatted = field.key === "salary_estimate"
                ? field.format(newVal)
                : field.format(newVal);
              const currentFormatted = field.format(currentVal);

              if (newFormatted === currentFormatted) return null;

              const isSelected = selectedFields.has(field.key);

              return (
                <div key={field.key} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFields((prev) => {
                        const next = new Set(prev);
                        if (next.has(field.key)) next.delete(field.key);
                        else next.add(field.key);
                        return next;
                      });
                    }}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected ? "border-[#6AD7A3] bg-[#6AD7A3] text-[#0C1016]" : "border-[#4B5563]"
                    }`}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3.5}>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{field.label}</span>
                    <div className="mt-0.5 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-[#0C1016] px-2 py-1">
                        <span className="text-[10px] text-[#6B7280] block">Current</span>
                        <span className="text-[12px] text-[#9CA3AF] break-words">{currentFormatted || "—"}</span>
                      </div>
                      <div className="rounded-lg bg-[#6AD7A3]/5 border border-[#6AD7A3]/20 px-2 py-1">
                        <span className="text-[10px] text-[#6AD7A3]/60 block">New</span>
                        <span className="text-[12px] text-[#6AD7A3] break-words">{newFormatted || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleApprove(pendingResume.id)}
              disabled={approving || selectedFields.size === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016] disabled:opacity-50"
            >
              {approving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
              Approve & Apply ({selectedFields.size})
            </button>
            <button
              type="button"
              onClick={() => handleReject(pendingResume.id)}
              className="inline-flex items-center gap-1 rounded-full border border-[#DC2626]/30 px-3 py-1.5 text-[12px] text-[#DC2626] hover:bg-[#DC2626]/10"
            >
              <X size={14} strokeWidth={2} /> Reject
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {historyResumes.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-[#B8BFC8] mb-2">Resume History</h3>
          <div className="space-y-1.5">
            {historyResumes.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[#2A3544] bg-[#0C1016] px-3 py-2">
                <FileText size={16} strokeWidth={2} className="shrink-0 text-[#6B7280]" />
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-medium text-white truncate block">{r.file_name}</span>
                  <span className="text-[10px] text-[#6B7280]">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                    r.status === "approved"
                      ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-[#6AD7A3]/30"
                      : "bg-[#DC2626]/15 text-[#DC2626] ring-[#DC2626]/30"
                  }`}
                >
                  {r.status}
                </span>
                {r.file_path && (
                  <button
                    type="button"
                    onClick={() => handleDownload(r.id)}
                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#6AD7A3]/10 hover:text-[#6AD7A3]"
                    title="Download"
                  >
                    <Download size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 size={20} className="animate-spin text-[#6B7280]" />
        </div>
      )}
    </div>
  );
}
