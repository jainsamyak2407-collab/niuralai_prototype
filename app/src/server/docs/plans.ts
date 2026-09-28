import type { Tier } from "@/lib/contracts/domain";
import { GUIDE_SECTIONS } from "@/lib/ai/knowledge";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { PAYSLIP_FIXTURE, payCalendar } from "@/server/config/payroll";
import { CARRIERS, DEDUCTIONS_PER_YEAR, OPEN_ENROLLMENT, PLANS, type Plan, RATE_EFFECTIVE, RATE_VERSION, TIER_LABEL } from "@/server/config/plans";
import { RULE_BY_ID, RULES } from "@/server/config/rules";
import { Pdf } from "./pdf";

// Plan documents generated from the one source of truth (config/plans.ts, rules.ts,
// payroll.ts). Every file is labeled synthetic and illustrative.

const TIERS: Tier[] = ["EE", "ES", "EC", "FAM"];
const ILLUSTRATIVE = "Illustrative Nexa demo configuration. These are invented demonstration terms, not verified Aetna products or pricing. No provider-network, prescription-price, accumulator-transfer or claim-payment guarantee.";

function contributionTable(pdf: Pdf, p: Plan) {
  pdf.table(
    ["Coverage level", "You pay per paycheck", "Nexa pays per paycheck", "Total premium per paycheck", "You pay per full month"],
    TIERS.map((t) => [TIER_LABEL[t], fmtMoney(p.employeeCents[t]), fmtMoney(p.premiumCents[t] - p.employeeCents[t]), fmtMoney(p.premiumCents[t]), fmtMoney(p.employeeCents[t] * 2)]),
    [0.24, 0.19, 0.19, 0.19, 0.19],
  );
}

function planSection(pdf: Pdf, p: Plan) {
  pdf.heading(p.name);
  pdf.kv([
    ["Benefit", p.benefit[0].toUpperCase() + p.benefit.slice(1)],
    ["Carrier (simulated)", CARRIERS.find((c) => c.id === p.carrierId)?.name ?? p.carrierId],
    ["Network", p.network],
    ...p.terms.map((t) => [t.label, t.value] as [string, string]),
  ]);
  pdf.para("Contributions (semi-monthly paychecks)", { bold: true });
  contributionTable(pdf, p);
  if (p.limitations.length) pdf.bullets(p.limitations);
}

const rateLine = `Rate version ${RATE_VERSION}, effective ${fmtDate(RATE_EFFECTIVE.from)} to ${fmtDate(RATE_EFFECTIVE.to)}. ${DEDUCTIONS_PER_YEAR} deductions per year.`;

export async function benefitsGuide() {
  const pdf = await Pdf.create({ title: "Nexa benefits guide (synthetic)", footer: "Nexa benefits guide · version 2026.1 · synthetic demo" });
  pdf.title("Nexa benefits guide", `Version 2026.1 · Plan year 2026 · ${rateLine}`);
  for (const g of GUIDE_SECTIONS) {
    pdf.heading(g.section);
    pdf.para(g.text);
  }
  pdf.heading("Plans at a glance");
  pdf.table(
    ["Plan", "Benefit", "Employee only", "Employee + Children", "Family", "Plan summary"],
    PLANS.map((p) => [p.name, p.benefit, fmtMoney(p.employeeCents.EE), fmtMoney(p.employeeCents.EC), fmtMoney(p.employeeCents.FAM), p.docId]),
    [0.3, 0.1, 0.14, 0.16, 0.12, 0.18],
  );
  pdf.para(`Open enrollment: ${fmtDate(OPEN_ENROLLMENT.window.from)} to ${fmtDate(OPEN_ENROLLMENT.window.to)}; elections start ${fmtDate(OPEN_ENROLLMENT.coverageStarts)}.`);
  pdf.note(ILLUSTRATIVE);
  return pdf.bytes();
}

