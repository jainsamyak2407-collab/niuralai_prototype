import { describe, expect, it } from "vitest";
import { timingFor } from "@/server/domain/evaluate";
import { computeAdjustment, monthObligation } from "@/server/domain/payroll";
import { payCalendar } from "@/server/config/payroll";
import { employeeCost } from "@/server/config/plans";
import type { PostedDeduction } from "@/lib/contracts/domain";

describe("request timing (date-only, inclusive through the deadline date)", () => {
  const birth = (dob: string) => ({ children: [{ personId: "k", firstName: "Ava", lastName: "Shah", dob, ssnStatus: "pending" as const }] });
  it("day 30 is the last day; day 31 goes to review", () => {
    expect(timingFor("birth", birth("2026-09-01"), "2026-09-27").status).toBe("within_window");
    expect(timingFor("birth", birth("2026-09-01"), "2026-10-01").status).toBe("last_day");
    const late = timingFor("birth", birth("2026-09-01"), "2026-10-02");
    expect(late.status).toBe("late");
    expect(late.message).toContain("Nexa's standard 30-day request window ended on October 1, 2026");
    expect(late.message).not.toMatch(/ineligible/i);
  });
  it("Medicaid/CHIP uses 60 days, ordinary loss uses 30", () => {
    const f = { coverageEndDate: "2026-08-01" };
    expect(timingFor("medicaid_chip_loss", f, "2026-09-30").status).toBe("last_day"); // day 60
    expect(timingFor("medicaid_chip_loss", f, "2026-10-01").status).toBe("late"); // day 61
    expect(timingFor("loss_of_other_coverage", f, "2026-08-31").status).toBe("last_day"); // day 30
    expect(timingFor("loss_of_other_coverage", f, "2026-09-01").status).toBe("late"); // day 31
  });
  it("future birth cannot be submitted; future loss can be an advance request", () => {
    expect(timingFor("birth", birth("2026-10-10"), "2026-09-27").status).toBe("future_event");
    expect(timingFor("loss_of_other_coverage", { coverageEndDate: "2026-11-10" }, "2026-10-31").status).toBe("advance_request");
  });
  it("unknown coverage end asks for the coverage date, not the last workday", () => {
    const t = timingFor("loss_of_other_coverage", { lastWorkday: "2026-10-12" }, "2026-10-31");
    expect(t.status).toBe("unknown");
    expect(t.message).toContain("may be different from the last day worked");
  });
});

describe("payroll arithmetic (integer cents)", () => {
  it("full month obligation is contribution × 2", () => {
    expect(monthObligation("2026-09", "2026-09-01", 15000, 25000)).toBe(50000);
  });
  it("mid-month proration rounds once", () => {
    // Sep has 30 days; change on the 20th → 19 days old, 11 days new
    expect(monthObligation("2026-09", "2026-09-20", 15000, 25000)).toBe(Math.round((2 * (15000 * 19 + 25000 * 11)) / 30));
  });
  it("birth: September catch-up is $200, not a second premium", () => {
    const runs = payCalendar();
    const ledger: PostedDeduction[] = ["2026-09-15", "2026-09-30"].map((d) => ({ id: d, runId: `run_${d}`, benefit: "medical", kind: "recurring", amountCents: 15000, allocatedMonth: "2026-09" }));
    const target = runs.find((r) => r.payday === "2026-10-15")!;
    const calc = computeAdjustment({ runs, ledger, benefit: "medical", changeDate: "2026-09-01", oldCents: 15000, newCents: 25000, targetRun: target, scheduledOldCents: 15000 });
    expect(calc.adjustmentCents).toBe(20000);
    expect(calc.forecastAssumesScheduled).toBe(false);
  });
  it("before Sep 30 posts, $200 is a labeled forecast", () => {
    const runs = payCalendar();
    const ledger: PostedDeduction[] = [{ id: "a", runId: "run_2026-09-15", benefit: "medical", kind: "recurring", amountCents: 15000, allocatedMonth: "2026-09" }];
    const target = runs.find((r) => r.payday === "2026-10-15")!;
    const calc = computeAdjustment({ runs, ledger, benefit: "medical", changeDate: "2026-09-01", oldCents: 15000, newCents: 25000, targetRun: target, scheduledOldCents: 15000 });
    expect(calc.adjustmentCents).toBe(20000);
    expect(calc.forecastAssumesScheduled).toBe(true);
  });
  it("rate table totals: divorce $450 → $284, loss $166 → $332", () => {
    const fam = employeeCost("aetna_standard", "FAM") + employeeCost("nexa_dental", "FAM") + employeeCost("nexa_vision", "FAM");
    const ec = employeeCost("aetna_standard", "EC") + employeeCost("nexa_dental", "EC") + employeeCost("nexa_vision", "EC");
    const ee = employeeCost("aetna_standard", "EE") + employeeCost("nexa_dental", "EE") + employeeCost("nexa_vision", "EE");
    const es = employeeCost("aetna_standard", "ES") + employeeCost("nexa_dental", "ES") + employeeCost("nexa_vision", "ES");
    expect([fam, ec, ee, es]).toEqual([45000, 28400, 16600, 33200]);
  });
  it("divorce from Oct 1 confirmed before Oct 15: no refund, no catch-up", () => {
    const runs = payCalendar();
    const target = runs.find((r) => r.payday === "2026-10-15")!;
    const calc = computeAdjustment({ runs, ledger: [], benefit: "medical", changeDate: "2026-10-01", oldCents: 40000, newCents: 25000, targetRun: target, scheduledOldCents: 40000 });
    expect(calc.adjustmentCents).toBe(0);
  });
});
