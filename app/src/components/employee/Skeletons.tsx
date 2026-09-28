import { Skeleton } from "@/components/ui/primitives";

// Loading skeletons shaped like the final content. No full-page spinners.

export function HeaderSkeleton({ stepper = false }: { stepper?: boolean }) {
  return (
    <div className="mb-5 space-y-2" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      {stepper ? (
        <div className="flex flex-wrap gap-3 pt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-32 rounded-full" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SectionSkeleton({ rows = 3, table = false }: { rows?: number; table?: boolean }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface">
      <div className="border-b border-divider px-5 py-3.5">
        <Skeleton className="h-5 w-48" />
      </div>
      {table ? (
        <div>
          <div className="h-11 border-b border-divider bg-fill" />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-divider px-4 py-4 last:border-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 p-5">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-9 w-full max-w-md" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WizardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <HeaderSkeleton stepper />
      <Skeleton className="h-16 w-full rounded-[10px]" />
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={2} />
    </div>
  );
}

export function TablePageSkeleton({ sections = 2, width = "max-w-6xl" }: { sections?: number; width?: string }) {
  return (
    <div className={`mx-auto ${width} space-y-5`}>
      <HeaderSkeleton />
      {Array.from({ length: sections }).map((_, i) => (
        <SectionSkeleton key={i} rows={4} table />
      ))}
    </div>
  );
}