export async function electionRules() {
  const pdf = await Pdf.create({ title: "Nexa election rules (synthetic)", footer: "Nexa election rules · synthetic demo configuration" });
  pdf.title("Nexa election rules", "Versioned rule configuration used by every decision. Each decision stores a snapshot of the rules it used.");
  pdf.table(
    ["Rule", "Version", "Title", "Source", "Owner", "Effective"],
    RULES.map((r) => [r.id, r.version, r.title, r.source, r.owner, `${fmtDate(r.effectiveFrom)}${r.effectiveTo ? ` to ${fmtDate(r.effectiveTo)}` : " onward"}`]),
    [0.11, 0.08, 0.22, 0.29, 0.15, 0.15],
  );
  for (const r of RULES) {
    pdf.heading(`${r.id} — ${r.title}`);
    pdf.kv([
      ["Version", r.version],
      ["Source", r.source],
      ["Source type", r.sourceKind.replaceAll("_", " ")],
      ["Benefits", r.benefits],
      ["Applies when", r.conditions],
      ["Outcome", r.outcome],
      ["Owner", r.owner],
      ["Approval status", "Approved for demo"],
    ]);
  }
  pdf.note("Nexa settings are synthetic demo assumptions. Federal references are cited for orientation, not as legal advice; no state rule pack is implemented.");
  return pdf.bytes();
}

export async function contributions() {
  const pdf = await Pdf.create({ title: "Nexa contribution schedule (synthetic)", footer: `Contribution schedule · ${RATE_VERSION} · synthetic demo` });
  pdf.title("Contribution schedule", `${rateLine} Amounts are per semi-monthly paycheck.`);
  for (const p of PLANS) {
    pdf.heading(p.name);
    contributionTable(pdf, p);
  }
  pdf.para("Nexa pays the total premium minus the employee contribution. The employee is never charged the entire carrier premium.");
  pdf.note(ILLUSTRATIVE);
  return pdf.bytes();
}

export async function payrollPolicy() {
  const pdf = await Pdf.create({ title: "Nexa payroll policy (synthetic)", footer: "Nexa payroll policy · version 2026.1 · synthetic demo" });
  const pay = RULE_BY_ID.get("R-PAY")!;
  pdf.title("Payroll policy", "Version 2026.1 · Nexa demo configuration, not a universal carrier or legal rule.");
  pdf.heading("Paydays and cutoffs");
  pdf.para("Paydays are the 15th (or the prior business day when the 15th falls on a weekend) and the last business day of the month. Cutoff is 5:00 p.m. ET three calendar days before payday.");
  pdf.table(
    ["Payday", "Period", "Cutoff"],
    payCalendar().map((r) => [fmtDate(r.payday), `${fmtDate(r.periodStart)} to ${fmtDate(r.periodEnd)}`, fmtDateTime(r.cutoffAt)]),
    [0.25, 0.45, 0.3],
  );
  pdf.heading("Deductions and adjustments");
  pdf.bullets([
    `${DEDUCTIONS_PER_YEAR} deductions per year. A full month's employee obligation is the per-paycheck contribution times 2.`,
    "A mid-month change is prorated daily over the actual days in that month. Intermediate values keep full precision; the monthly obligation is rounded once to cents and any residual cent is allocated deterministically.",
    "Catch-up = obligation for the covered period minus deductions actually posted for it. Already scheduled adjustments are never counted twice.",
    "No catch-up is needed when the tier and rate are unchanged or the correct amounts were already collected.",
    "A negative result is a refund proposal, not a payment. Refunds and prior-year corrections need authorization.",
    "Actual deductions change only after matching carrier evidence and an authorized payroll instruction. While the carrier is silent the requested effective date is preserved.",
    "Insufficient wages, a large catch-up or leave create an installment or alternate-collection review. Net pay is never forced negative.",
  ]);
  pdf.kv([
    ["Rule", `${pay.id} v${pay.version} — ${pay.title}`],
    ["Source", pay.source],
    ["Outcome", pay.outcome],
  ]);
  pdf.heading("Payslips");
  pdf.para(PAYSLIP_FIXTURE.note);
  pdf.para("This demo does not calculate live federal or state taxes, does not predict take-home pay from a benefit change, and has no FSA, HSA, imputed-income, garnishment or tax-filing engine. Unknown tax treatment goes to payroll review.");
  return pdf.bytes();
}

export async function planSummary(kind: "doc_medical_standard" | "doc_medical_plus" | "doc_dental_vision") {
  const plans = PLANS.filter((p) => p.docId === kind);
  const title = kind === "doc_dental_vision" ? "Nexa Dental and Vision — illustrative summary" : `${plans[0].name} summary`;
  const pdf = await Pdf.create({ title: `${title} (synthetic)`, footer: `${title} · ${RATE_VERSION} · synthetic demo` });
  pdf.title(title, `${rateLine}`);
  for (const p of plans) planSection(pdf, p);
  if (kind === "doc_dental_vision") pdf.para("A dental benefit maximum is a limit on covered services. It is not a medical out-of-pocket maximum.");
  pdf.note(ILLUSTRATIVE);
  return pdf.bytes();
}
