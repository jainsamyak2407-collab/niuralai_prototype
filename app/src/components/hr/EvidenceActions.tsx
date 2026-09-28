"use client";

import { type FormEvent, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandError,
  Field,
  Sheet,
  textareaClass,
} from "@/components/ui/client";
import { useHrCommand } from "./useHrCommand";

/** Accept a file as evidence, or mark it not accepted with a reason. */
export function EvidenceActions({
  caseId,
  version,
  fileId,
  fileName,
  hasOpenConflict,
}: {
  caseId: string;
  version: number;
  fileId: string;
  fileName: string;
  hasOpenConflict: boolean;
}) {
  const accept = useHrCommand();
  const reject = useHrCommand();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [local, setLocal] = useState<string | null>(null);

  const submitReject = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3)
      return setLocal(
        "Say why the document is not accepted, so Maya knows what to send instead.",
      );
    setLocal(null);
    const r = await reject.run({
      type: "hr.reviewEvidence",
      caseId,
      expectedVersion: version,
      fileId,
      outcome: "reject",
      reason: reason.trim(),
    });
    if (r.ok) setOpen(false);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Not accepted
        </Button>
        <Button
          size="sm"
          pending={accept.pending}
          pendingLabel="Accepting…"
          disabled={hasOpenConflict}
          aria-describedby={hasOpenConflict ? `conflict-${fileId}` : undefined}
          onClick={() =>
            accept.run({
              type: "hr.reviewEvidence",
              caseId,
              expectedVersion: version,
              fileId,
              outcome: "accept",
            })
          }
        >
          <Check className="size-4" aria-hidden />
          Accept as evidence
        </Button>
      </div>
      {hasOpenConflict ? (
        <p
          id={`conflict-${fileId}`}
          className="max-w-xs text-right text-xs text-warning-text"
        >
          A document value conflicts with the form. Maya confirms which is
          correct before this can be accepted.
        </p>
      ) : null}
      <div className="w-full max-w-md">
        <CommandError result={accept.result} />
      </div>
      <div className="text-left">
        <Sheet
          open={open}
          onClose={() => {
            setOpen(false);
            reject.clear();
          }}
          title="Mark as not accepted"
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form={`reject-${fileId}`}
                variant="destructive"
                pending={reject.pending}
                pendingLabel="Saving…"
              >
                Mark not accepted
              </Button>
            </>
          }
        >
          <form
            id={`reject-${fileId}`}
            onSubmit={submitReject}
            className="flex flex-col gap-4"
            noValidate
          >
            <p className="text-sm text-muted">
              {fileName} stays in the case history. Not accepting a file is not
              a finding of fraud; say what is needed instead, then request it.
            </p>
            <Field
              label="Reason"
              required
              error={local ?? reject.fieldError("reason")}
            >
              {(a) => (
                <textarea
                  id={a.id}
                  aria-describedby={a.describedBy}
                  aria-invalid={a.invalid}
                  className={textareaClass(a.invalid)}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="The notice does not name Arjun or show the date coverage ends."
                />
              )}
            </Field>
            <CommandError result={reject.result} />
          </form>
        </Sheet>
      </div>
    </div>
  );
}
