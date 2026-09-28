import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl" aria-busy="true" aria-label="Loading fixtures">
      <Skeleton className="mb-2 h-3.5 w-40" />
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-5 h-4 w-96 max-w-full" />
      <Skeleton className="mb-5 h-16 w-full rounded-[10px]" />
      {[3, 6].map((rows, s) => (
        <div key={s} className="mb-5 rounded-[12px] border border-line bg-surface">
          <div className="flex flex-col gap-1.5 border-b border-divider px-5 py-3.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <div className="h-11 border-b border-divider bg-fill" />
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-6 border-b border-divider px-4 py-4 last:border-b-0">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="ml-auto h-8 w-28" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
