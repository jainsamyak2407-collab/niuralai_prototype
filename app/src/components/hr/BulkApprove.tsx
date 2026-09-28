"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandError, type CommandResponse, ConfirmModal, useCommand, useIntentKey } from "@/components/ui/client";

type Ready = { id: string; caseNumber: string; employeeName: string; event: string };

/** Approve every case at AI match 100% with all checks passed, in one confirmed action. */
export function BulkApprove({ ready }: { ready: Ready[] }) {
  const { send, pending } = useCommand();
  const intent = useIntentKey();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CommandResponse | null>(null);
  if (!ready.length) return null;

  async function approve() {
    const res = await send({ type: "hr.bulkApprove", caseIds: ready.map((r) => r.id) }, { intentKey: intent.key });
    if (res.ok) {
      intent.reset();
      setOpen(false);
      setResult(null);
    } else setResult(res);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CheckCheck className="size-4" aria-hidden />
        Approve all ready ({ready.length})
      </Button>
      <ConfirmModal open={open} title={`Approve ${ready.length} case${ready.length === 1 ? "" : "s"}?`} confirmLabel={`Approve ${ready.length}`} pending={pending} onCancel={() => (setOpen(false), setResult(null))} onConfirm={() => void approve()}>
        <p>Each case below has AI match 100% and every check passed. Cases with a lower score or an open check stay in the queue for your review.</p>
        <ul className="mt-3 flex flex-col divide-y divide-divider rounded-[8px] border border-line">
          {ready.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
              <span className="text-ink">
                {r.caseNumber} · {r.employeeName}
              </span>
              <span className="text-muted">{r.event}</span>
            </li>
          ))}
        </ul>
        {result ? (
          <div className="mt-3">
            <CommandError result={result} onRetry={() => void approve()} />
          </div>
        ) : null}
      </ConfirmModal>
    </>
  );
}

export function AiMatchPill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted">—</span>;
  const full = score === 100;
  return (
    <span className="tabular inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink">
      <span className={`size-1.5 rounded-full ${full ? "bg-success" : "bg-warning"}`} aria-hidden />
      {score}%
    </span>
  );
}
