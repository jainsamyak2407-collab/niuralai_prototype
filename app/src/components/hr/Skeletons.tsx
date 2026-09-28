import { Skeleton } from "@/components/ui/primitives";

// Loading skeletons shaped like the final content: header, section cards, table rows.

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="rounded-[12px] border border-line bg-surface">
      <div className="border-b border-divider px-5 py-3.5">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="flex h-11 items-center gap-6 bg-fill px-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1 bg-segment" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex h-13 items-center gap-6 border-b border-divider px-4 last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="mb-5" role="status" aria-label="Loading">
      <Skeleton className="mb-2 h-3.5 w-44" />
      <Skeleton className="h-6 w-72" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl">
      <HeaderSkeleton />
      <div className="flex flex-col gap-4">
        <TableSkeleton rows={5} cols={5} />
        <TableSkeleton rows={3} cols={4} />
      </div>
    </div>
  );
}

export function CaseSkeleton() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <HeaderSkeleton />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <Skeleton className="mb-4 h-16 w-full rounded-[10px]" />
      <div className="mb-4 rounded-[12px] border border-line bg-surface p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-2 h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="mb-4 flex gap-6 border-b border-divider pb-2.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-16" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <TableSkeleton rows={4} cols={7} />
        <TableSkeleton rows={6} cols={5} />
      </div>
    </div>
  );
}
