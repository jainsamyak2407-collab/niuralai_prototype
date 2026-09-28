import type { DemoUser, QleCase, ScenarioId, ScenarioState } from "@/lib/contracts/domain";
import { SYNTHETIC_LABEL } from "@/lib/contracts/documents";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { ownerName } from "@/server/config/identities";
import { PAYSLIP_FIXTURE } from "@/server/config/payroll";
import { PLAN_BY_ID, TIER_LABEL } from "@/server/config/plans";
import { EVENT_LABEL, RULE_BY_ID } from "@/server/config/rules";
import { DomainError } from "@/server/domain/ctx";
import { build834, decodeOrder, EDI_LABEL, insReasons, sha256 } from "@/server/domain/edi";
import { personName } from "@/server/domain/evaluate";
import { auditView, employeeBenefitsView, loadState, payslip } from "@/server/views";
import { Pdf } from "./pdf";

// Case, payroll, carrier and continuation documents. Read-only: state is loaded once and
// filtered by the session role here, on the server. Nothing a role may not see is rendered.

export interface DocFile {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
}

const planName = (id: string) => PLAN_BY_ID.get(id)?.shortName ?? id;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const ACTION: Record<string, string> = { add: "Add", terminate: "End coverage", tier_change: "Change coverage level" };

function forbidden(message = "Your role cannot open this document."): never {
  throw new DomainError(403, "forbidden", message);
}
function notFound(message: string): never {
  throw new DomainError(404, "not_found", message);
}

/** Employee: own case. HR: same employer, not a draft. Everyone else: forbidden. */
function scopedCase(s: ScenarioState, user: DemoUser, caseId: string | null): QleCase {
  if (!caseId) throw new DomainError(400, "case_required", "Choose a request first.");
  if (user.role !== "employee" && user.role !== "hr_admin") forbidden();
  const c = s.cases.find((x) => x.id === caseId);
  if (!c) notFound("We could not find that request.");
  if (user.role === "employee" && c.employeeId !== user.personId) notFound("We could not find that request.");
  if (user.role === "hr_admin" && (c.employerId !== user.employerId || c.status === "draft")) notFound("We could not find that request.");
  return c;
}

function header(pdf: Pdf, c: QleCase, s: ScenarioState) {
  pdf.kv([
    ["Request", c.caseNumber],
    ["Employee", c.employeeName],
    ["Event", EVENT_LABEL[c.eventCode]],
    ["Generated", `${fmtDateTime(s.clock.businessNow)} (demo business time)`],
  ]);
}

async function pdfFile(pdf: Pdf, fileName: string): Promise<DocFile> {
  return { bytes: await pdf.bytes(), contentType: "application/pdf", fileName };
}

export async function electionStatement(user: DemoUser, scenario: ScenarioId): Promise<DocFile> {
  if (user.role !== "employee") forbidden("Only the employee can download their election statement.");
  const v = await employeeBenefitsView(user, scenario);
  const pdf = await Pdf.create({ title: "Current election statement (synthetic)", footer: `Election statement · ${v.person.name} · as of ${fmtDate(v.today)} · synthetic demo` });
  pdf.title("Current election statement", `${v.person.name} · as of ${fmtDate(v.today)} (${scenario} scenario)`);
  pdf.table(
    ["Benefit", "Plan", "Coverage level", "Covered people", "You pay per paycheck", "Nexa pays per paycheck", "Effective"],
    v.current.map((e) => [cap(e.benefit), e.planName, e.tierLabel, e.covered.join(", "), fmtMoney(e.employeeCents), fmtMoney(e.employerCents), `${fmtDate(e.effectiveFrom)}${e.effectiveTo ? ` to ${fmtDate(e.effectiveTo)}` : " onward"}`]),
    [0.1, 0.18, 0.14, 0.18, 0.13, 0.13, 0.14],
  );
  if (v.future.length) {
    pdf.heading("Confirmed future changes");
    pdf.table(
      ["Benefit", "Plan", "Coverage level", "Covered people", "You pay per paycheck", "Starts"],
      v.future.map((e) => [cap(e.benefit), e.planName, e.tierLabel, e.covered.join(", "), fmtMoney(e.employeeCents), fmtDate(e.effectiveFrom)]),
      [0.12, 0.2, 0.16, 0.22, 0.15, 0.15],
    );
  }
  const total = v.current.reduce((a, e) => a + e.employeeCents, 0);
  pdf.kv([["Total you pay per paycheck", fmtMoney(total)]]);
  if (v.pending.length) pdf.para(`Pending requests (not yet in effect): ${v.pending.map((p) => `${p.caseNumber} ${p.event} — ${p.statusLabel.label}`).join("; ")}.`, { muted: true });
  pdf.note("Shows confirmed coverage from the host platform record. A pending request or an approval is not carrier confirmation.");
  return pdfFile(pdf, `election-statement-${scenario}.pdf`);
}

