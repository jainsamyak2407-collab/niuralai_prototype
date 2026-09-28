"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandError,
  Field,
  inputClass,
  Sheet,
  textareaClass,
} from "@/components/ui/client";
import { useHrCommand } from "./useHrCommand";

/**
 * Record a documented review on a blocking check. The server refuses checks that need
 * the missing fact itself (intake, final divorce, birth date, evidence conflict); its
 * message is shown here so HR sees why a generic override is not possible.
 */
export function CheckReviewButton({
  caseId,
  version,
  checkId,
  checkLabel,
  checkReason,
  reviewerDefault,
}: {
  caseId: string;
  version: number;
  checkId: string;
  checkLabel: string;
  checkReason: string;
  reviewerDefault: string;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, fieldError, clear } = useHrCommand();
  const [outcome, setOutcome] = useState<"passed" | "not_applicable">("passed");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [reviewer, setReviewer] = useState(reviewerDefault);
  const [local, setLocal] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (reason.trim().length < 5)
      errs.reason = "Explain what was reviewed and why it is resolved.";
    if (source.trim().length < 3)
      errs.source = "Name the document or rule you relied on.";
    if (reviewer.trim().length < 3) errs.reviewer = "Name the reviewer.";
    setLocal(errs);
    if (Object.keys(errs).length) return;
    const r = await run({
      type: "hr.resolveCheck",
      caseId,
      expectedVersion: version,
      checkId,
      outcome,
      reason: reason.trim(),
      source: source.trim(),
      reviewer: reviewer.trim(),
    });
    if (r.ok) setOpen(false);
  };
  const err = (k: string) => local[k] ?? fieldError(k);
  const close = () => {
    setOpen(false);
    clear();
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Record review for ${checkLabel}`}
      >
        Record review
      </Button>
      <div className="text-left">
        <Sheet
          open={open}
          onClose={close}
          title="Record review"
          footer={
            <>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                form={`review-${checkId}`}
                pending={pending}
                pendingLabel="Saving…"
              >
                Record review
              </Button>
            </>
          }
        >
          <form
            id={`review-${checkId}`}
            onSubmit={submit}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="rounded-[8px] bg-fill px-3 py-2.5 text-sm">
              <p className="font-medium text-ink">{checkLabel}</p>
              <p className="mt-0.5 text-ink-2">{checkReason}</p>
            </div>
            <p className="text-sm text-muted">
              A review documents an exception with its reason and source. It
              cannot erase a missing fact or a legal conflict; those need the
              information itself.
            </p>
            <fieldset>
              <legend className="mb-1.5 text-sm text-ink">
                Outcome
                <span className="ml-0.5 text-danger" aria-hidden>
                  *
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["passed", "Reviewed, passes"],
                    ["not_applicable", "Not applicable"],
                  ] as const
                ).map(([v, label]) => (
                  <label
                    key={v}
                    className={`flex h-9 cursor-pointer items-center gap-2 rounded-[8px] border px-3 text-sm ${outcome === v ? "border-primary bg-tint-4 text-primary-strong" : "border-line text-ink hover:bg-fill"}`}
                  >
                    <input
                      type="radio"
                      name={`outcome-${checkId}`}
                      value={v}
                      checked={outcome === v}
                      onChange={() => setOutcome(v)}
                      className="accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Reason" required error={err("reason")}>
              {(a) => (
                <textarea
                  id={a.id}
                  aria-describedby={a.describedBy}
                  aria-invalid={a.invalid}
                  className={textareaClass(a.invalid)}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Source"
              required
              error={err("source")}
              hint="Plan section, carrier rule, or the document reviewed."
            >
              {(a) => (
                <input
                  id={a.id}
                  aria-describedby={a.describedBy}
                  aria-invalid={a.invalid}
                  className={inputClass(a.invalid)}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Nexa Plan (synthetic) §6"
                />
              )}
            </Field>
            <Field label="Reviewer" required error={err("reviewer")}>
              {(a) => (
                <input
                  id={a.id}
                  aria-describedby={a.describedBy}
                  aria-invalid={a.invalid}
                  className={inputClass(a.invalid)}
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                />
              )}
            </Field>
            <CommandError result={result} />
          </form>
        </Sheet>
      </div>
    </>
  );
}
