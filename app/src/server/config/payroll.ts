import type { PayRun } from "@/lib/contracts/domain";
import { addDays, zonedToUtc } from "@/lib/dates";

// Explicit synthetic pay calendar: paydays on the 15th (or the prior business day when
// the 15th falls on a weekend) and the last business day of the month. Cutoff is
// 5:00 p.m. ET three calendar days before payday. Nexa demo configuration.
const PAYDAYS: [string, string, string][] = [
  ["2026-08-14", "2026-08-01", "2026-08-15"],
  ["2026-08-31", "2026-08-16", "2026-08-31"],
  ["2026-09-15", "2026-09-01", "2026-09-15"],
  ["2026-09-30", "2026-09-16", "2026-09-30"],
  ["2026-10-15", "2026-10-01", "2026-10-15"],
  ["2026-10-30", "2026-10-16", "2026-10-31"],
  ["2026-11-13", "2026-11-01", "2026-11-15"],
  ["2026-11-30", "2026-11-16", "2026-11-30"],
  ["2026-12-15", "2026-12-01", "2026-12-15"],
  ["2026-12-31", "2026-12-16", "2026-12-31"],
];

export function payCalendar(): PayRun[] {
  return PAYDAYS.map(([payday, periodStart, periodEnd]) => ({
    id: `run_${payday}`,
    payday,
    periodStart,
    periodEnd,
    cutoffAt: zonedToUtc(addDays(payday, -3), "17:00"),
    status: "scheduled",
  }));
}

// Illustrative payslip fixture for Maya. Withholding values are fixed synthetic numbers
// from the payroll simulator, not a live tax calculation.
export const PAYSLIP_FIXTURE = {
  annualSalaryCents: 13_200_000,
  grossPerRunCents: 550_000,
  retirementPct: 6,
  retirementCents: 33_000,
  withholding: [
    { label: "Federal income tax (illustrative)", cents: 71_250 },
    { label: "Social Security (illustrative)", cents: 32_860 },
    { label: "Medicare (illustrative)", cents: 7_685 },
    { label: "New York State income tax (illustrative)", cents: 26_240 },
  ],
  note: "Withholding is a fixed synthetic payroll-simulator fixture. It is not recalculated when benefits change.",
};

export const BATCH_CUTOFF = "21:45";
export const BATCH_SEND = "22:00";