export async function receipt(user: DemoUser, scenario: ScenarioId, caseId: string | null): Promise<DocFile> {
  const s = await loadState(scenario);
  const c = scopedCase(s, user, caseId);
  if (!c.receipt) notFound("This request has not been submitted yet, so there is no receipt.");
  const r = c.receipt;
  const rev = c.revisions.find((x) => x.revisionNo === r.revisionNo) ?? c.revisions.at(-1);
  const pdf = await Pdf.create({ title: `Request receipt ${c.caseNumber} (synthetic)`, footer: `Receipt ${c.caseNumber} · revision ${r.revisionNo} · synthetic demo` });
  pdf.title("Request receipt", `${c.caseNumber} · ${r.kind === "review_request" ? "Review request" : "Election request"}`);
  header(pdf, c, s);
  pdf.kv([
    ["Received (controlling time)", fmtDateTime(r.receivedAt)],
    ["Submitted version", `Revision ${r.revisionNo}`],
    ["Timing at receipt", r.timingAtReceipt.replaceAll("_", " ")],
    ["Record fingerprint", r.hash],
  ]);
  if (rev) {
    const ev = rev.evaluation;
    pdf.heading("Requested changes");
    pdf.table(
      ["Person", "Benefit", "Change", "Plan", "Coverage level", "Date"],
      ev.proposedLines.map((l) => [personName(s, l.personId, c), cap(l.benefit), ACTION[l.action], planName(l.planId), TIER_LABEL[l.tierAfter], l.action === "terminate" ? `Ends ${fmtDate(l.endDate)}` : `Starts ${fmtDate(l.startDate)}`]),
      [0.2, 0.12, 0.18, 0.18, 0.16, 0.16],
    );
    if (ev.costs.length) {
      pdf.heading("Estimated contribution per paycheck");
      pdf.table(
        ["Benefit", "Before", "After"],
        ev.costs.map((x) => [cap(x.benefit), `${planName(x.planBefore)} ${TIER_LABEL[x.tierBefore]} · ${fmtMoney(x.beforeCents)}`, `${planName(x.planAfter)} ${TIER_LABEL[x.tierAfter]} · ${fmtMoney(x.afterCents)}`]),
        [0.2, 0.4, 0.4],
      );
      pdf.kv([["Total per paycheck", `${fmtMoney(ev.totalBeforeCents)} before · ${fmtMoney(ev.totalAfterCents)} after`]]);
    }
    pdf.para(`Request window: ${ev.timing.message}`);
  }
  pdf.note("This receipt confirms that the request was received. It is not an approval, not carrier confirmation and not a payroll posting. An estimate is not a deduction.");
  return pdfFile(pdf, `receipt-${c.caseNumber}.pdf`);
}

export async function approvalSummary(user: DemoUser, scenario: ScenarioId, caseId: string | null): Promise<DocFile> {
  const s = await loadState(scenario);
  const c = scopedCase(s, user, caseId);
  const active = c.approvals.filter((a) => !a.supersededAt).at(-1);
  if (!active) notFound(c.approvals.length ? "The earlier approval was superseded. A new version needs approval." : "This request has not been approved yet.");
  const pdf = await Pdf.create({ title: `Approved election summary ${c.caseNumber} (synthetic)`, footer: `Approval ${active.id} · ${c.caseNumber} · revision ${active.revisionNo} · synthetic demo` });
  pdf.title("Approved election summary", `${c.caseNumber} · approval ${active.id}`);
  header(pdf, c, s);
  pdf.kv([
    ["Approved", fmtDateTime(active.at)],
    ["Approved version", `Revision ${active.revisionNo} (fingerprint ${active.hash})`],
    ...(user.role === "hr_admin" ? ([["Approved by", ownerName(active.actor)]] as [string, string][]) : []),
  ]);
  pdf.heading("Approved changes (frozen at approval)");
  pdf.table(
    ["Person", "Benefit", "Change", "Plan", "Coverage level", "Date"],
    active.lines.map((l) => [personName(s, l.personId, c), cap(l.benefit), ACTION[l.action], planName(l.planId), TIER_LABEL[l.tierAfter], l.action === "terminate" ? `Ends ${fmtDate(l.endDate)}` : `Starts ${fmtDate(l.startDate)}`]),
    [0.2, 0.12, 0.18, 0.18, 0.16, 0.16],
  );
  pdf.heading("Rule snapshot");
  pdf.table(
    ["Rule", "Version", "Title"],
    active.ruleSnapshot.map((r) => [r.id, r.version, RULE_BY_ID.get(r.id)?.title ?? "—"]),
    [0.2, 0.15, 0.65],
  );
  const superseded = c.approvals.filter((a) => a.supersededAt);
  if (superseded.length) pdf.para(`Earlier approvals superseded: ${superseded.map((a) => `${a.id} (revision ${a.revisionNo}) — ${a.supersededReason ?? "superseded"}`).join("; ")}.`, { muted: true });
  pdf.note("Approval authorizes sending the change. The carrier's record, not this approval, confirms coverage.");
  return pdfFile(pdf, `approval-${c.caseNumber}.pdf`);
}

