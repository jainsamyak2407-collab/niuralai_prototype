import type { Benefit, Cents, PayRun, PayrollForecast, PayrollInstruction, PostedDeduction, ScenarioState } from "@/lib/contracts/domain";
import { daysInMonth, fmtDateLong, fmtMonth, monthOf, nextMonth } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";

// Nexa demo payroll policy (synthetic):
// - Full month obligation = per-paycheck contribution × 2.
// - Mid-month change: daily proration over the actual days in the month, intermediate
//   precision kept, final monthly obligation rounded once to cents.
// - Catch-up = obligation − deductions actually posted (and, before a run posts, a
//   clearly-labeled forecast that assumes the scheduled old amount posts).

/** Monthly obligation in cents for a month where `oldCents` applies before `changeDate` and `newCents` from it. */
export function monthObligation(ym: string, changeDate: string, oldCents: Cents, newCents: Cents): Cents {
  const dim = daysInMonth(ym);
  const first = `${ym}-01`;
  let newDays: number;
  if (changeDate <= first) newDays = dim;
  else if (monthOf(changeDate) !== ym) newDays = changeDate > first ? 0 : dim;
  else newDays = dim - (Number(changeDate.slice(8, 10)) - 1);
  const oldDays = dim - newDays;
  // numerator in cents × days; divide by dim once, round once (half-up)
  const numerator = 2 * (oldCents * oldDays + newCents * newDays);
  return Math.round(numerator / dim);
}

export function targetRunFor(runs: PayRun[], nowIso: string, changeDate: string): PayRun | null {
  return (
    runs
      .filter((r) => r.status === "scheduled" && r.cutoffAt > nowIso && r.periodEnd >= changeDate)
      .sort((a, b) => a.payday.localeCompare(b.payday))[0] ?? null
  );
}

export interface AdjustmentCalc {
  targetRun: PayRun;
  adjustmentCents: Cents;
  lines: { month: string; obligationCents: Cents; collectedCents: Cents; laterRecurringCents: Cents }[];
  forecastAssumesScheduled: boolean;
  basis: string;
  needsReview: boolean; // change reaches back before the payroll history on file
}

/**
 * Compute the one-time adjustment for one benefit.
 * `priorAdjustmentsCents` = adjustments already posted or scheduled for this case and
 * benefit, so a repeat calculation never counts them twice.
 */
export function computeAdjustment(args: {
  runs: PayRun[];
  ledger: PostedDeduction[];
  benefit: Benefit;
  changeDate: string;
  oldCents: Cents;
  newCents: Cents;
  targetRun: PayRun;
  scheduledOldCents: Cents; // amount the payroll system will deduct on unposted runs before the target
  priorAdjustmentsCents?: Cents;
}): AdjustmentCalc {
  const { runs, ledger, benefit, changeDate, oldCents, newCents, targetRun, scheduledOldCents } = args;
  const lastMonth = monthOf(targetRun.periodStart);
  let m = monthOf(changeDate);
  const lines: AdjustmentCalc["lines"] = [];
  let total = 0;
  let forecast = false;
  if (m > lastMonth) {
    return { targetRun, adjustmentCents: 0, lines, forecastAssumesScheduled: false, basis: "No affected pay run before the target run. No catch-up needed.", needsReview: false };
  }
  const historyStart = ledger.filter((d) => d.benefit === benefit).map((d) => d.allocatedMonth).sort()[0];
  if (historyStart && m < historyStart && oldCents !== newCents) {
    return {
      targetRun,
      adjustmentCents: 0,
      lines,
      forecastAssumesScheduled: false,
      needsReview: true,
      basis: `The change reaches back to ${fmtMonth(m)}, before the payroll history on file. Payroll review required: no automatic catch-up or refund. Carrier premium credit, employee refund, claims and prior-year tax effects are reviewed separately.`,
    };
  }
  while (m <= lastMonth) {
    const obligation = monthObligation(m, changeDate, oldCents, newCents);
    const collected = ledger
      .filter((d) => d.benefit === benefit && d.kind === "recurring" && d.allocatedMonth === m)
      .reduce((a, d) => a + d.amountCents, 0);
    const monthRuns = runs.filter((r) => monthOf(r.periodStart) === m);
    let scheduledBefore = 0;
    let later = 0;
    for (const r of monthRuns) {
      const posted = ledger.some((d) => d.runId === r.id && d.benefit === benefit && d.kind === "recurring");
      if (posted) continue;
      if (r.payday < targetRun.payday) {
        scheduledBefore += scheduledOldCents;
        forecast = true;
      } else later += newCents;
    }
    const collectedAll = collected + scheduledBefore;
    lines.push({ month: m, obligationCents: obligation, collectedCents: collectedAll, laterRecurringCents: later });
    total += obligation - collectedAll - later;
    m = nextMonth(m);
  }
  const adjustment = total - (args.priorAdjustmentsCents ?? 0);
  const parts = lines
    .map((l) => `${fmtMonth(l.month)}: owed ${fmtMoney(l.obligationCents)} − collected ${fmtMoney(l.collectedCents)}${l.laterRecurringCents ? ` − new recurring ${fmtMoney(l.laterRecurringCents)}` : ""}`)
    .join("; ");
  const basis =
    adjustment === 0
      ? `No catch-up needed. ${parts}.`
      : `${adjustment > 0 ? "Catch-up" : "Refund proposal"} ${fmtMoney(Math.abs(adjustment))} on ${fmtDateLong(targetRun.payday, true)}. ${parts}.${forecast ? " Forecast: assumes the scheduled deduction at the old amount posts; recalculated from the posted ledger before authorization." : ""}`;
  return { targetRun, adjustmentCents: adjustment, lines, forecastAssumesScheduled: forecast, basis, needsReview: false };
}

export function priorAdjustments(s: ScenarioState, caseId: string, benefit: Benefit, excludeId?: string): Cents {
  return s.instructions
    .filter((i) => i.caseId === caseId && i.benefit === benefit && i.id !== excludeId && !["mismatch", "blocked", "preview"].includes(i.state) && !i.rejectedReason)
    .reduce((a, i) => a + i.adjustmentCents, 0);
}

export function forecastFor(s: ScenarioState, benefit: Benefit, changeDate: string, oldCents: Cents, newCents: Cents, caseId?: string): PayrollForecast | null {
  const run = targetRunFor(s.payRuns, s.clock.businessNow, changeDate);
  if (!run) return null;
  const setup = s.payrollSetup.find((p) => p.benefit === benefit);
  const calc = computeAdjustment({
    runs: s.payRuns,
    ledger: s.ledger,
    benefit,
    changeDate,
    oldCents,
    newCents,
    targetRun: run,
    scheduledOldCents: setup?.recurringCents ?? oldCents,
    priorAdjustmentsCents: caseId ? priorAdjustments(s, caseId, benefit) : 0,
  });
  return { targetRunId: run.id, targetPayday: run.payday, newRecurringCents: newCents, adjustmentCents: calc.adjustmentCents, basis: calc.basis, forecastAssumesScheduled: calc.forecastAssumesScheduled };
}

export function instructionTotal(i: PayrollInstruction): Cents {
  return i.newRecurringCents + i.adjustmentCents;
}
