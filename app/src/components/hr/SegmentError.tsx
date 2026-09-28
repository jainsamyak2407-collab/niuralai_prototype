"use client";

import { useEffect } from "react";
import { XCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Inline, recoverable error for a route segment. Never a blank page. */
export function SegmentError({
  error,
  retry,
  home,
  homeLabel,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  home: string;
  homeLabel: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-7xl">
      <div
        role="alert"
        className="flex items-start gap-3 rounded-[12px] border border-danger/30 bg-danger-soft px-5 py-4"
      >
        <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-ink">
            This page could not load
          </p>
          <p className="mt-1 text-sm text-ink-2">
            Saved records are unchanged. Try again; if it keeps failing, the
            saved data may be briefly unavailable.
            {error.digest ? ` Reference ${error.digest}.` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
            <ButtonLink href={home} variant="ghost">
              {homeLabel}
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
