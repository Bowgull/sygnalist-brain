export default function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-[70%] rounded bg-[#2A3544]" />
          <div className="mt-2 h-3 w-[50%] rounded bg-[#2A3544]" />
        </div>
        <div className="h-5 w-16 rounded-full bg-[#2A3544]" />
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-14 rounded-full bg-[#2A3544]" />
        <div className="h-5 w-20 rounded-full bg-[#2A3544]" />
        <div className="h-5 w-24 rounded-full bg-[#2A3544]" />
      </div>
    </div>
  );
}
