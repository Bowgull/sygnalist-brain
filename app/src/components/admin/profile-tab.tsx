"use client";

import { useState } from "react";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const inputClass = "w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]";
const labelClass = "mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "nl", label: "Dutch" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "no", label: "Norwegian" },
  { code: "pl", label: "Polish" },
  { code: "cs", label: "Czech" },
] as const;

export default function ProfileTab({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [city, setCity] = useState(profile.current_city);
  const [salary, setSalary] = useState(String(profile.salary_min));
  const [role, setRole] = useState(profile.role);
  const [languages, setLanguages] = useState<string[]>(profile.preferred_languages?.length ? profile.preferred_languages : ["en"]);

  function toggleLanguage(code: string) {
    setLanguages((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev; // must keep at least one
        return prev.filter((l) => l !== code);
      }
      return [...prev, code];
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Min Salary</label>
          <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            <option value="client">Client</option>
            <option value="coach">Coach</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Accepted Languages</label>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGE_OPTIONS.map((lang) => {
            const active = languages.includes(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLanguage(lang.code)}
                className={`rounded-full px-3 py-1 text-[0.6875rem] font-medium transition-colors ${
                  active
                    ? "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-1 ring-[#6AD7A3]/30"
                    : "bg-[#171F28] text-[#9CA3AF] ring-1 ring-[#2A3544] hover:text-[#B8BFC8]"
                }`}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSave({ display_name: name, current_city: city, salary_min: parseInt(salary) || 0, role, preferred_languages: languages })}
        className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016]"
      >
        Save Changes
      </button>
    </div>
  );
}
