const tierConfig: Record<string, { classes: string; star?: boolean }> = {
  S: { classes: "bg-[#FAD76A]/15 text-[#FAD76A] ring-[#FAD76A]/30 shadow-[0_0_12px_rgba(250,215,106,0.15)]", star: true },
  A: { classes: "bg-[#6AD7A3]/15 text-[#6AD7A3] ring-[#6AD7A3]/30" },
  B: { classes: "bg-[#38BDF8]/15 text-[#38BDF8] ring-[#38BDF8]/30" },
  C: { classes: "bg-[#9CA3AF]/15 text-[#9CA3AF] ring-[#9CA3AF]/30" },
  F: { classes: "bg-[#4B5563]/15 text-[#4B5563] ring-[#4B5563]/30" },
  X: { classes: "bg-[#DC2626]/15 text-[#DC2626] ring-[#DC2626]/30" },
};

export default function TierBadge({ tier, score }: { tier: string; score?: number }) {
  const config = tierConfig[tier] ?? tierConfig.C;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.04em] ring-1 ${config.classes}`}>
      {config.star && <span>&#9733;</span>}
      {tier}
      {score != null && <span className="opacity-70">{score}</span>}
    </span>
  );
}
