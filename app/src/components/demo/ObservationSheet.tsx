"use client";

import { useId, useState } from "react";
import type { Tier } from "@/lib/contracts/domain";
import { fmtDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { CommandError, type CommandResponse, Field, inputClass, Sheet, useCommand, useIntentKey } from "@/components/ui/client";
import { LabelValue } from "@/components/ui/primitives";
import type { TxnRow } from "./types";
import { asInput, Why } from "./sim-kit";

const TIERS: { id: Tier; label: string }[] = [
  { id: "EE", label: "Employee only" },
  { id: "ES", label: "Employee + Spouse" },
  { id: "EC", label: "Employee + Children" },
  { id: "FAM", label: "Family" },
];

function newEventId() {
  const raw = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
  return `evt_${raw.replace(/-/g, "").slice(0, 12)}`;
}

export interface PlanOption {
  id: string;
  benefit: string;
  shortName: string;
}

/**
 * Publish one carrier coverage observation. Values start from the change order and stay
 * editable, so the operator can deliberately publish a wrong date or tier to exercise
 * reconciliation. Each opening gets its own callback event id.
 */
export function ObservationSheet({ txn, plans, onClose, source }: { txn: TxnRow; plans: PlanOption[]; onClose: () => void; source: string }) {
  const o = txn.order;
  const [planId, setPlanId] = useState(o.planId);
  const [tier, setTier] = useState<Tier>(o.tier);
  const [start, setStart] = useState(o.action === "terminate" ? "" : (o.startDate ?? ""));
  const [end, setEnd] = useState(o.endDate ?? "");
  const [sourceRef, setSourceRef] = useState(source);
  const [eventId] = useState(newEventId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CommandResponse | null>(null);
  const intent = useIntentKey();
  const { send, pending } = useCommand();
  const formId = useId();

  const options = plans.filter((p) => p.benefit === o.benefit);
  const diffs = [
    planId !== o.planId ? "plan" : null,
    tier !== o.tier ? "coverage level" : null,
    (start || null) !== (o.action === "terminate" ? null : o.startDate) ? "start date" : null,
    (end || null) !== (o.endDate ?? null) ? "end date" : null,
  ].filter(Boolean) as string[];

  async function submit() {
    const e: Record<string, string> = {};
    if (o.action !== "terminate" && !start) e.start = "Enter the start date the carrier recorded.";
    if (o.action === "terminate" && !end) e.end = "Enter the end date the carrier recorded.";
    if (start && end && end < start) e.end = "The end date is before the start date.";
    if (sourceRef.trim().length < 3) e.sourceRef = "Add a source reference, such as the carrier file or status id.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await send(
      asInput({ type: "ops.publishObservation", eventId, txnId: txn.id, planId, tier, startDate: start || null, endDate: end || null, sourceRef: sourceRef.trim() }),
      { intentKey: intent.key },
    );
    if (res.ok) {
      intent.reset();
      onClose();
    } else {
      setResult(res);
      if (res.fieldErrors) {
        const fe: Record<string, string> = {};
        if (res.fieldErrors.startDate) fe.start = "Enter a valid start date.";
        if (res.fieldErrors.endDate) fe.end = "Enter a valid end date.";
        if (res.fieldErrors.sourceRef) fe.sourceRef = "Add a source reference of 3 to 120 characters.";
        setErrors(fe);
      }
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Publish coverage observation"
      width={520}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} pending={pending} pendingLabel="Publishing…">
            Publish observation
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit();
        }}
      >
        <p className="text-sm text-ink-2">
          This is the carrier&apos;s own record of what it applied. It updates the carrier roster and is reconciled against the approved request. Publishing is separate from accepting the record.
        </p>
        <div className="rounded-[10px] border border-line p-4">
          <LabelValue
            cols={2}
            items={[
              { label: "Person", value: `${o.memberName} (${txn.summary.relationship === "self" ? "subscriber" : txn.summary.relationship.replace("_", " ")})` },
              { label: "Benefit", value: o.benefit[0].toUpperCase() + o.benefit.slice(1) },
              { label: "Requested in the file", value: `${txn.summary.action} · ${txn.summary.plan} · ${txn.summary.level} · ${txn.summary.date}` },
              { label: "Callback event ID", value: <span className="font-mono text-xs">{eventId}</span> },
            ]}
          />
        </div>
        {txn.superseded ? (
          <Why>This transaction was superseded by a correction. Publishing now simulates a late, stale callback: it is kept in history and does not overwrite the newer approved data.</Why>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Plan" required>
            {({ id }) => (
              <select id={id} className={inputClass()} value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Coverage level" required>
            {({ id }) => (
              <select id={id} className={inputClass()} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
                {TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Start date" required={o.action !== "terminate"} error={errors.start} hint={o.startDate ? `In the file: ${fmtDate(o.startDate)}` : "Leave empty for an end-of-coverage result."}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="date" aria-describedby={describedBy} aria-invalid={invalid || undefined} className={`${inputClass(invalid)} tabular`} value={start} onChange={(e) => setStart(e.target.value)} />
            )}
          </Field>
          <Field label="End date" required={o.action === "terminate"} error={errors.end} hint={o.endDate ? `In the file: ${fmtDate(o.endDate)}` : "Leave empty while coverage continues."}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="date" aria-describedby={describedBy} aria-invalid={invalid || undefined} className={`${inputClass(invalid)} tabular`} value={end} onChange={(e) => setEnd(e.target.value)} />
            )}
          </Field>
        </div>
        <Field label="Source reference" required error={errors.sourceRef} hint="Observed time is set from the business clock when you publish.">
          {({ id, describedBy, invalid }) => (
            <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={inputClass(invalid)} value={sourceRef} maxLength={120} onChange={(e) => setSourceRef(e.target.value)} />
          )}
        </Field>

        {diffs.length ? (
          <div role="status" className="rounded-[10px] border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-ink">
            The {diffs.join(", ")} differ{diffs.length === 1 ? "s" : ""} from the file. Reconciliation will record a mismatch and pause completion for this line.
          </div>
        ) : (
          <p className="text-[13px] text-muted">Values match the file. Reconciliation should confirm this line.</p>
        )}
        <CommandError result={result} onRetry={() => void submit()} />
      </form>
    </Sheet>
  );
}