export async function carrierResult(user: DemoUser, scenario: ScenarioId, caseId: string | null): Promise<DocFile> {
  const s = await loadState(scenario);
  const c = scopedCase(s, user, caseId);
  if (!c.lines.length) notFound("There is no carrier result yet. The change has not been approved and sent.");
  const hr = user.role === "hr_admin";
  const pdf = await Pdf.create({ title: `Carrier result summary ${c.caseNumber} (synthetic)`, footer: `Carrier result · ${c.caseNumber} · simulated carriers · synthetic demo` });
  pdf.title("Carrier result summary", `${c.caseNumber} · simulated carrier responses`);
  header(pdf, c, s);
  const STATE: Record<string, string> = { awaiting_confirmation: "Waiting for carrier", confirmed_future: "Confirmed (future start)", confirmed_current: "Confirmed", end_confirmed: "End confirmed", mismatch: hr ? "Mismatch" : "Being corrected" };
  pdf.table(
    ["Person", "Benefit", "Requested", "Carrier record", "Result"],
    c.lines.map((l) => {
      const obs = s.observations.find((o) => o.id === l.observationId);
      const requested = `${ACTION[l.action]} · ${planName(l.planId)} ${TIER_LABEL[l.tierAfter]} · ${l.action === "terminate" ? `ends ${fmtDate(l.endDate)}` : `starts ${fmtDate(l.startDate)}`}`;
      const observed = obs ? `${planName(obs.planId)} ${TIER_LABEL[obs.tier]} · ${obs.endDate ? `ends ${fmtDate(obs.endDate)}` : `starts ${fmtDate(obs.startDate)}`} (${obs.sourceRef}, ${fmtDateTime(obs.observedAt)})` : "No carrier record yet";
      return [personName(s, l.personId, c), cap(l.benefit), requested, observed, `${STATE[l.coverageState] ?? l.coverageState}${obs ? ` — ${obs.outcome === "matched" ? "match" : obs.outcome === "mismatch" ? "mismatch" : "stale, ignored"}` : ""}`];
    }),
    [0.14, 0.1, 0.28, 0.32, 0.16],
  );
  if (hr) {
    const issues = c.lines.filter((l) => l.mismatch);
    if (issues.length) {
      pdf.heading("Mismatches");
      pdf.bullets(issues.map((l) => `${personName(s, l.personId, c)} ${l.benefit}: ${l.mismatch!.field} expected ${l.mismatch!.expected}, carrier shows ${l.mismatch!.observed}. ${l.mismatch!.message}`));
    }
  } else if (c.lines.some((l) => l.coverageState === "mismatch")) {
    pdf.para("We are correcting a provider response. No action is needed from you right now.");
  }
  pdf.note("Carriers are simulated. A carrier record confirms coverage for the dates shown; missing confirmation is not a finding that no coverage exists.");
  return pdfFile(pdf, `carrier-result-${c.caseNumber}.pdf`);
}

