const statusColors: Record<string, string> = {
  Prospect: "bg-[#1DD3B0]/15 text-[#1DD3B0] border-[#1DD3B0]/30",
  Applied: "bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30",
  "Interview 1": "bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30",
  "Interview 2": "bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30",
  Final: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  Offer: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  Rejected: "bg-[#DC2626]/12 text-[#DC2626] border-[#DC2626]/25",
  Ghosted: "bg-[#4B5563]/12 text-[#4B5563] border-[#4B5563]/25",
  Withdrawn: "bg-[#6B7280]/12 text-[#6B7280] border-[#6B7280]/25",
};

const displayNames: Record<string, string> = {
  "Interview 1": "1st Interview",
  "Interview 2": "2nd Interview",
};

export default function StatusPill({ status }: { status: string }) {
  const color = statusColors[status] ?? statusColors.Prospect;
  const label = displayNames[status] ?? status;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.04em] ${color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
