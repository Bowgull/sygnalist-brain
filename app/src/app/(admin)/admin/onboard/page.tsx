"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = ["Info", "Resume", "Review", "Filters", "Roles", "Invite"];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Step 1: Basic info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Step 2: Resume
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Step 3: Parsed data (from resume parse)
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);

  // Step 4: Filters
  const [city, setCity] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [distanceKm, setDistanceKm] = useState("50");
  const [acceptRemote, setAcceptRemote] = useState(true);
  const [acceptHybrid, setAcceptHybrid] = useState(true);
  const [acceptOnsite, setAcceptOnsite] = useState(false);
  const [bannedKeywords, setBannedKeywords] = useState("");

  // Step 5: Role tracks
  const [roleTracks, setRoleTracks] = useState<{ label: string; keywords: string[] }[]>([]);

  // Step 6: Created profile ID
  const [profileId, setProfileId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleResumeParse() {
    if (!resumeFile) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", resumeFile);

    try {
      const res = await fetch("/api/admin/resume-parse", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setParsedData(data);
        // Pre-fill fields from parsed data
        if (data.display_name && !name) setName(data.display_name);
        if (data.preferred_locations?.length) setCity(data.preferred_locations[0]);
        if (data.salary_estimate) setSalaryMin(String(data.salary_estimate));
        if (data.role_tracks) {
          setRoleTracks(
            (data.role_tracks as { label: string; roleKeywords?: string[] }[]).map((t) => ({
              label: t.label,
              keywords: t.roleKeywords ?? [],
            }))
          );
        }
        setStep(2);
      } else {
        showToast("Resume parse failed");
      }
    } catch {
      showToast("Resume parse error");
    }
    setLoading(false);
  }

  async function handleCreateProfile() {
    setLoading(true);
    const profileIdStr = `client-${email.split("@")[0]}-${Date.now().toString(36)}`;

    const res = await fetch("/api/admin/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileIdStr,
        display_name: name,
        email: email.trim().toLowerCase(),
        current_city: city || undefined,
        salary_min: parseInt(salaryMin) || 0,
        distance_range_km: parseInt(distanceKm) || 50,
        accept_remote: acceptRemote,
        accept_hybrid: acceptHybrid,
        accept_onsite: acceptOnsite,
        banned_keywords: bannedKeywords
          ? bannedKeywords.split(",").map((k) => k.trim()).filter(Boolean)
          : [],
        role_tracks: roleTracks,
        top_skills: (parsedData?.top_skills as string[]) ?? [],
        role: "client",
      }),
    });

    if (res.ok) {
      const profile = await res.json();
      setProfileId(profile.id);
      setStep(5);
      showToast("Profile created!");
    } else {
      const err = await res.json().catch(() => ({}));
      showToast((err as { error?: string }).error || "Failed to create profile");
    }
    setLoading(false);
  }

  async function handleSendInvite() {
    if (!profileId || !email) return;
    setLoading(true);

    const welcomeBody = buildWelcomeEmail(name);

    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: profileId,
        subject: `Welcome to Sygnalist, ${name}!`,
        body: welcomeBody,
      }),
    });

    if (res.ok) {
      showToast("Invite email sent!");
      setTimeout(() => router.push("/admin/clients"), 1500);
    } else {
      showToast("Email failed — profile was still created");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-full bg-[#6AD7A3] px-4 py-2 text-sm font-medium text-[#0C1016] shadow-lg">
          {toast}
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/admin/clients")}
          className="text-[#9CA3AF] hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Onboard Client</h1>
      </div>

      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div
              className={`h-1 rounded-full transition-colors ${
                i <= step ? "bg-[#6AD7A3]" : "bg-[#2A3544]"
              }`}
            />
            <p className={`mt-1 text-center text-[10px] ${
              i === step ? "font-medium text-[#6AD7A3]" : "text-[#9CA3AF]"
            }`}>
              {s}
            </p>
          </div>
        ))}
      </div>

      {/* Step 0: Basic Info */}
      {step === 0 && (
        <div className="glass-card animate-fade-in p-5">
          <h2 className="mb-4 text-sm font-semibold">Client Information</h2>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name *"
              className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address *"
              className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
            />
            <button
              type="button"
              onClick={() => { if (name && email) setStep(1); }}
              disabled={!name || !email}
              className="btn-gradient w-full rounded-full py-2.5 text-sm disabled:opacity-40"
            >
              Next: Upload Resume
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Resume Upload */}
      {step === 1 && (
        <div className="glass-card animate-fade-in p-5">
          <h2 className="mb-4 text-sm font-semibold">Upload Resume</h2>
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-[#2A3544] bg-[#151C24] p-8 transition hover:border-[#6AD7A3]/50">
              <svg viewBox="0 0 24 24" className="mb-2 h-8 w-8 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span className="text-sm text-[#B8BFC8]">
                {resumeFile ? resumeFile.name : "Click to upload PDF, DOCX, or TXT"}
              </span>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex-1 rounded-full border border-[#2A3544] py-2.5 text-sm text-[#9CA3AF]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleResumeParse}
                disabled={!resumeFile || loading}
                className="btn-gradient flex-1 rounded-full py-2.5 text-sm disabled:opacity-40"
              >
                {loading ? "Parsing..." : "Parse Resume"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full text-center text-[12px] text-[#9CA3AF] hover:text-[#B8BFC8]"
            >
              Skip — set up manually
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review Parsed Data */}
      {step === 2 && parsedData && (
        <div className="glass-card animate-fade-in p-5">
          <h2 className="mb-4 text-sm font-semibold">Review Parsed Data</h2>
          <div className="space-y-3">
            {typeof parsedData.display_name === "string" && (
              <div>
                <label className="text-[11px] font-medium uppercase text-[#9CA3AF]">Name</label>
                <p className="text-sm text-white">{parsedData.display_name}</p>
              </div>
            )}
            {(parsedData.top_skills as string[])?.length > 0 && (
              <div>
                <label className="text-[11px] font-medium uppercase text-[#9CA3AF]">Skills</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(parsedData.top_skills as string[]).map((s) => (
                    <span key={s} className="rounded-full bg-[#6AD7A3]/10 px-2 py-0.5 text-[11px] text-[#6AD7A3]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(parsedData.role_tracks as { label: string }[])?.length > 0 && (
              <div>
                <label className="text-[11px] font-medium uppercase text-[#9CA3AF]">Suggested Roles</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(parsedData.role_tracks as { label: string }[]).map((t) => (
                    <span key={t.label} className="rounded-full bg-[#38BDF8]/10 px-2 py-0.5 text-[11px] text-[#38BDF8]">
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setStep(3)}
              className="btn-gradient w-full rounded-full py-2.5 text-sm"
            >
              Next: Set Filters
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Filters */}
      {step === 3 && (
        <div className="glass-card animate-fade-in p-5">
          <h2 className="mb-4 text-sm font-semibold">Search Filters</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase text-[#9CA3AF]">City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Toronto"
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase text-[#9CA3AF]">Min Salary</label>
                <input
                  type="number"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="e.g. 80000"
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase text-[#9CA3AF]">Distance (km)</label>
              <input
                type="range"
                min="10"
                max="200"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full accent-[#6AD7A3]"
              />
              <p className="text-right text-[11px] text-[#B8BFC8]">{distanceKm} km</p>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase text-[#9CA3AF]">Work Mode</label>
              <div className="flex gap-2">
                {([
                  ["Remote", acceptRemote, setAcceptRemote],
                  ["Hybrid", acceptHybrid, setAcceptHybrid],
                  ["Onsite", acceptOnsite, setAcceptOnsite],
                ] as [string, boolean, (v: boolean) => void][]).map(([label, val, setter]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setter(!val)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      val
                        ? "bg-[#6AD7A3]/20 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/40"
                        : "bg-[#151C24] text-[#9CA3AF] ring-1 ring-[#2A3544]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase text-[#9CA3AF]">Banned Keywords</label>
              <input
                value={bannedKeywords}
                onChange={(e) => setBannedKeywords(e.target.value)}
                placeholder="e.g. senior, director, manager (comma-separated)"
                className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(parsedData ? 2 : 1)}
                className="flex-1 rounded-full border border-[#2A3544] py-2.5 text-sm text-[#9CA3AF]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="btn-gradient flex-1 rounded-full py-2.5 text-sm"
              >
                Next: Job Roles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Role Tracks */}
      {step === 4 && (
        <div className="glass-card animate-fade-in p-5">
          <h2 className="mb-4 text-sm font-semibold">Job Roles</h2>
          <div className="space-y-3">
            {roleTracks.map((track, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-[#151C24] px-3 py-2">
                <span className="flex-1 text-[13px] text-white">{track.label}</span>
                <button
                  type="button"
                  onClick={() => setRoleTracks((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-[#DC2626] hover:text-[#DC2626]/80"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}

            <AddRoleInput onAdd={(label) => setRoleTracks((prev) => [...prev, { label, keywords: [] }])} />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-full border border-[#2A3544] py-2.5 text-sm text-[#9CA3AF]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreateProfile}
                disabled={loading}
                className="btn-gradient flex-1 rounded-full py-2.5 text-sm disabled:opacity-40"
              >
                {loading ? "Creating..." : "Create Profile & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Send Invite */}
      {step === 5 && (
        <div className="glass-card animate-fade-in p-5 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#6AD7A3]/10">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Profile Created!</h2>
          <p className="mt-2 text-sm text-[#B8BFC8]">
            {name} ({email}) is ready. Send them a welcome email with login instructions.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSendInvite}
              disabled={loading}
              className="btn-gradient w-full rounded-full py-3 text-sm disabled:opacity-40"
            >
              {loading ? "Sending..." : "Send Welcome Email"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/clients")}
              className="text-[12px] text-[#9CA3AF] hover:text-white"
            >
              Skip — go to clients
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddRoleInput({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a role (e.g. Customer Success Manager)"
        className="flex-1 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#6AD7A3]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
        }}
      />
      <button
        type="button"
        onClick={() => {
          if (value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
        }}
        className="rounded-lg bg-[#6AD7A3]/10 px-3 py-2 text-sm text-[#6AD7A3]"
      >
        Add
      </button>
    </div>
  );
}

function buildWelcomeEmail(clientName: string): string {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://sygnalist.app";
  return `Hey ${clientName},

Welcome to Sygnalist! Your job hunting radar is now live.

Here's how it works:
• I'll scan multiple job sources and surface the best matches for you
• Check your Inbox for fresh signals — swipe right to add to your Tracker
• Your Tracker is your personal pipeline — track every application stage

🔗 Log in here: ${appUrl}

📱 Save to your phone's home screen for the best experience:

iPhone:
1. Open the link above in Safari
2. Tap the Share button (box with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

Android:
1. Open the link above in Chrome
2. Tap the three-dot menu (⋮)
3. Tap "Add to Home Screen"
4. Tap "Add"

That's it! You'll get a native app feel without downloading anything.

Let's find the signal.

— Your Sygnalist Coach`;
}
