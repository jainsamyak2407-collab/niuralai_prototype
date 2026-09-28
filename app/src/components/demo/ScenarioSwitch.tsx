"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/client";

/** Switches the session's active scenario. Never resets or merges scenarios. */
export function ScenarioSwitch({ id, title, current }: { id: string; title: string; current: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  if (current) return <span className="text-[13px] text-muted">Current scenario</span>;
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session/scenario", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: id }) });
      if (!res.ok) throw new Error();
      toast({ tone: "success", text: `Switched to the ${title} scenario. Its records and clock are unchanged.` });
      start(() => router.refresh());
    } catch {
      setError("Could not switch. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant="outline" onClick={() => void go()} pending={busy} pendingLabel="Switching…">
        Switch to {title}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
