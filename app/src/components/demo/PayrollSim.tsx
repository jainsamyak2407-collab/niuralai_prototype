"use client";

import { useId, useState } from "react";
import { FileCheck2 } from "lucide-react";
import type { Benefit } from "@/lib/contracts/domain";
import { fmtDate, fmtDateLong } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { CommandError, type CommandResponse, Field, inputClass, Sheet, useIntentKey } from "@/components/ui/client";
import { Banner, DateText, EmptyState, Money, Section, StatusPill, Table, Td, Th, THead } from "@/components/ui/primitives";
import { INSTRUCTION } from "./labels";
import { ActionError, ReasonSheet, useSimAction, Why } from "./sim-kit";
import { SimTag, SplitTime } from "./SimFrame";
import type { InstructionRow, PayrollData, RunRow } from "./types";

const BENEFITS: Benefit[] = ["medical", "dental", "vision"];
const cap = (b: string) => b[0].toUpperCase() + b.slice(1);

/** "250" or "250.5" or "1,250.00" → integer cents; null when not a plain USD amount. */
function toCents(raw: string): number | null {
  const v = raw.replace(/,/g, "").trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function PayrollSim({ data }: { data: PayrollData }) {
  const action = useSimAction();
  const [rejecting, setRejecting] = useState<InstructionRow | null>(null);
  const [override, setOverride] = useState<RunRow | null>(null);
  const nextRun = data.runs.filter((r) => r.status === "scheduled").sort((a, b) => a.payday.localeCompare(b.payday))[0] ?? null;
  const runById = new Map(data.runs.map((r) => [r.id, r]));

  return (
    <div className="flex flex-col gap-5">
      <Banner tone="info" title="Applying an instruction is not posting it">
        Apply means the payroll system accepted the instruction for its target run. Nothing reaches a payslip until that run posts. Posted payslips are immutable; any correction goes on a later run.
      </Banner>
      <ActionError action={action} />

      <Section
        title={
          <span className="flex items-center gap-2">
            Authorized instructions <SimTag>Payroll simulator</SimTag>
          </span>
        }
        description="Instructions arrive after the carrier confirms coverage and, when there is a catch-up or refund, after HR authorizes it."
        bodyClassName=""
      >
        {data.instructions.length ? (
          <Table label="Payroll instructions">
            <THead>
              <tr>
                <Th>Case</Th>
                <Th>Benefit</Th>
                <Th>Target run</Th>
                <Th align="right">Recurring per paycheck</Th>
                <Th align="right">Adjustment</Th>
                <Th>State</Th>
                <Th>Actions</Th>
              </tr>
            </THead>
            <tbody>
              {data.instructions.map((i) => (
                <tr key={i.id}>
                  <Td className="whitespace-nowrap">
                    {i.caseNumber}
                    <p className="text-xs text-muted">{i.employeeName}</p>
                  </Td>
                  <Td>{cap(i.benefit)}</Td>
                  <Td className="whitespace-nowrap">
                    <DateText date={i.payday} />
                    <p className="text-xs text-muted">
                      Cutoff <DateText time={i.cutoffAt} />
                    </p>
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    <Money cents={i.previousRecurringCents} /> <span className="text-muted">→</span> <Money cents={i.newRecurringCents} />
                  </Td>
                  <Td align="right">
                    <Money cents={i.adjustmentCents} sign />
                  </Td>
                  <Td>
                    <StatusPill tone={INSTRUCTION[i.state].tone}>{INSTRUCTION[i.state].label}</StatusPill>
                  </Td>
                  <Td className="min-w-[220px]">
                    <InstructionActions i={i} action={action} onReject={() => setRejecting(i)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<FileCheck2 />} title="No payroll instructions yet">
            An instruction appears after the carrier confirms an approved change. Confirm a carrier result in the Carrier inbox first.
          </EmptyState>
        )}
      </Section>

      <Section
        title={
          <span className="flex items-center gap-2">
            Pay runs <SimTag />
          </span>
        }
        description="Maya's semi-monthly runs in the demo calendar. Runs post in order; the clock also posts them on payday at 9:00 a.m. ET."
        bodyClassName=""
      >
        <Table label="Pay runs">
          <THead>
            <tr>
              <Th>Payday</Th>
              <Th>Period</Th>
              <Th>Cutoff</Th>
              <Th>Status</Th>
              <Th align="right">Posted benefit deductions</Th>
              <Th>Actions</Th>
            </tr>
          </THead>
          <tbody>
            {data.runs.map((r) => {
              const isNext = nextRun?.id === r.id;
              const applied = data.instructions.filter((i) => i.targetRunId === r.id && i.state === "instruction_accepted").length;
              return (
                <tr key={r.id} className={isNext ? "bg-canvas" : ""}>
                  <Td className="whitespace-nowrap">
                    <DateText date={r.payday} />
                    {isNext ? <p className="text-xs text-muted">Next run to post</p> : null}
                  </Td>
                  <Td className="tabular whitespace-nowrap">
                    {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <SplitTime iso={r.cutoffAt} />
                  </Td>
                  <Td>
                    <StatusPill tone={r.status === "posted" ? "green" : isNext ? "blue" : "gray"}>{r.status === "posted" ? "Posted" : "Scheduled"}</StatusPill>
                  </Td>
                  <Td align="right">{r.status === "posted" ? <Money cents={r.totalCents} /> : <span className="text-muted">—</span>}</Td>
                  <Td className="min-w-[260px]">
                    {r.status === "posted" ? (
                      <Why>
                        Posted <DateText time={r.postedAt ?? null} />. Immutable.
                      </Why>
                    ) : isNext ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" onClick={() => void action.run(`post:${r.id}`, { type: "ops.payrollPost", runId: r.id })} pending={action.isBusy(`post:${r.id}`)} pendingLabel="Posting…">
                            Post run
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setOverride(r)}>
                            Post with a different amount…
                          </Button>
                        </div>
                        {applied ? (
                          <p className="text-xs text-muted">
                            {applied} applied instruction{applied === 1 ? "" : "s"} will post with this run.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <Why>Post the {nextRun ? fmtDateLong(nextRun.payday, true) : "earlier"} run first.</Why>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Section>

      <Section
        title={
          <span className="flex items-center gap-2">
            Payroll setup <SimTag>Host payroll record</SimTag>
          </span>
        }
        description="What the simulated payroll system will deduct. It changes only when an instruction is applied."
        bodyClassName=""
      >
        <Table label="Payroll setup">
          <THead>
            <tr>
              <Th>Benefit</Th>
              <Th align="right">Current recurring</Th>
              <Th>Pending change</Th>
              <Th>One-time adjustments</Th>
            </tr>
          </THead>
          <tbody>
            {data.setup.map((p) => (
              <tr key={p.benefit}>
                <Td>{cap(p.benefit)}</Td>
                <Td align="right">
                  <Money cents={p.recurringCents} />
                </Td>
                <Td>
                  {p.pending ? (
                    <>
                      <Money cents={p.pending.recurringCents} /> <span className="text-muted">from the {runById.get(p.pending.fromRunId) ? fmtDate(runById.get(p.pending.fromRunId)!.payday) : p.pending.fromRunId} run</span>
                    </>
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </Td>
                <Td>
                  {p.oneTime.length ? (
                    <ul className="flex flex-col gap-0.5">
                      {p.oneTime.map((o) => (
                        <li key={o.instructionId + o.runId}>
                          <Money cents={o.amountCents} sign /> <span className="text-muted">on {runById.get(o.runId) ? fmtDate(runById.get(o.runId)!.payday) : o.runId}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <ReasonSheet
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject payroll instruction"
        intro={rejecting ? `Payroll refuses the ${rejecting.benefit} instruction for ${rejecting.caseNumber}. HR gets a task; coverage confirmation is not affected.` : null}
        label="Rejection reason"
        placeholder="For example: deduction code not set up for this benefit."
        confirmLabel="Reject instruction"
        pendingLabel="Rejecting…"
        tone="destructive"
        submit={(text, key) => action.run(`rej:${rejecting!.id}`, { type: "ops.payrollInstruction", instructionId: rejecting!.id, outcome: "reject", reason: text }, key)}
      />
      {override ? <OverrideSheet run={override} setup={data.setup} onClose={() => setOverride(null)} send={(benefit, amountCents, key) => action.run(`post:${override.id}`, { type: "ops.payrollPost", runId: override.id, override: { benefit, amountCents } }, key)} /> : null}
    </div>
  );
}

function InstructionActions({ i, action, onReject }: { i: InstructionRow; action: ReturnType<typeof useSimAction>; onReject: () => void }) {
  switch (i.state) {
    case "scheduled":
      return (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => void action.run(`apply:${i.id}`, { type: "ops.payrollInstruction", instructionId: i.id, outcome: "accept" })} pending={action.isBusy(`apply:${i.id}`)} pendingLabel="Applying…">
            Apply instruction
          </Button>
          <Button size="sm" variant="destructive" onClick={onReject}>
            Reject…
          </Button>
        </div>
      );
    case "approval_needed":
      return <Why>HR must authorize this adjustment first.</Why>;
    case "instruction_accepted":
      return <Why>Applied. It posts when the {fmtDateLong(i.payday, true)} run posts.</Why>;
    case "posted":
      return (
        <Why>
          Posted {fmtMoney(i.postedCents ?? 0)} recurring{i.postedAdjustmentCents ? ` and ${fmtMoney(i.postedAdjustmentCents, "USD", { sign: true })} adjustment` : ""}. Matches the instruction.
        </Why>
      );
    case "mismatch":
      return (
        <Why>
          {i.rejectedReason
            ? `Rejected: ${i.rejectedReason}. HR has a task.`
            : `Posted ${fmtMoney((i.postedCents ?? 0) + (i.postedAdjustmentCents ?? 0))} instead of ${fmtMoney(i.totalCents)}. HR has a correction task.`}
        </Why>
      );
    case "verified_no_change":
      return <Why>No deduction change needed.</Why>;
    default:
      return <Why>Nothing to apply in this state.</Why>;
  }
}

function OverrideSheet({ run, setup, onClose, send }: { run: RunRow; setup: PayrollData["setup"]; onClose: () => void; send: (b: Benefit, cents: number, key: string) => Promise<CommandResponse> }) {
  const [benefit, setBenefit] = useState<Benefit>("medical");
  const expected = setup.find((p) => p.benefit === benefit);
  const expectedCents = expected ? (expected.pending && expected.pending.fromRunId === run.id ? expected.pending.recurringCents : expected.recurringCents) : 0;
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const intent = useIntentKey();
  const formId = useId();

  async function submit() {
    const cents = toCents(amount);
    if (cents === null) {
      setError("Enter an amount in US dollars, such as 200 or 200.00.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await send(benefit, cents, intent.key);
    setBusy(false);
    if (res.ok) {
      intent.reset();
      onClose();
    } else setResult(res);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Post the ${fmtDateLong(run.payday, true)} run with a different amount`}
      width={480}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} pending={busy} pendingLabel="Posting…">
            Post run
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-sm text-ink-2">
          Simulates payroll posting a result that differs from the instruction. The amount replaces the benefit&apos;s recurring deduction on this run and drops its one-time adjustment. Reconciliation should flag the difference; the posted payslip cannot be edited afterwards.
        </p>
        <Field label="Benefit" required>
          {({ id }) => (
            <select id={id} className={inputClass()} value={benefit} onChange={(e) => setBenefit(e.target.value as Benefit)}>
              {BENEFITS.map((b) => (
                <option key={b} value={b}>
                  {cap(b)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Posted recurring amount (USD)" required error={error} hint={`Expected on this run: ${fmtMoney(expectedCents)}.`}>
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">USD</span>
              <input id={id} inputMode="decimal" aria-describedby={describedBy} aria-invalid={invalid || undefined} className={`${inputClass(invalid)} tabular pl-12`} value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}
        </Field>
        <CommandError result={result} onRetry={() => void submit()} />
      </form>
    </Sheet>
  );
}