export async function payrollStatement(user: DemoUser, scenario: ScenarioId, caseId: string | null): Promise<DocFile> {
  const s = await loadState(scenario);
  const c = scopedCase(s, user, caseId);
  const inst = s.instructions.filter((i) => i.caseId === c.id);
  if (!inst.length) notFound("There is no payroll change for this request yet.");
  const pdf = await Pdf.create({ title: `Payroll change statement ${c.caseNumber} (synthetic)`, footer: `Payroll change statement · ${c.caseNumber} · simulated payroll · synthetic demo` });
  pdf.title("Payroll change statement", `${c.caseNumber} · simulated payroll`);
  header(pdf, c, s);
  pdf.table(
    ["Benefit", "Status", "Previous per paycheck", "New per paycheck", "One-time adjustment", "Target payday", "Posted"],
    inst.map((i) => {
      const run = s.payRuns.find((r) => r.id === i.targetRunId);
      const posted = i.postedCents !== undefined ? `${fmtMoney(i.postedCents)}${i.postedAdjustmentCents ? ` incl. ${fmtMoney(i.postedAdjustmentCents)} adjustment` : ""}` : "Not posted";
      return [cap(i.benefit), i.state.replaceAll("_", " "), fmtMoney(i.previousRecurringCents), fmtMoney(i.newRecurringCents), fmtMoney(i.adjustmentCents, "USD", { sign: true }), run ? fmtDate(run.payday) : "—", posted];
    }),
    [0.1, 0.15, 0.14, 0.13, 0.14, 0.14, 0.2],
  );
  pdf.heading("How adjustments were calculated");
  pdf.bullets(inst.map((i) => `${cap(i.benefit)}: ${i.adjustmentBasis}`));
  const monthly = inst.flatMap((i) => i.calcLines.map((l) => [cap(i.benefit), l.month, fmtMoney(l.obligationCents), fmtMoney(l.collectedCents), fmtMoney(l.laterRecurringCents)]));
  if (monthly.length) pdf.table(["Benefit", "Month", "Obligation", "Collected", "Later recurring"], monthly, [0.16, 0.16, 0.22, 0.22, 0.24]);
  const ledger = s.ledger.filter((d) => inst.some((i) => i.id === d.instructionId));
  if (ledger.length) {
    pdf.heading("Posted deductions from these instructions");
    pdf.table(["Payday", "Benefit", "Kind", "Amount", "Allocated month"], ledger.map((d) => [fmtDate(s.payRuns.find((r) => r.id === d.runId)?.payday ?? null), cap(d.benefit), d.kind, fmtMoney(d.amountCents), d.allocatedMonth]), [0.2, 0.15, 0.2, 0.2, 0.25]);
  }
  pdf.note("A negative adjustment is a refund proposal, not a payment. Deductions change only after carrier confirmation and an authorized payroll instruction.");
  return pdfFile(pdf, `payroll-change-${c.caseNumber}.pdf`);
}

function batchFor(s: ScenarioState, user: DemoUser, batchId: string | null) {
  if (!["hr_admin", "carrier_operator", "demo_operator"].includes(user.role)) forbidden("Only HR and the carrier or demo operator can open 834 files.");
  const batch = batchId ? s.batches.find((b) => b.id === batchId) : s.batches.at(-1);
  if (!batch) notFound(batchId ? "We could not find that batch." : "No 834 batch has been sent yet.");
  const txns = batch.txnIds.map((id) => s.txns.find((t) => t.id === id)).filter((t) => !!t);
  if (user.role === "hr_admin" && !txns.some((t) => s.cases.find((c) => c.id === t.caseId)?.employerId === user.employerId)) notFound("We could not find that batch.");
  return { batch, txns };
}

export async function edi834(user: DemoUser, scenario: ScenarioId, batchId: string | null): Promise<DocFile> {
  const s = await loadState(scenario);
  const { batch, txns } = batchFor(s, user, batchId);
  const payload = build834(batch, txns.map((t) => t.order), insReasons(s.cases));
  const text = `${EDI_LABEL}. ${SYNTHETIC_LABEL}. This label line is not part of the payload; payload sha256 ${sha256(payload)}.\n${payload}\n`;
  return { bytes: new TextEncoder().encode(text), contentType: "text/plain; charset=utf-8", fileName: `illustrative-834-${batch.id}.edi` };
}

