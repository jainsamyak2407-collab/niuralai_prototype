"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandError,
  ConfirmModal,
  Field,
  inputClass,
  Sheet,
  textareaClass,
} from "@/components/ui/client";
import { Money } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/dates";
import { useHrCommand } from "./useHrCommand";

// Execution controls on the HR case and payroll pages. Each one acts on a single line,
// batch, instruction, referral or task, so a retry never touches anything else.

// ---------------- Coverage line: correction or broker ----------------

export function LineActions({
  caseId,
  lineId,
  label,
}: {
  caseId: string;
  lineId: string;
  label: string;
}) {
  const correction = useHrCommand();
  const broker = useHrCommand();
  const [confirm, setConfirm] = useState<null | "correction" | "broker">(null);
  const active = confirm === "broker" ? broker : correction;
  const go = async () => {
    const r =
      confirm === "broker"
        ? await broker.run({ type: "hr.assignBroker", caseId, lineId })
        : await correction.run({ type: "hr.sendCorrection", caseId, lineId });
    if (r.ok) setConfirm(null);
  };
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex w-max flex-col items-stretch gap-1.5">
        <Button size="sm" onClick={() => setConfirm("correction")}>
          Send correction for this line
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirm("broker")}
        >
          Assign to broker
        </Button>
      </div>
      <div className="text-left">
        <ConfirmModal
          open={confirm !== null}
          title={
            confirm === "broker"
              ? "Assign to Priya Patel"
              : "Send a correction for this line"
          }
          confirmLabel={
            confirm === "broker" ? "Assign to broker" : "Queue correction"
          }
          pending={active.pending}
          onConfirm={go}
          onCancel={() => {
            setConfirm(null);
            correction.clear();
            broker.clear();
          }}
        >
          <div className="flex flex-col gap-3">
            <p className="text-ink">{label}</p>
            {confirm === "broker" ? (
              <p>
                Priya gets the minimum packet for this line only and submits it
                through the carrier portal herself. No portal login is
                automated. Coverage stays unconfirmed until she records the
                verified carrier result.
              </p>
            ) : (
              <p>
                A versioned correction for this line only goes in the next
                nightly batch, linked to the original transaction. Successful
                lines are never resent. The original receipt and approved intent
                do not change.
              </p>
            )}
            <CommandError result={active.result} />
          </div>
        </ConfirmModal>
      </div>
    </div>
  );
}

// ---------------- Unknown delivery: status inquiry ----------------

