import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl" aria-busy="true" aria-label="Loading simulator">
      <Skeleton className="mb-2 h-3.5 w-40" />
      <Skeleton className="mb-5 h-7 w-72" />
      <Skeleton className="mb-5 h-16 w-full rounded-[10px]" />
      <div className="mb-5 flex gap-6 border-b border-divider pb-2.5">
        {["w-28", "w-44", "w-32", "w-36", "w-52"].map((w) => (
          <Skeleton key={w} className={`h-4 ${w}`} />
        ))}
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="mb-5 rounded-[12px] border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-divider px-5 py-3.5">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-96 max-w-full" />
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="h-11 border-b border-divider bg-fill" />
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex items-center gap-6 border-b border-divider px-4 py-4 last:border-b-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="ml-auto h-8 w-28" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