export async function ediSummary(user: DemoUser, scenario: ScenarioId, batchId: string | null): Promise<DocFile> {
  const s = await loadState(scenario);
  const { batch, txns } = batchFor(s, user, batchId);
  const payload = build834(batch, txns.map((t) => t.order), insReasons(s.cases));
  const hash = sha256(payload);
  const pdf = await Pdf.create({ title: `834 batch summary ${batch.id} (synthetic)`, footer: `${EDI_LABEL} · ${batch.id} · synthetic demo` });
  pdf.title("Illustrative 834 batch summary", `${EDI_LABEL} · batch ${batch.id}`);
  pdf.kv([
    ["Control number", batch.controlNumber],
    ["Queued", fmtDateTime(batch.queuedAt)],
    ["Sent", fmtDateTime(batch.sentAt)],
    ["Transport", batch.transport.replaceAll("_", " ")],
    ["File validation", `${batch.fileValidation}${batch.fileReason ? ` — ${batch.fileReason}` : ""}`],
    ["Member records", String(batch.recordCount)],
    ["Payload sha256", hash],
    ["Matches the sent payload", hash === batch.payloadHash ? "Yes" : "No — rebuilt payload differs from the recorded hash"],
  ]);
  pdf.table(
    ["Request", "Member", "Change", "Plan", "Level", "Date", "Member result"],
    txns.map((t) => {
      const d = decodeOrder(t.order);
      return [t.order.caseNumber, `${d.member} (${d.relationship.replace("_", " ")})`, d.action, d.plan, d.level, d.date, `${t.memberResult}${t.memberReason ? ` — ${t.memberReason}` : ""}`];
    }),
    [0.13, 0.19, 0.14, 0.13, 0.14, 0.13, 0.14],
  );
  pdf.note("Demo subset of the 834 format (ISA/GS/ST envelopes, member loops, SE/GE/IEA counts). Not carrier-certified. No documents or SSNs are included in the payload.");
  return pdfFile(pdf, `illustrative-834-summary-${batch.id}.pdf`);
}

export async function payslipDoc(user: DemoUser, scenario: ScenarioId, runId: string | null): Promise<DocFile> {
  if (user.role !== "employee" && user.role !== "hr_admin") forbidden("Only the employee and HR can open payslips.");
  const s = await loadState(scenario);
  const posted = s.payRuns.filter((r) => r.status === "posted").sort((a, b) => a.payday.localeCompare(b.payday));
  const run = runId ? s.payRuns.find((r) => r.id === runId) : posted.at(-1);
  if (!run) notFound("We could not find that payroll run.");
  if (run.status !== "posted") notFound("This payroll run has not posted yet, so there is no payslip.");
  const p = payslip(s, run);
  const caseRun = s.instructions.some((i) => i.targetRunId === run.id);
  // Totals must add up; refuse to render a payslip that does not.
  const benefitSum = p.benefits.reduce((a, b) => a + b.recurringCents + b.adjustmentCents, 0);
  const taxSum = p.withholding.reduce((a, w) => a + w.cents, 0);
  if (benefitSum !== p.benefitTotalCents || taxSum !== p.taxTotalCents || p.grossCents - benefitSum - p.retirementCents - taxSum !== p.netCents) {
    throw new DomainError(422, "payslip_mismatch", "This payslip's totals do not add up, so it was not generated. Payroll review is needed.");
  }
  const pdf = await Pdf.create({ title: `Simulated payslip ${run.payday} (synthetic)`, footer: `Simulated payslip · ${fmtDate(run.payday)} · withholding is an illustrative fixture · synthetic demo` });
  const self = s.people.find((x) => x.relationship === "self");
  pdf.title("Simulated payslip", `${self ? `${self.firstName} ${self.lastName}` : "Employee"} · payday ${fmtDate(run.payday)} · period ${fmtDate(run.periodStart)} to ${fmtDate(run.periodEnd)}`);
  pdf.kv([
    ["Status", caseRun ? "Posted simulated payslip (includes an approved benefit change)" : "Historical posted payslip (immutable)"],
    ["Posted", fmtDateTime(p.postedAt)],
  ]);
  pdf.table(["Earnings", "Amount"], [["Regular salary (semi-monthly)", fmtMoney(p.grossCents)], ["Gross pay", fmtMoney(p.grossCents)]], [0.7, 0.3]);
  pdf.table(
    ["Benefit deductions (pre-tax)", "Amount"],
    [
      ...p.benefits.flatMap((b) => [[`${cap(b.benefit)} — regular`, fmtMoney(b.recurringCents)], ...(b.adjustmentCents ? [[`${cap(b.benefit)} — one-time adjustment`, fmtMoney(b.adjustmentCents)]] : [])]),
      ["Total benefit deductions", fmtMoney(p.benefitTotalCents)],
    ],
    [0.7, 0.3],
  );
  pdf.table(["Retirement", "Amount"], [[`401(k) contribution (${PAYSLIP_FIXTURE.retirementPct}%)`, fmtMoney(p.retirementCents)]], [0.7, 0.3]);
  pdf.table(["Withholding (illustrative fixture)", "Amount"], [...p.withholding.map((w) => [w.label, fmtMoney(w.cents)]), ["Total withholding", fmtMoney(p.taxTotalCents)]], [0.7, 0.3]);
  pdf.kv([
    ["Gross pay", fmtMoney(p.grossCents)],
    ["Less benefit deductions", fmtMoney(p.benefitTotalCents)],
    ["Less retirement", fmtMoney(p.retirementCents)],
    ["Less withholding", fmtMoney(p.taxTotalCents)],
    ["Net pay", fmtMoney(p.netCents)],
  ]);
  pdf.note(`${PAYSLIP_FIXTURE.note} This demo does not calculate live taxes or predict take-home pay from a benefit change.`);
  return pdfFile(pdf, `payslip-${run.payday}.pdf`);
}