export function DeliveryInquiryButton({ batchId }: { batchId: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, fieldError, clear } = useHrCommand();
  const [outcome, setOutcome] = useState<"received" | "not_received" | null>(
    null,
  );
  const [reference, setReference] = useState("");
  const [local, setLocal] = useState<Record<string, string>>({});
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!outcome) errs.outcome = "Choose what the carrier told you.";
    if (reference.trim().length < 3)
      errs.reference = "Add the inquiry reference (ticket, call or email ID).";
    setLocal(errs);
    if (!outcome || Object.keys(errs).length) return;
    const r = await run({
      type: "hr.recordDeliveryInquiry",
      batchId,
      outcome,
      reference: reference.trim(),
    });
    if (r.ok) setOpen(false);
  };
  const err = (k: string) => local[k] ?? fieldError(k);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Record status inquiry
      </Button>
      <div className="text-left">
        <Sheet
          open={open}
          onClose={() => {
            setOpen(false);
            clear();
          }}
          title={`Status inquiry for ${batchId}`}
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form={`inquiry-${batchId}`}
                pending={pending}
                pendingLabel="Saving…"
              >
                Record inquiry
              </Button>
            </>
          }
        >
          <form
            id={`inquiry-${batchId}`}
            onSubmit={submit}
            className="flex flex-col gap-4"
            noValidate
          >
            <p className="text-sm text-muted">
              We do not know whether the carrier received this file. Resending
              blindly could enroll or end someone twice, so ask the carrier
              first and record the answer. If they did not receive it, the same
              changes go in the next batch with the same operation keys.
            </p>
            <fieldset
              aria-describedby={
                err("outcome") ? "inq-outcome-error" : undefined
              }
            >
              <legend className="mb-1.5 text-sm text-ink">
                Carrier answer
                <span className="ml-0.5 text-danger" aria-hidden>
                  *
                </span>
              </legend>
              <div className="flex flex-col gap-2">
                {(
                  [
                    [
                      "received",
                      "Carrier confirms it received the file",
                      "Nothing is resent.",
                    ],
                    [
                      "not_received",
                      "Carrier did not receive the file",
                      "The same changes are requeued for the next batch.",
                    ],
                  ] as const
                ).map(([v, label, note]) => (
                  <label
                    key={v}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-[8px] border px-3 py-2.5 text-sm ${outcome === v ? "border-primary bg-tint-4" : "border-line hover:bg-fill"}`}
                  >
                    <input
                      type="radio"
                      name={`inq-${batchId}`}
                      className="mt-0.5 accent-primary"
                      checked={outcome === v}
                      onChange={() => setOutcome(v)}
                    />
                    <span>
                      <span className="text-ink">{label}</span>
                      <span className="block text-muted">{note}</span>
                    </span>
                  </label>
                ))}
              </div>
              {err("outcome") ? (
                <p
                  id="inq-outcome-error"
                  className="mt-1.5 text-xs text-danger-text"
                >
                  {err("outcome")}
                </p>
              ) : null}
            </fieldset>
            <Field label="Inquiry reference" required error={err("reference")}>
              {(a) => (
                <input
                  id={a.id}
                  aria-describedby={a.describedBy}
                  aria-invalid={a.invalid}
                  className={inputClass(a.invalid)}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="AET-INQ-20931"
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

// ---------------- Payroll instruction ----------------

export function AuthorizePayrollButton({
  instructionId,
  benefit,
  adjustmentCents,
  payday,
}: {
  instructionId: string;
  benefit: string;
  adjustmentCents: number;
  payday: string;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, clear } = useHrCommand();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Authorize adjustment
      </Button>
      <div className="text-left">
        <ConfirmModal
          open={open}
          title="Authorize payroll adjustment"
          confirmLabel="Authorize adjustment"
          pending={pending}
          onConfirm={async () => {
            const r = await run({ type: "hr.authorizePayroll", instructionId });
            if (r.ok) setOpen(false);
          }}
          onCancel={() => {
            setOpen(false);
            clear();
          }}
        >
          <div className="flex flex-col gap-3">
            <p>
              {benefit}: one-time adjustment{" "}
              <Money cents={adjustmentCents} sign /> on the{" "}
              <span className="tabular">{fmtDate(payday)}</span> paycheck.
            </p>
            <p className="text-muted">
              The amount is recalculated from the posted ledger before
              scheduling. Authorizing schedules the change; it is not posted
              until the pay run posts and matches.
            </p>
            <CommandError result={result} />
          </div>
        </ConfirmModal>
      </div>
    </>
  );
}

export function PayrollCorrectionButton({
  instructionId,
  expectedCents,
  postedCents,
}: {
  instructionId: string;
  expectedCents: number;
  postedCents: number;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, clear } = useHrCommand();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Request payroll correction
      </Button>
      <div className="text-left">
        <ConfirmModal
          open={open}
          title="Request payroll correction"
          confirmLabel="Schedule correction"
          pending={pending}
          onConfirm={async () => {
            const r = await run({
              type: "hr.requestPayrollCorrection",
              instructionId,
            });
            if (r.ok) setOpen(false);
          }}
          onCancel={() => {
            setOpen(false);
            clear();
          }}
        >
          <div className="flex flex-col gap-3">
            <p>
              Expected <Money cents={expectedCents} />, posted{" "}
              <Money cents={postedCents} />. The difference{" "}
              <Money cents={expectedCents - postedCents} sign /> goes on the
              next open pay run.
            </p>
            <p className="text-muted">
              The posted payslip is never edited. The correction is a new
              instruction linked to this one.
            </p>
            <CommandError result={result} />
          </div>
        </ConfirmModal>
      </div>
    </>
  );
}

// ---------------- COBRA referral ----------------

export function CobraSendButton({
  referralId,
  beneficiary,
  contactOnFile,
  disabledReason,
}: {
  referralId: string;
  beneficiary: string;
  contactOnFile: boolean;
  disabledReason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, clear } = useHrCommand();
  const [route, setRoute] = useState<
    "verified_address_on_file" | "contact_verification_needed"
  >(contactOnFile ? "verified_address_on_file" : "contact_verification_needed");
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!!disabledReason}
        aria-describedby={
          disabledReason ? `cobra-why-${referralId}` : undefined
        }
      >
        Confirm and send referral
      </Button>
      {disabledReason ? (
        <p id={`cobra-why-${referralId}`} className="text-xs text-muted">
          {disabledReason}
        </p>
      ) : null}
      <div className="text-left">
        <ConfirmModal
          open={open}
          title="Send continuation referral"
          confirmLabel="Send referral"
          pending={pending}
          onConfirm={async () => {
            const r = await run({
              type: "hr.sendCobraReferral",
              referralId,
              contactRoute: route,
            });
            if (r.ok) setOpen(false);
          }}
          onCancel={() => {
            setOpen(false);
            clear();
          }}
        >
          <div className="flex flex-col gap-3">
            <p>
              The administrator receives the minimum referral for {beneficiary}:
              event, dates, plans and the contact route. Maya is never the
              delivery channel for notices.
            </p>
            <fieldset>
              <legend className="mb-1.5 text-sm text-ink">Contact route</legend>
              <div className="flex flex-col gap-2">
                {(
                  [
                    [
                      "verified_address_on_file",
                      "Verified address on file",
                      contactOnFile
                        ? "The administrator uses the address it holds."
                        : "No verified address is on file for this person.",
                    ],
                    [
                      "contact_verification_needed",
                      "Contact verification needed",
                      "The administrator verifies contact details before sending notices.",
                    ],
                  ] as const
                ).map(([v, label, note]) => {
                  const disabled =
                    v === "verified_address_on_file" && !contactOnFile;
                  return (
                    <label
                      key={v}
                      className={`flex items-start gap-2.5 rounded-[8px] border px-3 py-2.5 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${route === v ? "border-primary bg-tint-4" : "border-line hover:bg-fill"}`}
                    >
                      <input
                        type="radio"
                        name={`route-${referralId}`}
                        className="mt-0.5 accent-primary"
                        checked={route === v}
                        disabled={disabled}
                        onChange={() => setRoute(v)}
                      />
                      <span>
                        <span className="text-ink">{label}</span>
                        <span className="block text-muted">{note}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="text-muted">
              Sending is not completion. The case waits for the administrator to
              confirm receipt.
            </p>
            <CommandError result={result} />
          </div>
        </ConfirmModal>
      </div>
    </div>
  );
}

// ---------------- Manual task ----------------

export function ResolveTaskButton({
  taskId,
  title,
}: {
  taskId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, fieldError, clear } = useHrCommand();
  const [resolution, setResolution] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (resolution.trim().length < 3) return setLocal("Say what was done.");
    setLocal(null);
    const r = await run({
      type: "hr.resolveTask",
      taskId,
      resolution: resolution.trim(),
    });
    if (r.ok) setOpen(false);
  };
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Mark resolved: ${title}`}
      >
        Mark resolved
      </Button>
      <div className="text-left">
        <Sheet
          open={open}
          onClose={() => {
            setOpen(false);
            clear();
          }}
          title="Mark task resolved"
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form={`resolve-${taskId}`}
                pending={pending}
                pendingLabel="Saving…"
              >
                Mark resolved
              </Button>
            </>
          }
        >
          <form
            id={`resolve-${taskId}`}
            onSubmit={submit}
            className="flex flex-col gap-4"
            noValidate
          >
            <p className="rounded-[8px] bg-fill px-3 py-2.5 text-sm text-ink">
              {title}
            </p>
            <Field
              label="What was done"
              required
              error={local ?? fieldError("resolution")}
              hint="Recorded in the internal audit with your name and the business time."
            >
              {(a) => (
                <textarea
                  id={a.id}
                  aria-describedby={a.describedBy}
                  aria-invalid={a.invalid}
                  className={textareaClass(a.invalid)}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
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

// ---------------- Internal note ----------------

export function InternalNoteForm({ caseId }: { caseId: string }) {
  const { run, pending, result, fieldError } = useHrCommand();
  const [note, setNote] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 2) return setLocal("Write a short note.");
    setLocal(null);
    const r = await run({ type: "hr.addNote", caseId, note: note.trim() });
    if (r.ok) setNote("");
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <Field
        label="Internal note"
        error={local ?? fieldError("note")}
        hint="Internal only. Employees never see internal notes."
      >
        {(a) => (
          <textarea
            id={a.id}
            aria-describedby={a.describedBy}
            aria-invalid={a.invalid}
            className={`${textareaClass(a.invalid)} min-h-16`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Called the carrier; they expect the file tonight."
          />
        )}
      </Field>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          pending={pending}
          pendingLabel="Adding…"
        >
          Add internal note
        </Button>
      </div>
      <CommandError result={result} />
    </form>
  );
}

// ---------------- Carrier batch file: HR sends it now ----------------

export function SendBatchButton({ records }: { records: number }) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, clear } = useHrCommand();
  if (!records) return null;
  const go = async () => {
    const r = await run({ type: "hr.sendBatch" });
    if (r.ok) setOpen(false);
  };
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Send batch file to carrier ({records})
      </Button>
      <div className="text-left">
        <ConfirmModal
          open={open}
          title="Send the batch file to the carrier?"
          confirmLabel="Send batch file"
          pending={pending}
          onCancel={() => {
            setOpen(false);
            clear();
          }}
          onConfirm={() => void go()}
        >
          <p>
            Sends {records} approved change{records === 1 ? "" : "s"} to the
            carrier now instead of waiting for the 10:00 p.m. file. Coverage is
            confirmed only when the carrier&apos;s record matches.
          </p>
          <div className="mt-3">
            <CommandError result={result} onRetry={() => void go()} />
          </div>
        </ConfirmModal>
      </div>
    </>
  );
}
