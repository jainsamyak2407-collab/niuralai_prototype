"use client";

import { type FormEvent, useState } from "react";
import { Plus, Send, ShieldCheck, Trash2 } from "lucide-react";
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

// Case decision controls: Request information, Approve this version, Send for specialist
// review, Record decision. Every form keeps the user's input after a failure.

type CaseRef = { caseId: string; version: number };

// ---------------- Request information ----------------

export function RequestInfoButton({
  caseId,
  version,
  defaultDue,
  suggestedItems,
  firstName,
  variant = "outline",
  size = "md",
}: CaseRef & {
  defaultDue: string;
  suggestedItems: string[];
  firstName: string;
  variant?: "outline" | "secondary" | "primary";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Send className="size-4" aria-hidden />
        Request information
      </Button>
      {open ? (
        <RequestInfoSheet
          caseId={caseId}
          version={version}
          defaultDue={defaultDue}
          suggestedItems={suggestedItems}
          firstName={firstName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function RequestInfoSheet({
  caseId,
  version,
  defaultDue,
  suggestedItems,
  firstName,
  onClose,
}: CaseRef & {
  defaultDue: string;
  suggestedItems: string[];
  firstName: string;
  onClose: () => void;
}) {
  const { run, pending, result, fieldError } = useHrCommand();
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<string[]>(
    suggestedItems.length ? suggestedItems : [""],
  );
  const [due, setDue] = useState(defaultDue);
  const [message, setMessage] = useState(
    `Hi ${firstName}, to finish reviewing your request we need the item${suggestedItems.length > 1 ? "s" : ""} listed below by ${fmtDate(defaultDue)}. Your original request and answers are kept; you only need to add what is listed.`,
  );
  const [local, setLocal] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = items.map((x) => x.trim()).filter(Boolean);
    const errs: Record<string, string> = {};
    if (reason.trim().length < 5)
      errs.reason = "Say why the information is needed.";
    if (!cleaned.length || cleaned.some((x) => x.length < 2))
      errs.items = "List at least one item.";
    if (!due) errs.dueDate = "Choose a due date.";
    if (message.trim().length < 10)
      errs.employeeMessage = `Write the message ${firstName} will see.`;
    setLocal(errs);
    if (Object.keys(errs).length) return;
    const r = await run({
      type: "hr.requestInformation",
      caseId,
      expectedVersion: version,
      reason: reason.trim(),
      items: cleaned,
      dueDate: due,
      employeeMessage: message.trim(),
    });
    if (r.ok) onClose();
  };
  const err = (k: string) =>
    local[k] ??
    fieldError(k) ??
    (k === "items" ? (fieldError("items.0") ?? null) : null);

  return (
    <div className="text-left">
      <Sheet
        open
        onClose={onClose}
        title="Request information"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="request-info-form"
              pending={pending}
              pendingLabel="Sending…"
            >
              Send request
            </Button>
          </>
        }
      >
        <form
          id="request-info-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
          noValidate
        >
          <p className="text-sm text-muted">
            {firstName} sees the items, the due date and your message. The
            reason stays internal. The original receipt time does not change.
          </p>
          <Field
            label="Why it is needed (internal)"
            required
            error={err("reason")}
          >
            {(a) => (
              <textarea
                id={a.id}
                aria-describedby={a.describedBy}
                aria-invalid={a.invalid}
                className={textareaClass(a.invalid)}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="The supporting evidence check needs a document showing the final divorce date."
              />
            )}
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm text-ink">
              Items needed
              <span className="ml-0.5 text-danger" aria-hidden>
                *
              </span>
            </legend>
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <label htmlFor={`ri-item-${i}`} className="sr-only">
                  Item {i + 1}
                </label>
                <input
                  id={`ri-item-${i}`}
                  className={inputClass(!!err("items"))}
                  value={it}
                  aria-describedby={err("items") ? "ri-items-error" : undefined}
                  aria-invalid={!!err("items")}
                  onChange={(e) =>
                    setItems((xs) =>
                      xs.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                  placeholder="Divorce decree or fact summary showing the final date"
                />
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setItems((xs) => xs.filter((_, j) => j !== i))
                    }
                    className="grid size-9 shrink-0 place-items-center rounded-[8px] border border-line text-muted hover:bg-fill hover:text-ink"
                    aria-label={`Remove item ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            ))}
            {err("items") ? (
              <p id="ri-items-error" className="text-xs text-danger-text">
                {err("items")}
              </p>
            ) : null}
            <div>
              <Button
                type="button"
                variant="link"
                onClick={() => setItems((xs) => [...xs, ""])}
              >
                <Plus className="size-4" aria-hidden />
                Add another item
              </Button>
            </div>
          </fieldset>
          <Field
            label="Due date"
            required
            error={err("dueDate")}
            hint="Defaults to five days from today (Nexa's correction target, not a legal cure period)."
          >
            {(a) => (
              <input
                type="date"
                id={a.id}
                aria-describedby={a.describedBy}
                aria-invalid={a.invalid}
                className={`${inputClass(a.invalid)} max-w-[220px]`}
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            )}
          </Field>
          <Field
            label={`Message ${firstName} will see`}
            required
            error={err("employeeMessage")}
            hint="Plain language. No internal notes, diagnoses or former-spouse details."
          >
            {(a) => (
              <textarea
                id={a.id}
                aria-describedby={a.describedBy}
                aria-invalid={a.invalid}
                className={`${textareaClass(a.invalid)} min-h-28`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            )}
          </Field>
          <p className="text-xs text-muted">
            Owner while waiting: {firstName}. Backup: Daniel Brooks. A reminder
            goes out after one business day.
          </p>
          <CommandError result={result} />
        </form>
      </Sheet>
    </div>
  );
}

// ---------------- Approve this version ----------------

export interface ApprovalSummary {
  revisionNo: number;
  lines: {
    person: string;
    benefit: string;
    action: string;
    plan: string;
    tier: string;
    date: string;
  }[];
  people: string[];
  totalBeforeCents: number;
  totalAfterCents: number;
  targetPayday: string | null;
  adjustmentCents: number | null;
}

export function ApproveButton({
  caseId,
  version,
  summary,
  blocked,
  describedBy,
}: CaseRef & {
  summary: ApprovalSummary;
  blocked: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, clear } = useHrCommand();
  const confirm = async () => {
    const r = await run({
      type: "hr.approve",
      caseId,
      expectedVersion: version,
      revisionNo: summary.revisionNo,
    });
    if (r.ok) setOpen(false);
  };
  const close = () => {
    setOpen(false);
    clear();
  };
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={blocked}
        aria-describedby={describedBy}
      >
        <ShieldCheck className="size-4" aria-hidden />
        Approve this version
      </Button>
      <div className="text-left">
        <ConfirmModal
          open={open}
          title={`Approve revision ${summary.revisionNo}`}
          confirmLabel={`Approve revision ${summary.revisionNo}`}
          onConfirm={confirm}
          onCancel={close}
          pending={pending}
        >
          <div className="flex flex-col gap-3">
            <p>
              You are approving this exact version. Any later change to a
              person, plan, date or amount creates a new version that needs
              approval again.
            </p>
            <div className="rounded-[8px] border border-line">
              <ul className="divide-y divide-divider text-[13px]">
                {summary.lines.map((l, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 px-3 py-2"
                  >
                    <span className="text-ink">
                      {l.person} · {l.benefit}
                      <span className="block text-muted">
                        {l.action} · {l.plan} · {l.tier}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-ink-2">
                      {l.date}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-muted">People affected</dt>
              <dd className="text-ink">{summary.people.join(", ")}</dd>
              <dt className="text-muted">Deduction per paycheck</dt>
              <dd className="text-ink">
                <Money cents={summary.totalBeforeCents} /> →{" "}
                <Money cents={summary.totalAfterCents} />
              </dd>
              {summary.targetPayday ? (
                <>
                  <dt className="text-muted">Target paycheck</dt>
                  <dd className="tabular text-ink">
                    {fmtDate(summary.targetPayday)}
                    {summary.adjustmentCents ? (
                      <>
                        {" "}
                        · adjustment{" "}
                        <Money cents={summary.adjustmentCents} sign />
                      </>
                    ) : null}
                  </dd>
                </>
              ) : null}
            </dl>
            <p className="text-muted">
              Approval queues the carrier changes. It does not confirm coverage
              or change a posted payslip.
            </p>
            <CommandError result={result} />
          </div>
        </ConfirmModal>
      </div>
    </>
  );
}

// ---------------- Send for specialist review ----------------

export function EscalateButton({ caseId, version }: CaseRef) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, fieldError, clear } = useHrCommand();
  const [reason, setReason] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5)
      return setLocal("Say what the specialist should review.");
    setLocal(null);
    const r = await run({
      type: "hr.escalate",
      caseId,
      expectedVersion: version,
      reason: reason.trim(),
    });
    if (r.ok) {
      setOpen(false);
      setReason("");
    }
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Send for specialist review
      </Button>
      <div className="text-left">
        <Sheet
          open={open}
          onClose={() => {
            setOpen(false);
            clear();
          }}
          title="Send for specialist review"
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="escalate-form"
                pending={pending}
                pendingLabel="Sending…"
              >
                Send for review
              </Button>
            </>
          }
        >
          <form
            id="escalate-form"
            onSubmit={submit}
            className="flex flex-col gap-4"
            noValidate
          >
            <p className="text-sm text-muted">
              The benefits specialist (synthetic) gets a blocking task due in
              two business days. Maya sees that a specialist is reviewing her
              request, not your reason.
            </p>
            <Field
              label="What needs specialist review"
              required
              error={local ?? fieldError("reason")}
            >
              {(a) => (
                <textarea
                  id={a.id}
                  aria-describedby={a.describedBy}
                  aria-invalid={a.invalid}
                  className={textareaClass(a.invalid)}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Confirm whether the late report changes the coverage end date."
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

// ---------------- Record decision (decline) ----------------

export function DecideButton({
  caseId,
  version,
  firstName,
}: CaseRef & { firstName: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending, result, fieldError, clear } = useHrCommand();
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [route, setRoute] = useState(
    "Reply to HR to ask the plan administrator to review this decision.",
  );
  const [local, setLocal] = useState<Record<string, string>>({});
  const confirm = async () => {
    const errs: Record<string, string> = {};
    if (reason.trim().length < 10)
      errs.reason = "Give the specific reason (at least 10 characters).";
    if (source.trim().length < 3)
      errs.source = "Name the rule or document the decision relies on.";
    if (route.trim().length < 3)
      errs.reviewRoute = "Say how the employee can ask for review.";
    setLocal(errs);
    if (Object.keys(errs).length) return;
    const r = await run({
      type: "hr.decide",
      caseId,
      expectedVersion: version,
      outcome: "declined",
      reason: reason.trim(),
      source: source.trim(),
      reviewRoute: route.trim(),
    });
    if (r.ok) setOpen(false);
  };
  const err = (k: string) => local[k] ?? fieldError(k);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Record decision
      </Button>
      <div className="text-left">
        <ConfirmModal
          open={open}
          title="Record a decline"
          confirmLabel="Record decline"
          tone="destructive"
          pending={pending}
          onConfirm={confirm}
          onCancel={() => {
            setOpen(false);
            clear();
          }}
        >
          <div className="flex flex-col gap-3">
            <p>
              {firstName} sees the reason and the review route. A decline is a
              separate outcome; it never counts as a completed life event.
            </p>
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
              hint="The plan rule or document the decision relies on."
            >
              {(a) => (
                <input
                  id={a.id}
                  aria-describedby={a.describedBy}
                  aria-invalid={a.invalid}
                  className={inputClass(a.invalid)}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Nexa Plan (synthetic) §5.1"
                />
              )}
            </Field>
            <Field
              label="Review route"
              required
              error={err("reviewRoute")}
              hint="No universal appeal deadline is stated. Add one only if the plan document sets it."
            >
              {(a) => (
                <textarea
                  id={a.id}
                  aria-describedby={a.describedBy}
                  aria-invalid={a.invalid}
                  className={`${textareaClass(a.invalid)} min-h-16`}
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                />
              )}
            </Field>
            <CommandError result={result} />
          </div>
        </ConfirmModal>
      </div>
    </>
  );
}
