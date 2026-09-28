"use client";

import { useEffect } from "react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Inline recovery for a simulator page that failed to load. Keeps the shell in place. */
export function SimError({ error, retry, what }: { error: Error & { digest?: string }; retry: () => void; what: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-7xl">
      <div role="alert" className="flex items-start gap-3 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
        <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <div className="flex-1">
          <p className="text-ink">We could not load {what}.</p>
          <p className="mt-0.5 text-ink-2">Saved simulator data is unchanged. Try again; if it keeps failing, check that the store is reachable.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
