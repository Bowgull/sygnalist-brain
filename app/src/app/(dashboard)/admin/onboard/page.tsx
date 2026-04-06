"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ParsedResume {
  display_name: string;
  current_city: string;
  top_skills: string[];
  skill_keywords_plus: string[];
  role_tracks: Array<{ label: string; roleKeywords: string[]; priorityWeight: number }>;
  preferred_locations: string[];
  accept_remote: boolean;
  accept_hybrid: boolean;
  accept_onsite: boolean;
  salary_estimate: string;
  summary: string;
  experience_years: number;
  education: string;
}

type Step = "info" | "resume" | "review" | "filters" | "roles" | "invite";

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [toast, setToast] = useState<string | null>(null);

  // Step 1: Basic info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Step 2: Resume
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [resumeMode, setResumeMode] = useState<"upload" | "paste">("upload");

  // Step 3: Review (editable parsed data)
  const [city, setCity] = useState("");
  const [topSkills, setTopSkills] = useState<string[]>([]);
  const [skillPlus, setSkillPlus] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState(0);

  // Step 4: Filters
  const [salaryMin, setSalaryMin] = useState(0);
  const [acceptRemote, setAcceptRemote] = useState(true);
  const [acceptHybrid, setAcceptHybrid] = useState(true);
  const [acceptOnsite, setAcceptOnsite] = useState(false);
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [bannedKeywords, setBannedKeywords] = useState<string[]>([]);
  const [distanceKm, setDistanceKm] = useState(50);

  // Step 5: Roles
  const [roleTracks, setRoleTracks] = useState<Array<{ label: string; roleKeywords: string[]; priorityWeight: number; enabled: boolean }>>([]);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [existingLanes, setExistingLanes] = useState<string[]>([]);
  const [lanesLoaded, setLanesLoaded] = useState(false);

  // Step 6: Invite
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ─── Step 1: Info ─────────────────────────────────────────
  function handleInfoNext() {
    if (!name.trim() || !email.trim()) {
      showToast("Name and email are required");
      return;
    }
    setStep("resume");
  }

  // ─── Step 2: Resume Upload ────────────────────────────────
  async function handleFileUpload(file: File) {
    setParsing(true);
    setParseError("");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/resume-parse", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data: ParsedResume = await res.json();
      setParsed(data);

      // Pre-fill review fields
      if (data.display_name && !name) setName(data.display_name);
      setCity(data.current_city || "");
      setTopSkills(data.top_skills || []);
      setSkillPlus(data.skill_keywords_plus || []);
      setSummary(data.summary || "");
      setEducation(data.education || "");
      setExperience(data.experience_years || 0);
      setAcceptRemote(data.accept_remote);
      setAcceptHybrid(data.accept_hybrid);
      setAcceptOnsite(data.accept_onsite);
      setPreferredLocations(data.preferred_locations || []);
      setRoleTracks(
        (data.role_tracks || []).map((t) => ({ ...t, enabled: true })),
      );

      if (data.salary_estimate) {
        const nums = data.salary_estimate.match(/[\d,]+/g);
        if (nums && nums.length > 0) {
          setSalaryMin(parseInt(nums[0].replace(/,/g, ""), 10) || 0);
        }
      }

      setStep("review");
    } else {
      const err = await res.json();
      setParseError(err.error || "Parse failed");
    }
    setParsing(false);
  }

  async function handlePasteSubmit() {
    if (pasteText.trim().length < 50) {
      setParseError("Text too short - paste at least a few paragraphs");
      return;
    }
    setParsing(true);
    setParseError("");

    const res = await fetch("/api/admin/resume-parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pasteText }),
    });

    if (res.ok) {
      const data: ParsedResume = await res.json();
      setParsed(data);
      if (data.display_name && !name) setName(data.display_name);
      setCity(data.current_city || "");
      setTopSkills(data.top_skills || []);
      setSkillPlus(data.skill_keywords_plus || []);
      setSummary(data.summary || "");
      setEducation(data.education || "");
      setExperience(data.experience_years || 0);
      setAcceptRemote(data.accept_remote);
      setAcceptHybrid(data.accept_hybrid);
      setAcceptOnsite(data.accept_onsite);
      setPreferredLocations(data.preferred_locations || []);
      setRoleTracks((data.role_tracks || []).map((t) => ({ ...t, enabled: true })));
      if (data.salary_estimate) {
        const nums = data.salary_estimate.match(/[\d,]+/g);
        if (nums?.length) setSalaryMin(parseInt(nums[0].replace(/,/g, ""), 10) || 0);
      }
      setStep("review");
    } else {
      const err = await res.json().catch(() => ({}));
      setParseError(err.error || "Parse failed. Try pasting more text.");
    }
    setParsing(false);
  }

  function handleSkipResume() {
    setStep("filters");
  }

  // ─── Step 5: Lane detection ────────────────────────────────
  async function loadExistingLanes() {
    if (lanesLoaded) return;
    const res = await fetch("/api/admin/lanes");
    if (res.ok) {
      const data = await res.json();
      const keys = (data as Array<{ lane_key: string }>).map((l: { lane_key: string }) => l.lane_key);
      setExistingLanes([...new Set(keys)]);
    }
    setLanesLoaded(true);
  }

  function laneExists(label: string): boolean {
    const key = label.toLowerCase().replace(/\s+/g, "_");
    return existingLanes.some((l) => l === key);
  }

  async function createLaneFromRole(label: string) {
    const res = await fetch("/api/admin/lanes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: label, source: "resume_auto" }),
    });
    if (res.ok) {
      const key = label.toLowerCase().replace(/\s+/g, "_");
      setExistingLanes((prev) => [...prev, key]);
      showToast(`Lane "${label}" created`);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Failed to create lane");
    }
  }

  function addRole() {
    if (!newRoleLabel.trim()) return;
    setRoleTracks((prev) => [
      ...prev,
      { label: newRoleLabel.trim(), roleKeywords: [], priorityWeight: 0.8, enabled: true },
    ]);
    setNewRoleLabel("");
  }

  function toggleRole(index: number) {
    setRoleTracks((prev) =>
      prev.map((r, i) => (i === index ? { ...r, enabled: !r.enabled } : r)),
    );
  }

  function removeRole(index: number) {
    setRoleTracks((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Step 6: Create profile & send invite ─────────────────
  async function handleCreateAndInvite() {
    setSending(true);

    const profileId = `client-${email.split("@")[0]}-${Date.now().toString(36)}`;
    const enabledTracks = roleTracks.filter((r) => r.enabled).map(({ enabled: _, ...r }) => r);

    // Create the profile
    const createRes = await fetch("/api/admin/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileId,
        display_name: name,
        email: email.trim().toLowerCase(),
        current_city: city,
        salary_min: salaryMin,
        accept_remote: acceptRemote,
        accept_hybrid: acceptHybrid,
        accept_onsite: acceptOnsite,
        preferred_locations: preferredLocations,
        preferred_countries: [],
        preferred_cities: city ? [city] : [],
        top_skills: topSkills,
        skill_keywords_plus: skillPlus,
        skill_profile_text: summary,
        banned_keywords: bannedKeywords,
        distance_range_km: distanceKm,
        role_tracks: enabledTracks,
        role: "client",
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      showToast(err.error || "Failed to create profile");
      setSending(false);
      return;
    }

    const profile = await createRes.json();
    setCreatedProfileId(profile.id);

    // Create Supabase auth user (no password - user sets via forgot-password flow)
    await fetch("/api/auth/create-auth-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }).catch(() => {});

    // Send welcome email with app link + home screen instructions
    const appUrl = window.location.origin;
    const emailBody = buildWelcomeEmail(name, appUrl);

    await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: profile.id,
        subject: `Welcome to Sygnalist, ${name.split(" ")[0]}!`,
        body: emailBody,
      }),
    });

    setInviteSent(true);
    setSending(false);
  }

  const steps: { key: Step; label: string; num: number }[] = [
    { key: "info", label: "Info", num: 1 },
    { key: "resume", label: "Resume", num: 2 },
    { key: "review", label: "Review", num: 3 },
    { key: "filters", label: "Filters", num: 4 },
    { key: "roles", label: "Roles", num: 5 },
    { key: "invite", label: "Invite", num: 6 },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="relative min-h-[80vh]">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#DC2626] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Back button */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => {
            if (currentIndex > 0) setStep(steps[currentIndex - 1].key);
            else router.push("/admin/clients");
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#171F28] text-[#9CA3AF] transition hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold">Onboard Client</h1>
      </div>

      {/* Progress bar */}
      <div className="mb-6 flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${
                i <= currentIndex
                  ? "bg-gradient-to-r from-[#A9FFB5] to-[#39D6FF]"
                  : "bg-[#2A3544]"
              }`}
            />
            <span className={`text-[10px] font-medium ${i <= currentIndex ? "text-[#6AD7A3]" : "text-[#6B7280]"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Step 1: Basic Info ──────────────────────────── */}
      {step === "info" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-6">
            <h2 className="mb-1 text-base font-semibold">Client Details</h2>
            <p className="mb-5 text-[13px] text-[#9CA3AF]">Who are we setting up?</p>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="w-full rounded-xl border border-[#2A3544] bg-[#0C1016] px-4 py-3 text-sm text-white placeholder-[#4B5563] outline-none transition focus:border-[#6AD7A3] focus:ring-1 focus:ring-[#6AD7A3]/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@example.com"
                  className="w-full rounded-xl border border-[#2A3544] bg-[#0C1016] px-4 py-3 text-sm text-white placeholder-[#4B5563] outline-none transition focus:border-[#6AD7A3] focus:ring-1 focus:ring-[#6AD7A3]/20"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleInfoNext}
            className="w-full rounded-xl bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-3.5 text-sm font-bold text-[#0C1016] transition hover:opacity-90 active:scale-[0.98]"
          >
            Next: Upload Resume
          </button>
        </div>
      )}

      {/* ─── Step 2: Resume Upload ───────────────────────── */}
      {step === "resume" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-6">
            <h2 className="mb-1 text-base font-semibold">Resume</h2>
            <p className="mb-4 text-[13px] text-[#9CA3AF]">
              We&apos;ll extract skills, roles, and preferences automatically.
            </p>

            {/* Mode toggle */}
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setResumeMode("upload")}
                className={`flex-1 rounded-full py-2 text-[0.8125rem] font-medium transition-colors ${
                  resumeMode === "upload"
                    ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                    : "bg-[#151C24] text-[#9CA3AF] ring-1 ring-[#2A3544]"
                }`}
              >
                Upload Word Doc
              </button>
              <button
                type="button"
                onClick={() => setResumeMode("paste")}
                className={`flex-1 rounded-full py-2 text-[0.8125rem] font-medium transition-colors ${
                  resumeMode === "paste"
                    ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                    : "bg-[#151C24] text-[#9CA3AF] ring-1 ring-[#2A3544]"
                }`}
              >
                Paste Text
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".docx,.doc,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />

            {parsing ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#6AD7A3] border-t-transparent" />
                <p className="text-sm text-[#B8BFC8]">Parsing resume with AI...</p>
                <p className="text-[11px] text-[#6B7280]">Extracting skills, roles, and preferences</p>
              </div>
            ) : resumeMode === "upload" ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#2A3544] bg-[#0C1016]/50 py-12 transition hover:border-[#6AD7A3]/40 hover:bg-[#6AD7A3]/5"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#6AD7A3]/10">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Tap to upload resume</p>
                  <p className="mt-0.5 text-[11px] text-[#6B7280]">Word (.docx) or plain text (.txt) - Max 5MB</p>
                </div>
              </button>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={10}
                  placeholder="Paste the full resume text here..."
                  className="w-full rounded-xl border border-[#2A3544] bg-[#0C1016]/50 px-4 py-3 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3] resize-none"
                />
                <button
                  type="button"
                  onClick={handlePasteSubmit}
                  disabled={pasteText.trim().length < 50}
                  className="w-full rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-2.5 text-sm font-semibold text-[#0C1016] disabled:opacity-40"
                >
                  Parse Resume Text
                </button>
              </div>
            )}

            {parseError && (
              <div className="mt-3 rounded-lg bg-[#DC2626]/10 px-3 py-2 text-[13px] text-[#DC2626]">
                {parseError}
              </div>
            )}
          </div>

          <button
            onClick={handleSkipResume}
            className="w-full rounded-xl border border-[#2A3544] py-3 text-sm font-medium text-[#9CA3AF] transition hover:text-white"
          >
            Skip - I&apos;ll set up manually
          </button>
        </div>
      )}

      {/* ─── Step 3: Review Parsed Data ──────────────────── */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-6">
            <h2 className="mb-1 text-base font-semibold">Review Extracted Data</h2>
            <p className="mb-5 text-[13px] text-[#9CA3AF]">Edit anything the AI got wrong.</p>

            {/* Summary card */}
            {summary && (
              <div className="mb-4 rounded-xl bg-[#0C1016] p-4">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">AI Summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full bg-transparent text-[13px] text-[#E5E7EB] outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Experience</label>
                <input
                  value={`${experience} years`}
                  readOnly
                  className="w-full rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-[#B8BFC8]"
                />
              </div>
            </div>

            {education && (
              <div className="mt-3">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Education</label>
                <p className="text-[13px] text-[#B8BFC8]">{education}</p>
              </div>
            )}

            {/* Skills */}
            <div className="mt-4">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Top Skills</label>
              <div className="flex flex-wrap gap-1.5">
                {topSkills.map((skill, i) => (
                  <span
                    key={i}
                    className="group flex items-center gap-1 rounded-full bg-[#6AD7A3]/10 px-2.5 py-1 text-[12px] font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20"
                  >
                    {skill}
                    <button
                      onClick={() => setTopSkills((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 text-[#6AD7A3]/50 hover:text-[#DC2626]"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Keyword Boosters</label>
              <div className="flex flex-wrap gap-1.5">
                {skillPlus.map((skill, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 rounded-full bg-[#38BDF8]/10 px-2.5 py-1 text-[12px] font-medium text-[#38BDF8] ring-1 ring-[#38BDF8]/20"
                  >
                    {skill}
                    <button
                      onClick={() => setSkillPlus((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 text-[#38BDF8]/50 hover:text-[#DC2626]"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep("filters")}
            className="w-full rounded-xl bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-3.5 text-sm font-bold text-[#0C1016] transition hover:opacity-90 active:scale-[0.98]"
          >
            Next: Set Filters
          </button>
        </div>
      )}

      {/* ─── Step 4: Filters ─────────────────────────────── */}
      {step === "filters" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-6">
            <h2 className="mb-1 text-base font-semibold">Search Filters</h2>
            <p className="mb-5 text-[13px] text-[#9CA3AF]">Control what jobs get surfaced.</p>

            {/* Work mode toggles */}
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Work Mode</label>
            <div className="mb-4 flex gap-2">
              {([
                ["Remote", acceptRemote, setAcceptRemote],
                ["Hybrid", acceptHybrid, setAcceptHybrid],
                ["Onsite", acceptOnsite, setAcceptOnsite],
              ] as const).map(([label, val, setter]) => (
                <button
                  key={label}
                  onClick={() => (setter as (v: boolean) => void)(!val)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
                    val
                      ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                      : "bg-[#0C1016] text-[#6B7280] ring-1 ring-[#2A3544]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Salary */}
            <div className="mb-4">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Min Salary (annual)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>
                <input
                  type="number"
                  value={salaryMin || ""}
                  onChange={(e) => setSalaryMin(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full rounded-xl border border-[#2A3544] bg-[#0C1016] py-3 pl-7 pr-4 text-sm text-white outline-none focus:border-[#6AD7A3]"
                />
              </div>
            </div>

            {/* Distance */}
            <div className="mb-4">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Max Distance: {distanceKm} km
              </label>
              <input
                type="range"
                min={10}
                max={200}
                step={10}
                value={distanceKm}
                onChange={(e) => setDistanceKm(parseInt(e.target.value))}
                className="w-full accent-[#6AD7A3]"
              />
              <div className="flex justify-between text-[10px] text-[#6B7280]">
                <span>10 km</span>
                <span>200 km</span>
              </div>
            </div>

            {/* Preferred locations */}
            <div className="mb-4">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Preferred Locations</label>
              <TagInput values={preferredLocations} onChange={setPreferredLocations} placeholder="Add city or region..." />
            </div>

            {/* Banned keywords */}
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Banned Keywords</label>
              <TagInput values={bannedKeywords} onChange={setBannedKeywords} placeholder="e.g. internship, volunteer..." />
            </div>
          </div>

          <button
            onClick={() => setStep("roles")}
            className="w-full rounded-xl bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-3.5 text-sm font-bold text-[#0C1016] transition hover:opacity-90 active:scale-[0.98]"
          >
            Next: Review Roles
          </button>
        </div>
      )}

      {/* ─── Step 5: Role Tracks ─────────────────────────── */}
      {step === "roles" && (
        <RolesStep
          roleTracks={roleTracks}
          toggleRole={toggleRole}
          removeRole={removeRole}
          newRoleLabel={newRoleLabel}
          setNewRoleLabel={setNewRoleLabel}
          addRole={addRole}
          laneExists={laneExists}
          createLaneFromRole={createLaneFromRole}
          loadExistingLanes={loadExistingLanes}
          onNext={() => setStep("invite")}
        />
      )}

      {/* ─── Step 6: Review & Invite ─────────────────────── */}
      {step === "invite" && !inviteSent && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-6">
            <h2 className="mb-1 text-base font-semibold">Ready to Launch</h2>
            <p className="mb-5 text-[13px] text-[#9CA3AF]">
              Review and send {name.split(" ")[0]} their access link.
            </p>

            {/* Summary */}
            <div className="space-y-3">
              <SummaryRow label="Name" value={name} />
              <SummaryRow label="Email" value={email} />
              <SummaryRow label="City" value={city || "Not set"} />
              <SummaryRow label="Min Salary" value={salaryMin ? `$${salaryMin.toLocaleString()}` : "Not set"} />
              <SummaryRow
                label="Work Mode"
                value={[acceptRemote && "Remote", acceptHybrid && "Hybrid", acceptOnsite && "Onsite"].filter(Boolean).join(", ") || "Any"}
              />
              <SummaryRow
                label="Roles"
                value={roleTracks.filter((r) => r.enabled).map((r) => r.label).join(", ") || "None set"}
              />
              <SummaryRow label="Top Skills" value={topSkills.slice(0, 5).join(", ") || "None"} />
            </div>
          </div>

          <button
            onClick={handleCreateAndInvite}
            disabled={sending}
            className="w-full rounded-xl bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-3.5 text-sm font-bold text-[#0C1016] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0C1016] border-t-transparent" />
                Creating profile & sending invite...
              </span>
            ) : (
              "Create Profile & Send Invite"
            )}
          </button>
        </div>
      )}

      {/* ─── Success State ───────────────────────────────── */}
      {step === "invite" && inviteSent && (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#6AD7A3]/15">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold">Client Onboarded!</h2>
          <p className="mt-2 text-[13px] text-[#9CA3AF]">
            {name.split(" ")[0]} has been set up and their invite email has been sent to <span className="text-white">{email}</span>.
          </p>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            The email includes instructions on how to save Sygnalist to their home screen.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => router.push("/admin/clients")}
              className="rounded-xl border border-[#2A3544] px-5 py-2.5 text-sm font-medium text-[#B8BFC8] transition hover:text-white"
            >
              View Clients
            </button>
            <button
              onClick={() => {
                // Reset everything
                setStep("info");
                setName(""); setEmail(""); setCity(""); setParsed(null);
                setTopSkills([]); setSkillPlus([]); setSummary(""); setEducation("");
                setExperience(0); setSalaryMin(0); setAcceptRemote(true);
                setAcceptHybrid(true); setAcceptOnsite(false);
                setPreferredLocations([]); setBannedKeywords([]);
                setRoleTracks([]); setCreatedProfileId(null);
                setInviteSent(false);
              }}
              className="rounded-xl bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-5 py-2.5 text-sm font-bold text-[#0C1016]"
            >
              Onboard Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable Components ──────────────────────────────────────

function RolesStep({
  roleTracks, toggleRole, removeRole, newRoleLabel, setNewRoleLabel, addRole,
  laneExists, createLaneFromRole, loadExistingLanes, onNext,
}: {
  roleTracks: Array<{ label: string; roleKeywords: string[]; priorityWeight: number; enabled: boolean }>;
  toggleRole: (i: number) => void;
  removeRole: (i: number) => void;
  newRoleLabel: string;
  setNewRoleLabel: (v: string) => void;
  addRole: () => void;
  laneExists: (label: string) => boolean;
  createLaneFromRole: (label: string) => void;
  loadExistingLanes: () => void;
  onNext: () => void;
}) {
  useEffect(() => { loadExistingLanes(); }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-6">
        <h2 className="mb-1 text-base font-semibold">Job Roles</h2>
        <p className="mb-5 text-[13px] text-[#9CA3AF]">
          These roles determine what jobs get fetched. Roles that match an existing lane are ready to go.
        </p>

        <div className="space-y-2">
          {roleTracks.map((track, i) => {
            const hasLane = laneExists(track.label);
            return (
              <div
                key={i}
                className={`flex items-center justify-between rounded-xl p-3 transition ${
                  track.enabled
                    ? "bg-[#6AD7A3]/8 ring-1 ring-[#6AD7A3]/20"
                    : "bg-[#0C1016] ring-1 ring-[#2A3544] opacity-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleRole(i)}
                    className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                      track.enabled ? "bg-[#6AD7A3] text-[#0C1016]" : "border border-[#4B5563]"
                    }`}
                  >
                    {track.enabled && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{track.label}</p>
                      {hasLane ? (
                        <span className="flex items-center gap-1 rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-[10px] font-medium text-[#22C55E]">
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Lane exists
                        </span>
                      ) : track.enabled ? (
                        <button
                          onClick={() => createLaneFromRole(track.label)}
                          className="flex items-center gap-1 rounded-full bg-[#FAD76A]/10 px-2 py-0.5 text-[10px] font-medium text-[#FAD76A] transition hover:bg-[#FAD76A]/20"
                        >
                          + Create Lane
                        </button>
                      ) : null}
                    </div>
                    {track.roleKeywords.length > 0 && (
                      <p className="text-[11px] text-[#6B7280]">
                        {track.roleKeywords.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    track.priorityWeight >= 0.9
                      ? "bg-[#6AD7A3]/10 text-[#6AD7A3]"
                      : "bg-[#38BDF8]/10 text-[#38BDF8]"
                  }`}>
                    {track.priorityWeight >= 0.9 ? "Primary" : "Secondary"}
                  </span>
                  <button onClick={() => removeRole(i)} className="text-[#6B7280] hover:text-[#DC2626]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new role */}
        <div className="mt-4 flex gap-2">
          <input
            value={newRoleLabel}
            onChange={(e) => setNewRoleLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRole()}
            placeholder="Add a role..."
            className="flex-1 rounded-xl border border-[#2A3544] bg-[#0C1016] px-3 py-2.5 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]"
          />
          <button
            onClick={addRole}
            className="rounded-xl bg-[#6AD7A3]/15 px-4 text-sm font-medium text-[#6AD7A3] ring-1 ring-[#6AD7A3]/20 transition hover:bg-[#6AD7A3]/25"
          >
            Add
          </button>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-xl bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-3.5 text-sm font-bold text-[#0C1016] transition hover:opacity-90 active:scale-[0.98]"
      >
        Next: Send Invite
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between border-b border-[#2A3544]/50 pb-2">
      <span className="text-[12px] font-medium text-[#6B7280]">{label}</span>
      <span className="max-w-[60%] text-right text-[13px] text-white">{value}</span>
    </div>
  );
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const val = input.trim();
    if (val && !values.includes(val)) {
      onChange([...values, val]);
    }
    setInput("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span
            key={i}
            className="flex items-center gap-1 rounded-full bg-[#151C24] px-2.5 py-1 text-[12px] text-[#B8BFC8] ring-1 ring-[#2A3544]"
          >
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-[#6B7280] hover:text-[#DC2626]">
              x
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-[#2A3544] bg-[#0C1016] px-3 py-2 text-sm text-white placeholder-[#4B5563] outline-none focus:border-[#6AD7A3]"
        />
        <button
          onClick={add}
          type="button"
          className="rounded-lg bg-[#171F28] px-3 text-[12px] font-medium text-[#9CA3AF] ring-1 ring-[#2A3544] hover:text-white"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Welcome Email Builder ──────────────────────────────────

function buildWelcomeEmail(name: string, appUrl: string): string {
  const firstName = name.split(" ")[0];

  return `Hey ${firstName},

Welcome aboard. I've set up your Sygnalist profile and your inbox is already working - fresh job matches tailored to your skills, goals, and preferences are on the way.

<a href="${appUrl}" style="display:inline-block;margin:16px 0;padding:14px 32px;background:linear-gradient(135deg,#A9FFB5,#5EF2C7,#39D6FF);color:#0C1016;font-weight:700;font-size:16px;text-decoration:none;border-radius:12px;">Open Sygnalist</a>

When you open the app, tap <strong>"Set up your password"</strong> on the sign-in page. You'll get a quick email to verify - click the link, choose your password, and you're in. After that, just sign in with your email and password anytime.

<strong style="font-size:16px;">Make It Feel Like an App</strong>
Sygnalist is built for your phone. Add it to your home screen and it works just like a native app - full screen, fast, and always one tap away.

<strong>iPhone:</strong>
1. Open the link above in <strong>Safari</strong>
2. Tap the <strong>Share</strong> button (square with an arrow)
3. Tap <strong>"Add to Home Screen"</strong>
4. Done - you'll see the Sygnalist radar icon on your home screen

<strong>Android:</strong>
1. Open the link above in <strong>Chrome</strong>
2. Tap the <strong>three-dot menu</strong> (top right)
3. Tap <strong>"Add to Home screen"</strong>
4. Done - same thing, one tap to open

<strong style="font-size:16px;">How It Works</strong>
- Your inbox fills with jobs matched to you - no searching required
- Swipe right on anything worth pursuing, left to pass
- Jobs you save go into your tracker where you can manage your pipeline from prospect all the way to offer
- I'm watching behind the scenes and I'll jump in when I see signal

You don't need to do anything else right now. Just open the app, scroll through your matches, and save what catches your eye. We'll go from there.

Questions? Reply to this email anytime.

- Josh`;
}