export async function cobraReferral(user: DemoUser, scenario: ScenarioId, referralId: string | null): Promise<DocFile> {
  if (!["hr_admin", "cobra_admin", "demo_operator"].includes(user.role)) forbidden("Continuation referrals are available to HR and the continuation administrator only.");
  if (!referralId) throw new DomainError(400, "referral_required", "Choose a referral first.");
  const s = await loadState(scenario);
  const r = s.cobra.find((x) => x.id === referralId);
  const c = r ? s.cases.find((x) => x.id === r.caseId) : undefined;
  if (!r || !c || (user.role === "hr_admin" && c.employerId !== user.employerId)) notFound("We could not find that referral.");
  const admin = user.role === "cobra_admin" || user.role === "demo_operator";
  const pdf = await Pdf.create({ title: `Continuation referral ${r.id} (synthetic)`, footer: `Continuation referral ${r.id} · not a COBRA notice · synthetic demo` });
  pdf.title("Continuation coverage referral", `Minimal referral to the continuation administrator (simulated) · ${r.id}`);
  pdf.kv([
    ["Employer", "Nexa (synthetic)"],
    ["Request", c.caseNumber],
    ["Beneficiary", r.beneficiaryName],
    ["Qualifying event", r.qualifyingEvent],
    ["Event date", r.eventDate ? fmtDate(r.eventDate) : "Deadline needs verification"],
    ["Coverage loss date", r.coverageLossDate ? fmtDate(r.coverageLossDate) : "Deadline needs verification"],
    ["Plans", r.plans.map((p) => `${cap(p.benefit)}: ${planName(p.planId)}`).join("; ")],
    ["Contact route", r.contactRoute ? r.contactRoute.replaceAll("_", " ") : "Not chosen yet"],
    ["Referral status", r.state.replaceAll("_", " ")],
    ...(admin ? ([["Mailing address (restricted)", r.private.mailingAddress || "Not on file"], ["Email (restricted)", r.private.email || "Not on file"]] as [string, string][]) : ([["Contact details", r.private.mailingAddress ? "On file with the administrator (restricted)" : "Not on file"]] as [string, string][])),
  ]);
  if (r.history.length) pdf.table(["When", "Status", "Note"], r.history.map((h) => [fmtDateTime(h.at), h.state.replaceAll("_", " "), h.note]), [0.28, 0.2, 0.52]);
  pdf.note("This is a referral to the administrator, not a legally served COBRA notice. The administrator sends notices and handles elections and premiums. The former spouse's choices, payments and address stay private.");
  return pdfFile(pdf, `continuation-referral-${r.id}.pdf`);
}

const csv = (v: string | number | boolean | null) => {
  const t = v === null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; // no spreadsheet formulas
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export async function acaHistory(user: DemoUser, scenario: ScenarioId): Promise<DocFile> {
  if (user.role !== "hr_admin") forbidden("History for reporting is available to HR only.");
  const v = await auditView(user, scenario);
  const cols = ["employeeRef", "employerRef", "benefit", "plan", "tier", "coverageFrom", "coverageTo", "caseRef", "contributionRef", "superseded"] as const;
  const lines = [
    `# History for reporting — ${SYNTHETIC_LABEL}. Illustrative coverage history; this demo does not prepare or file ACA forms.`,
    cols.join(","),
    ...v.acaHistory.map((r) => cols.map((k) => csv(r[k])).join(",")),
  ];
  return { bytes: new TextEncoder().encode(`${lines.join("\n")}\n`), contentType: "text/csv; charset=utf-8", fileName: `history-for-reporting-${scenario}.csv` };
}

