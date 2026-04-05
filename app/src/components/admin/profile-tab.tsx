"use client";

import { useState } from "react";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const inputClass = "w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]";

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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Min Salary</label>
          <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            <option value="client">Client</option>
            <option value="coach">Coach</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSave({ display_name: name, current_city: city, salary_min: parseInt(salary) || 0, role })}
        className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-4 py-1.5 text-[12px] font-semibold text-[#0C1016]"
      >
        Save Changes
      </button>
    </div>
  );
}
