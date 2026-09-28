"use client";

import { useEffect } from "react";
import { XCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function EmployeeError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-3xl">
      <div role="alert" className="flex items-start gap-3 rounded-[12px] border border-danger/30 bg-danger-soft px-5 py-4">
        <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-medium text-ink">We could not load this page</h1>
          <p className="mt-1 text-sm text-ink-2">Your saved requests and answers are safe. Try again, or go back to your benefits.</p>
          {error.digest ? <p className="mt-1 text-xs text-muted">Reference: {error.digest}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => retry()}>
              Try again
            </Button>
            <ButtonLink href="/employee/benefits" variant="ghost">
              Back to benefits
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
