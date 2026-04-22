import { Card } from "@/components/design-system";
import { Skeleton } from "@/components/design-system/loading-state";

export default function SkeletonCard() {
  return (
    <Card>
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton widthPct={72} height={18} />
            <Skeleton widthPct={48} height={13} />
          </div>
          <Skeleton widthPct={12} height={22} />
        </div>
        <div className="flex gap-1.5">
          <Skeleton widthPct={14} height={24} />
          <Skeleton widthPct={20} height={24} />
          <Skeleton widthPct={18} height={24} />
        </div>
        <div className="flex gap-2 pt-1">
          <Skeleton widthPct={24} height={32} />
          <Skeleton widthPct={16} height={32} />
        </div>
      </div>
    </Card>
  );
}
