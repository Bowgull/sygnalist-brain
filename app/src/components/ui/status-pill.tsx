const statusColors: Record<string, string> = {
  Prospect: "bg-[#1DD3B0]/12 text-[#1DD3B0] border-[#1DD3B0]/25",
  Applied: "bg-[#3B82F6]/12 text-[#3B82F6] border-[#3B82F6]/25",
  "Interview 1": "bg-[#8B5CF6]/12 text-[#8B5CF6] border-[#8B5CF6]/25",
  "Interview 2": "bg-[#8B5CF6]/12 text-[#8B5CF6] border-[#8B5CF6]/25",
  Final: "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/25",
  Offer: "bg-[#22C55E]/12 text-[#22C55E] border-[#22C55E]/25",
  Rejected: "bg-[#DC2626]/12 text-[#DC2626] border-[#DC2626]/25",
  Ghosted: "bg-[#4B5563]/12 text-[#4B5563] border-[#4B5563]/25",
  Withdrawn: "bg-[#6B7280]/12 text-[#6B7280] border-[#6B7280]/25",
};

export default function StatusPill({ status }: { status: string }) {
  const color = statusColors[status] ?? statusColors.Prospect;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] ${color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
