"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { CommandError, type CommandResponse, Field, textareaClass } from "@/components/ui/client";
import { cmd, useCaseCommand } from "./useCaseCommand";

export const RECEIVED_KEY = (id: string) => `qle-received-${id}`;

/** Remove celebration from copy for sensitive cases (bereavement, a child who died, flagged cases). */
export function receivedCopy(message: string, sensitive: boolean) {
  return sensitive ? message.replace(/^Congratulations on your new arrival\.\s*/, "") : message;
}

export function ReviewSubmit({
  caseId,
  version,
  sensitive,
  intakePassed,
  missing,
  late,
  futureMessage,
  reviewMode,
  assisted,
  explanation: initialExplanation,
}: {
  caseId: string;
  version: number;
  sensitive: boolean;
  intakePassed: boolean;
  missing: string[];
  late: boolean;
  futureMessage: string | null;
  reviewMode: boolean;
  assisted: boolean;
  explanation: string;
}) {
  const router = useRouter();
  const { run, pending } = useCaseCommand(version);
  const [attest, setAttest] = useState(false);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [errors, setErrors] = useState<{ attest?: string; explanation?: string }>({});
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [savedExplanation, setSavedExplanation] = useState(initialExplanation);
  const asReview = reviewMode || late || !intakePassed || assisted;
  const showExplanation = asReview;

  async function submit() {
    const e: typeof errors = {};
    if (!attest) e.attest = "Confirm the attestation to submit.";
    if (late && !explanation.trim()) e.explanation = "Explain what happened so HR can review the timing.";
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(e.attest ? "attest" : "explanation")?.focus();
      return;
    }
    setResult(null);
    if (showExplanation && explanation.trim() !== savedExplanation.trim()) {
      const up = await run((v) => cmd({ type: "case.updateDraft", caseId, expectedVersion: v, facts: { explanation: explanation.trim() } }));
      if (!up.ok) return setResult(up);
      setSavedExplanation(explanation);
    }
    const res = await run((v) => cmd({ type: "case.submit", caseId, expectedVersion: v, attestation: true, asReviewRequest: asReview || undefined }));
    if (!res.ok) {
      if (res.fieldErrors?.explanation) setErrors((x) => ({ ...x, explanation: res.fieldErrors!.explanation }));
      return setResult(res);
    }
    try {
      sessionStorage.setItem(RECEIVED_KEY(caseId), receivedCopy(res.message, sensitive));
    } catch {
      // Storage can be unavailable; the tracker still shows the receipt.
    }
    router.push(`/employee/cases/${caseId}?received=1`);
  }

  return (
    <div className="space-y-4">
      {!intakePassed && !futureMessage ? (
        <div className="rounded-[10px] border border-line px-4 py-3 text-sm">
          <p className="text-ink">Some information is still missing</p>
          <ul className="mt-1 list-disc pl-5 text-ink-2">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="mt-2 text-ink-2">Complete it, or send the request to HR for review now. HR will tell you exactly what is needed.</p>
          <ButtonLink href={`/employee/life-events/${caseId}/details`} variant="link" className="mt-1">
            Complete missing items
          </ButtonLink>
        </div>
      ) : null}

      {showExplanation ? (
        <Field label={late ? "Explain what happened" : "Note for HR"} required={late} error={errors.explanation} hint={late ? "HR reviews late requests. Tell us why it was reported now." : "Optional. Anything that helps HR review your request."} id="explanation">
          {(a) => <textarea id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={textareaClass(a.invalid)} rows={3} maxLength={2000} value={explanation} onChange={(e) => (setExplanation(e.target.value), setErrors((x) => ({ ...x, explanation: undefined })))} />}
        </Field>
      ) : null}

      <div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            id="attest"
            type="checkbox"
            checked={attest}
            onChange={(e) => (setAttest(e.target.checked), setErrors((x) => ({ ...x, attest: undefined })))}
            aria-invalid={!!errors.attest}
            aria-describedby={errors.attest ? "attest-error" : undefined}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="text-ink">
            I confirm the information in this request is true and complete to the best of my knowledge. I understand the amounts shown are estimates, not insurance confirmation or a payroll deduction.
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          </span>
        </label>
        {errors.attest ? (
          <p id="attest-error" className="mt-1.5 pl-6.5 text-xs text-danger-text">
            {errors.attest}
          </p>
        ) : null}
      </div>

      {result ? <CommandError result={result} onRetry={submit} /> : null}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {futureMessage ? <p className="text-[13px] text-warning-text sm:mr-auto">{futureMessage}</p> : null}
        <Button onClick={submit} pending={pending} pendingLabel="Submitting…" disabled={!!futureMessage} aria-describedby={futureMessage ? "future-reason" : undefined}>
          <Send className="size-4" aria-hidden /> {asReview ? "Send to HR for review" : "Submit request"}
        </Button>
      </div>
      {futureMessage ? (
        <p id="future-reason" className="sr-only">
          Submitting is disabled: {futureMessage}
        </p>
      ) : null}
    </div>
  );
}
