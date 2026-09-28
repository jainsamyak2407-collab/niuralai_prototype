import { HeaderSkeleton, SectionSkeleton } from "@/components/employee/Skeletons";
import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <HeaderSkeleton stepper />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Skeleton className="h-28 w-full rounded-[12px]" />
          <SectionSkeleton rows={5} />
          <SectionSkeleton rows={3} table />
        </div>
        <div className="space-y-5">
          <SectionSkeleton rows={2} />
          <SectionSkeleton rows={2} />
        </div>
      </div>
    </div>
  );
}
