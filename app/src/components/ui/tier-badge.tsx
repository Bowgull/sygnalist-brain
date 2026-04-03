const tierColors: Record<string, string> = {
  S: "bg-[#FAD76A]/15 text-[#FAD76A] ring-[#FAD76A]/30",
  A: "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-[#6AD7A3]/30",
  B: "bg-[#38BDF8]/15 text-[#38BDF8] ring-[#38BDF8]/30",
  C: "bg-[#9CA3AF]/15 text-[#9CA3AF] ring-[#9CA3AF]/30",
  F: "bg-[#4B5563]/15 text-[#4B5563] ring-[#4B5563]/30",
  X: "bg-[#DC2626]/15 text-[#DC2626] ring-[#DC2626]/30",
};

export default function TierBadge({ tier, score }: { tier: string; score?: number }) {
  const color = tierColors[tier] ?? tierColors.C;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${color}`}>
      Tier {tier}
      {score != null && <span className="ml-1 opacity-70">· {score}</span>}
    </span>
  );
}
