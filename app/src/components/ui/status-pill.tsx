const statusColors: Record<string, string> = {
  Prospect: "bg-[#1DD3B0]/15 text-[#1DD3B0] ring-[#1DD3B0]/30",
  Applied: "bg-[#3B82F6]/15 text-[#3B82F6] ring-[#3B82F6]/30",
  "Interview 1": "bg-[#8B5CF6]/15 text-[#8B5CF6] ring-[#8B5CF6]/30",
  "Interview 2": "bg-[#8B5CF6]/15 text-[#8B5CF6] ring-[#8B5CF6]/30",
  Final: "bg-[#F59E0B]/15 text-[#F59E0B] ring-[#F59E0B]/30",
  Offer: "bg-[#22C55E]/15 text-[#22C55E] ring-[#22C55E]/30",
  Rejected: "bg-[#DC2626]/15 text-[#DC2626] ring-[#DC2626]/30",
  Ghosted: "bg-[#4B5563]/15 text-[#4B5563] ring-[#4B5563]/30",
  Withdrawn: "bg-[#6B7280]/15 text-[#6B7280] ring-[#6B7280]/30",
};

export default function StatusPill({ status }: { status: string }) {
  const color = statusColors[status] ?? statusColors.Prospect;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${color}`}>
      {status}
    </span>
  );
}
