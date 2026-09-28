"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { ElectionChoice } from "@/lib/contracts/domain";
import { Button } from "@/components/ui/button";
import { CommandError, type CommandResponse } from "@/components/ui/client";
import { cmd, saveError, useCaseCommand } from "./useCaseCommand";

/** Saves fixed elections (for example a removal) when none are saved yet, then moves on. */
export function ContinueWithElections({ caseId, version, elections, href, label }: { caseId: string; version: number; elections: ElectionChoice[] | null; href: string; label: string }) {
  const router = useRouter();
  const { run, pending } = useCaseCommand(version);
  const [error, setError] = useState<CommandResponse | null>(null);
  async function go() {
    if (elections) {
      const res = await run((v) => cmd({ type: "case.setElections", caseId, expectedVersion: v, elections, priority: null }));
      if (!res.ok) return setError(saveError(res));
    }
    router.push(href);
  }
  return (
    <div className="flex flex-col items-end gap-2">
      {error ? <CommandError result={error} onRetry={go} /> : null}
      <Button onClick={go} pending={pending} pendingLabel="Saving…">
        {label} <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
