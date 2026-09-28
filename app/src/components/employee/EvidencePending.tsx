"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandError, type CommandResponse, Field, textareaClass } from "@/components/ui/client";
import { cmd, useCaseCommand } from "./useCaseCommand";

/** "I don't have this document yet": the approved evidence-pending route. */
export function EvidencePending({ caseId, version, note }: { caseId: string; version: number; note: string | null }) {
  const router = useRouter();
  const { run, pending } = useCaseCommand(version);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note ?? "");
  const [error, setError] = useState<CommandResponse | null>(null);
  const next = `/employee/life-events/${caseId}/options`;

  async function submit() {
    const res = await run((v) => cmd({ type: "case.markEvidencePending", caseId, expectedVersion: v, note: text.trim() || "Document not available yet." }), { successToast: true });
    if (!res.ok) return setError(res);
    router.push(next);
  }

  return (
    <div className="space-y-4">
      {note ? (
        <p className="flex items-start gap-2 text-sm text-ink-2">
          <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            You told us a document is not available yet: <span className="text-ink">“{note}”</span>
          </span>
        </p>
      ) : null}
      <p className="text-sm text-ink-2">
        You can submit your request now and add the document later. Nexa aims to follow up on missing documents within 5 calendar days. That is Nexa&apos;s administrative target, not a legal guarantee or a deadline extension.
      </p>
      {open ? (
        <div className="space-y-3">
          <Field label="What is still pending? (optional)" hint="For example: the hospital has not issued the record yet.">
            {(a) => <textarea id={a.id} aria-describedby={a.describedBy} className={textareaClass()} rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
          {error ? <CommandError result={error} onRetry={submit} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} pending={pending} pendingLabel="Saving…">
              Save and continue without it <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            I don&apos;t have this document yet
          </Button>
        </div>
      )}
    </div>
  );
}
