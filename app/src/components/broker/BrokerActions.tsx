"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandError, Field, inputClass } from "@/components/ui/client";
import { useHrCommand } from "@/components/hr/useHrCommand";

type Tier = "EE" | "ES" | "EC" | "FAM";
const TIERS: { id: Tier; label: string }[] = [
  { id: "EE", label: "Employee only" },
  { id: "ES", label: "Employee plus spouse" },
  { id: "EC", label: "Employee plus children" },
  { id: "FAM", label: "Family" },
];

/** Record the carrier-portal submission reference. Submitted is not verified. */
export function RecordSubmissionForm({ taskId }: { taskId: string }) {
  const { run, pending, result, fieldError } = useHrCommand();
  const [reference, setReference] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (reference.trim().length < 3)
      return setLocal("Enter the reference the portal gave you.");
    setLocal(null);
    await run({
      type: "broker.recordSubmission",
      taskId,
      reference: reference.trim(),
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Field
        label="Portal submission reference"
        required
        error={local ?? fieldError("reference")}
        hint="Submitted is not verified. Coverage stays unconfirmed until you record the carrier's result."
      >
        {(a) => (
          <input
            id={a.id}
            aria-describedby={a.describedBy}
            aria-invalid={a.invalid}
            className={`${inputClass(a.invalid)} max-w-sm`}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="PORTAL-58213"
          />
        )}
      </Field>
      <div>
        <Button type="submit" pending={pending} pendingLabel="Recording…">
          Record portal submission
        </Button>
      </div>
      <CommandError result={result} />
    </form>
  );
}

/** Record the carrier's verified result: source, verifier, plan, level and dates. */
export function RecordResultForm({
  taskId,
  plans,
  defaults,
}: {
  taskId: string;
  plans: { id: string; name: string }[];
  defaults: {
    planId: string;
    tier: Tier;
    startDate: string | null;
    endDate: string | null;
  };
}) {
  const { run, pending, result, fieldError } = useHrCommand();
  const [sourceRef, setSourceRef] = useState("");
  const [verifier, setVerifier] = useState("Priya Patel");
  const [planId, setPlanId] = useState(defaults.planId);
  const [tier, setTier] = useState<Tier>(defaults.tier);
  const [startDate, setStartDate] = useState(defaults.startDate ?? "");
  const [endDate, setEndDate] = useState(defaults.endDate ?? "");
  const [local, setLocal] = useState<Record<string, string>>({});
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (sourceRef.trim().length < 3)
      errs.sourceRef =
        "Name where you saw the result (portal screen, confirmation number or call reference).";
    if (verifier.trim().length < 3)
      errs.verifier = "Name the person who verified it.";
    if (!startDate && !endDate)
      errs.startDate =
        "Enter the start date or the end date the carrier shows.";
    setLocal(errs);
    if (Object.keys(errs).length) return;
    await run({
      type: "broker.recordResult",
      taskId,
      sourceRef: sourceRef.trim(),
      verifier: verifier.trim(),
      planId,
      tier,
      startDate: startDate || null,
      endDate: endDate || null,
    });
  };
  const err = (k: string) => local[k] ?? fieldError(k);
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">
        Enter exactly what the carrier record shows, even if it differs from the
        request. The system compares it with the approved change; a difference
        opens an issue for HR.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Source or reference" required error={err("sourceRef")}>
          {(a) => (
            <input
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              className={inputClass(a.invalid)}
              value={sourceRef}
              onChange={(e) => setSourceRef(e.target.value)}
              placeholder="Portal member screen, conf. 77120"
            />
          )}
        </Field>
        <Field label="Verified by" required error={err("verifier")}>
          {(a) => (
            <input
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              className={inputClass(a.invalid)}
              value={verifier}
              onChange={(e) => setVerifier(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Plan on the carrier record"
          required
          error={err("planId")}
        >
          {(a) => (
            <select
              id={a.id}
              aria-describedby={a.describedBy}
              className={inputClass(a.invalid)}
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Coverage level" required error={err("tier")}>
          {(a) => (
            <select
              id={a.id}
              aria-describedby={a.describedBy}
              className={inputClass(a.invalid)}
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
            >
              {TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Start date" error={err("startDate")}>
          {(a) => (
            <input
              type="date"
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              className={inputClass(a.invalid)}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          )}
        </Field>
        <Field label="End date" error={err("endDate")}>
          {(a) => (
            <input
              type="date"
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              className={inputClass(a.invalid)}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div>
        <Button type="submit" pending={pending} pendingLabel="Recording…">
          Record carrier result
        </Button>
      </div>
      <CommandError result={result} />
    </form>
  );
}
