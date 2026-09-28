import { caseAiMatch, readyAt100 } from "@/server/domain/autopilot";
import { aiReview } from "@/server/ai/review";
import type {
  AuditEvent,
  Benefit,
  CarrierBatch,
  CarrierObservation,
  CarrierTxn,
  CobraReferral,
  DemoUser,
  Election,
  EvidenceFile,
  ExecutionLine,
  Notification,
  PayRun,
  PayrollInstruction,
  Person,
  QleCase,
  ScenarioId,
  ScenarioState,
  Task,
} from "@/lib/contracts/domain";
import { addDays, fmtDateLong, localDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { OWNERS, ownerName } from "@/server/config/identities";
import { OPEN_ENROLLMENT, PLANS, employeeCost, plan, TIER_LABEL } from "@/server/config/plans";
import { PAYSLIP_FIXTURE } from "@/server/config/payroll";
import { EVENT_LABEL, EVENT_TILES, LOSS_REASON_LABEL } from "@/server/config/rules";
import { DomainError } from "@/server/domain/ctx";
import { electionOn, evaluateCase, personName } from "@/server/domain/evaluate";
import { decodeOrder, EDI_LABEL } from "@/server/domain/edi";
import { executionSummary } from "@/server/domain/execution";
import { nextBatchAt } from "@/server/domain/execution";
import { SCENARIO_META } from "@/server/domain/seed";
import { getStore } from "@/server/store/store";

// Role-scoped read projections. Every page reads through these. Fields a role may not
// see are removed here on the server, never hidden with CSS.

export async function loadState(scenario: ScenarioId): Promise<ScenarioState> {
  return getStore().load(scenario);
}

export function storeMode() {
  const s = getStore();
  return { mode: s.mode, durable: s.durable };
}

function assertRole(user: DemoUser, roles: DemoUser["role"][]) {
  if (!roles.includes(user.role)) throw new DomainError(403, "forbidden", "Your role cannot open this page.");
}

export const benefitLabel: Record<Benefit, string> = { medical: "Medical", dental: "Dental", vision: "Vision" };

// ---------------- shared case derivations ----------------

export type MilestoneState = "done" | "current" | "upcoming" | "attention";
export interface Milestone {
  key: string;
  label: string;
  state: MilestoneState;
  at: string | null;
  owner: string;
  explanation: string;
  action: string | null;
}

export function milestones(s: ScenarioState, c: QleCase): Milestone[] {
  const removal = c.eventCode === "divorce";
  const exec = executionSummary(s, c);
  const sent = s.txns.filter((t) => t.caseId === c.id && t.delivery !== "queued");
  const openInfo = s.tasks.find((t) => t.caseId === c.id && t.kind === "information_request" && t.status === "open");
  const approvedAt = c.approvals.filter((a) => !a.supersededAt).at(-1)?.at ?? null;
  const futureStart = c.lines.filter((l) => l.action !== "terminate" && l.coverageState === "confirmed_future").map((l) => l.startDate!).sort()[0];
  const lastEnd = c.lines.filter((l) => l.action === "terminate").map((l) => l.endDate!).sort().at(-1);
  const terminal = c.status === "declined" || c.status === "withdrawn";
  const m: Milestone[] = [];
  m.push({ key: "received", label: "Request received", state: c.receipt ? "done" : "current", at: c.receipt?.receivedAt ?? null, owner: "You", explanation: c.receipt ? `Receipt ${c.caseNumber}, revision ${c.receipt.revisionNo}.` : "Finish and submit your request.", action: c.receipt ? null : "Continue your request" });
  const hrDone = c.status === "approved" || terminal;
  m.push({
    key: "hr",
    label: "HR review",
    state: hrDone ? "done" : openInfo ? "attention" : c.receipt ? "current" : "upcoming",
    at: approvedAt ?? c.decision?.at ?? null,
    owner: openInfo ? "You" : ownerName("u_daniel"),
    explanation: c.status === "declined" ? `Decision recorded: ${c.decision?.reason}` : c.status === "withdrawn" ? "You withdrew this request." : c.status === "approved" ? "HR approved your request." : openInfo ? `HR needs: ${(openInfo.items ?? []).join("; ")}.` : c.specialistReview ? "A benefits specialist is reviewing your request." : "HR is reviewing your request.",
    action: openInfo ? "Reply to HR" : null,
  });
  if (terminal) return m;
  const anyConfirmed = c.lines.length > 0;
  m.push({ key: "sent", label: "Sent to insurance provider", state: sent.length ? "done" : c.status === "approved" ? "current" : "upcoming", at: sent[0]?.sentAt ?? null, owner: sent.length ? "Insurance provider" : ownerName("u_daniel"), explanation: sent.length ? "Your change was sent. The provider's record is what confirms coverage." : c.status === "approved" ? "Your change goes out in the next nightly update." : "After HR approval.", action: null });
  const covLabel = removal ? "End date confirmed" : futureStart ? `Confirmed from ${fmtDateLong(futureStart)}` : "Coverage result confirmed";
  m.push({
    key: "coverage",
    label: covLabel,
    state: exec.linesOk ? "done" : exec.issues.length ? "attention" : sent.length ? "current" : "upcoming",
    at: exec.linesOk ? (s.observations.filter((o) => o.caseId === c.id && o.outcome === "matched").at(-1)?.observedAt ?? null) : null,
    owner: exec.issues.length ? ownerName("u_daniel") : "Insurance provider",
    explanation: exec.issues.length
      ? "We are correcting a provider response. No action is needed from you right now."
      : exec.linesOk
        ? removal
          ? `The provider confirmed the end date${lastEnd ? ` (${fmtDateLong(lastEnd, true)})` : ""}. Everyone else stays covered.`
          : futureStart
            ? `Confirmed. Coverage starts ${fmtDateLong(futureStart, true)}; it is not active before then.`
            : "The provider's record matches your approved change."
        : anyConfirmed
          ? "Waiting for the insurance provider. Your requested date is kept while we wait."
          : "After the change is sent.",
    action: null,
  });
  const payStates = exec.payroll.map((p) => p.state);
  const sched = s.instructions.filter((i) => i.caseId === c.id && ["scheduled", "instruction_accepted", "approval_needed"].includes(i.state));
  const nextRun = sched.map((i) => s.payRuns.find((r) => r.id === i.targetRunId)!).sort((a, b) => a.payday.localeCompare(b.payday))[0];
  m.push({
    key: "pay",
    label: "Pay updated",
    state: exec.payrollDone && exec.linesOk ? "done" : payStates.includes("mismatch") ? "attention" : sched.length ? "current" : "upcoming",
    at: exec.payrollDone ? (s.payRuns.filter((r) => s.instructions.some((i) => i.caseId === c.id && i.targetRunId === r.id)).map((r) => r.postedAt).filter(Boolean).at(-1) ?? s.instructions.filter((i) => i.caseId === c.id).map((i) => i.acceptedAt).filter(Boolean).at(-1) ?? null) : null,
    owner: "Payroll",
    explanation: payStates.includes("mismatch")
      ? "We are checking a payroll result. Your coverage is not affected."
      : exec.payrollDone && exec.linesOk
        ? payStates.every((p) => p === "verified_no_change")
          ? "No change to your regular deduction."
          : payStates.every((p) => p === "posted" || p === "verified_no_change")
            ? "Your payslip shows the new deduction."
            : `Payroll accepted the new deduction${nextRun ? ` from the ${fmtDateLong(nextRun.payday, true)} paycheck` : ""}.`
        : nextRun
          ? `Coverage confirmed; pay update scheduled for ${fmtDateLong(nextRun.payday, true)}.`
          : "After the provider confirms coverage.",
    action: null,
  });
  const cobra = s.cobra.find((r) => r.caseId === c.id);
  m.push({
    key: "complete",
    label: "Complete",
    state: c.completedAt ? "done" : "upcoming",
    at: c.completedAt ?? null,
    owner: "—",
    explanation: c.completedAt
      ? cobra
        ? "Complete. The continuation handoff was acknowledged; the administrator handles it separately."
        : "Coverage and pay match the approved change."
      : exec.linesOk && nextRun
        ? `Completes when the ${fmtDateLong(nextRun.payday, true)} paycheck posts with the new deduction.`
        : "When coverage and pay both match the approved change.",
    action: null,
  });
  return m;
}

export function statusLabel(s: ScenarioState, c: QleCase): { label: string; tone: "green" | "amber" | "blue" | "red" | "gray" } {
  if (c.status === "draft") return { label: "Draft", tone: "gray" };
  if (c.status === "declined") return { label: "Declined", tone: "red" };
  if (c.status === "withdrawn") return { label: "Withdrawn", tone: "gray" };
  if (c.background && c.status === "approved") return { label: "Approved · sample case", tone: "green" };
  if (c.status === "needs_information") return { label: "Waiting for employee", tone: "amber" };
  if (c.status !== "approved") return { label: c.specialistReview ? "Specialist review" : "HR review", tone: "blue" };
  const e = executionSummary(s, c);
  if (c.completedAt) return { label: "Complete", tone: "green" };
  if (e.issues.length) return { label: "Provider issue", tone: "red" };
  if (e.payroll.some((p) => p.state === "mismatch")) return { label: "Payroll issue", tone: "red" };
  if (!e.linesOk) return { label: "Waiting for carrier", tone: "blue" };
  // Coverage is settled with the carrier; only the paycheck is still ahead.
  if (!e.payrollDone) return { label: c.eventCode === "divorce" ? "Removal confirmed · pay update scheduled" : "Enrolled · pay update scheduled", tone: "green" };
  if (!e.cobraOk) return { label: "Waiting for COBRA receipt", tone: "amber" };
  return { label: "Finishing", tone: "blue" };
}

function tasksView(s: ScenarioState, list: Task[]) {
  return list.map((t) => ({ ...t, ownerName: ownerName(t.ownerId), backupName: ownerName(t.backupOwnerId) }));
}

function personView(p: Person) {
  return { id: p.id, name: `${p.firstName} ${p.lastName}`, relationship: p.relationship, dob: p.dob, ssnStatus: p.ssnStatus };
}

function electionCard(s: ScenarioState, e: Election) {
  const p = plan(e.planId);
  return {
    id: e.id,
    benefit: e.benefit,
    planId: e.planId,
    planName: p.name,
    tier: e.tier,
    tierLabel: TIER_LABEL[e.tier],
    covered: e.coveredPersonIds.map((id) => personName(s, id)),
    coveredIds: e.coveredPersonIds,
    employeeCents: employeeCost(e.planId, e.tier),
    employerCents: p.premiumCents[e.tier] - p.employeeCents[e.tier],
    effectiveFrom: e.effectiveFrom,
    effectiveTo: e.effectiveTo,
    docId: p.docId,
  };
}

// ---------------- employee ----------------

export async function employeeBenefitsView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["employee"]);
  const s = await loadState(scenario);
  const today = localDate(s.clock.businessNow);
  const current = (["medical", "dental", "vision"] as Benefit[]).map((b) => electionOn(s, b, today)).filter(Boolean).map((e) => electionCard(s, e!));
  const future = s.elections.filter((e) => e.effectiveFrom > today).map((e) => electionCard(s, e));
  const household = s.people.filter((p) => p.employerId === user.employerId && !p.id.startsWith("p_bg")).map(personView);
  const open = s.cases.filter((c) => c.employeeId === user.personId && !["declined", "withdrawn"].includes(c.status) && !c.completedAt);
  return {
    today,
    person: personView(s.people.find((p) => p.id === user.personId)!),
    household,
    current,
    future,
    pending: open.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      event: EVENT_LABEL[c.eventCode],
      status: c.status,
      statusLabel: statusLabel(s, c),
      totalBeforeCents: c.evaluation?.totalBeforeCents ?? null,
      totalAfterCents: c.evaluation?.totalAfterCents ?? null,
      href: c.status === "draft" ? `/employee/life-events/${c.id}/details` : `/employee/cases/${c.id}`,
    })),
    openEnrollment: OPEN_ENROLLMENT,
    plans: PLANS.map((p) => ({ id: p.id, name: p.name, benefit: p.benefit, docId: p.docId })),
  };
}

export async function employeeCasesView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["employee"]);
  const s = await loadState(scenario);
  return s.cases
    .filter((c) => c.employeeId === user.personId)
    .map((c) => ({ id: c.id, caseNumber: c.caseNumber, event: EVENT_LABEL[c.eventCode], status: c.status, statusLabel: statusLabel(s, c), receivedAt: c.receipt?.receivedAt ?? null, updatedAt: c.updatedAt, href: c.status === "draft" ? `/employee/life-events/${c.id}/details` : `/employee/cases/${c.id}` }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function evidenceForEmployee(f: EvidenceFile) {
  return { id: f.id, fileName: f.fileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, uploadedAt: f.uploadedAt, status: f.status, readMode: f.readMode, documentType: f.documentType, proposedFacts: f.proposedFacts, readNote: f.readNote, reviewed: !!f.reviewedBy, autoVerified: f.reviewedBy === "ai_auto", confidence: f.confidence ?? null, confidenceSummary: f.confidenceSummary ?? null, rejectionReason: f.rejectionReason ?? null, taskId: f.taskId ?? null };
}

/** Employee's view of one case: wizard + tracker. Internal notes, other people's data and private continuation details are excluded. */
export async function employeeView(user: DemoUser, scenario: ScenarioId, caseId: string) {
  assertRole(user, ["employee"]);
  const s = await loadState(scenario);
  const c = s.cases.find((x) => x.id === caseId && x.employeeId === user.personId);
  if (!c) throw new DomainError(404, "case_not_found", "We could not find that request.");
  const evaluation = c.status === "draft" || c.status === "needs_information" ? evaluateCase(s, c) : (c.evaluation ?? evaluateCase(s, c));
  const today = localDate(s.clock.businessNow);
  const household = s.people.filter((p) => p.employerId === user.employerId && !p.id.startsWith("p_bg")).map(personView);
  const cobra = s.cobra.find((r) => r.caseId === c.id);
  const exec = executionSummary(s, c);
  return {
    today,
    case: {
      id: c.id,
      caseNumber: c.caseNumber,
      eventCode: c.eventCode,
      eventLabel: EVENT_LABEL[c.eventCode],
      status: c.status,
      statusLabel: statusLabel(s, c),
      version: c.version,
      facts: c.facts,
      elections: c.elections,
      preferences: c.preferences,
      receipt: c.receipt,
      decision: c.decision ? { kind: c.decision.kind, at: c.decision.at, reason: c.decision.reason, source: c.decision.source, reviewRoute: c.decision.reviewRoute } : null,
      sensitive: c.sensitive,
      evidencePendingNote: c.evidencePendingNote ?? null,
      completedAt: c.completedAt ?? null,
      revisionNo: c.revisions.at(-1)?.revisionNo ?? null,
      linkedCases: c.linkedCaseIds.map((id) => s.cases.find((x) => x.id === id)).filter((x): x is QleCase => !!x && x.employeeId === user.personId).map((x) => ({ id: x.id, caseNumber: x.caseNumber, event: EVENT_LABEL[x.eventCode], status: x.status })),
    },
    evaluation,
    household,
    currentElections: (["medical", "dental", "vision"] as Benefit[]).map((b) => electionOn(s, b, today)).filter(Boolean).map((e) => electionCard(s, e!)),
    plans: PLANS.map((p) => ({ id: p.id, benefit: p.benefit, name: p.name, shortName: p.shortName, network: p.network, terms: p.terms, limitations: p.limitations, docId: p.docId, employeeCents: p.employeeCents })),
    evidence: s.evidence.filter((e) => e.caseId === c.id).map(evidenceForEmployee),
    requests: s.tasks.filter((t) => t.caseId === c.id && t.kind === "information_request").map((t) => ({ id: t.id, title: t.title, items: t.items ?? [], reason: t.reason, message: t.employeeMessage ?? "", dueAt: t.dueAt, status: t.status, response: t.response ?? null })),
    myTasks: tasksView(s, s.tasks.filter((t) => t.caseId === c.id && t.ownerId === "u_maya" && t.status === "open" && t.kind !== "information_request")),
    milestones: milestones(s, c),
    lines: c.lines.map((l) => ({ id: l.id, person: personName(s, l.personId, c), benefit: l.benefit, action: l.action, planName: plan(l.planId).shortName, tierLabel: TIER_LABEL[l.tierAfter], startDate: l.startDate, endDate: l.endDate, coverageState: l.coverageState, safeNote: l.coverageState === "mismatch" ? "We are correcting a provider response. No action is needed from you right now." : null })),
    payroll: s.instructions.filter((i) => i.caseId === c.id).map((i) => ({ benefit: i.benefit, state: i.state, previousCents: i.previousRecurringCents, newCents: i.newRecurringCents, adjustmentCents: i.adjustmentCents, payday: s.payRuns.find((r) => r.id === i.targetRunId)!.payday, basis: i.adjustmentBasis })),
    continuation: cobra ? { state: cobra.state, label: cobra.state === "review_needed" || cobra.state === "referral_ready" ? "Continuation referral being prepared" : cobra.state === "sent" ? "Continuation information referred to the administrator" : "Administrator confirmed receipt", note: "Your former spouse receives continuation information directly. Their choices, payments and address stay private." } : null,
    completion: { linesOk: exec.linesOk, payrollDone: exec.payrollDone, complete: !!c.completedAt },
    timeline: s.audit.filter((a) => a.caseId === c.id && a.visibility === "employee").map((a) => ({ id: a.id, at: a.at, text: a.employeeSummary! })),
    tiles: EVENT_TILES,
    lossReasons: LOSS_REASON_LABEL,
  };
}
export type EmployeeCaseView = Awaited<ReturnType<typeof employeeView>>;

export async function employeePayView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["employee"]);
  const s = await loadState(scenario);
  const today = localDate(s.clock.businessNow);
  const payslips = s.payRuns
    .filter((r) => r.status === "posted")
    .sort((a, b) => b.payday.localeCompare(a.payday))
    .map((r) => payslip(s, r));
  const upcoming = s.payRuns.filter((r) => r.status === "scheduled").sort((a, b) => a.payday.localeCompare(b.payday));
  const instructions = s.instructions.filter((i) => s.cases.find((c) => c.id === i.caseId)?.employeeId === user.personId && ["scheduled", "instruction_accepted", "approval_needed", "blocked"].includes(i.state));
  const setup = s.payrollSetup.map((p) => ({ benefit: p.benefit, recurringCents: p.recurringCents }));
  const proposals = s.cases
    .filter((c) => c.employeeId === user.personId && ["draft", "submitted", "needs_information", "under_review"].includes(c.status))
    .map((c) => {
      const ev = c.status === "draft" ? evaluateCase(s, c) : c.evaluation;
      return { caseId: c.id, caseNumber: c.caseNumber, event: EVENT_LABEL[c.eventCode], status: c.status, costs: ev?.costs ?? [], totalBeforeCents: ev?.totalBeforeCents ?? 0, totalAfterCents: ev?.totalAfterCents ?? 0, forecast: ev?.adjustmentForecast ?? null };
    });
  return {
    today,
    payslips,
    upcoming: upcoming.slice(0, 3).map((r) => ({ ...r, benefitLines: setup, instructions: instructions.filter((i) => i.targetRunId === r.id).map((i) => ({ benefit: i.benefit, state: i.state, previousCents: i.previousRecurringCents, newCents: i.newRecurringCents, adjustmentCents: i.adjustmentCents, basis: i.adjustmentBasis, effectiveFrom: i.effectiveFrom })) })),
    scheduledChanges: instructions.map((i) => ({ id: i.id, benefit: i.benefit, state: i.state, previousCents: i.previousRecurringCents, newCents: i.newRecurringCents, adjustmentCents: i.adjustmentCents, effectiveFrom: i.effectiveFrom, payday: s.payRuns.find((r) => r.id === i.targetRunId)!.payday, caseNumber: s.cases.find((c) => c.id === i.caseId)!.caseNumber })),
    proposals,
    fixtureNote: PAYSLIP_FIXTURE.note,
  };
}

export function payslip(s: ScenarioState, r: PayRun) {
  const lines = s.ledger.filter((d) => d.runId === r.id);
  const benefits = (["medical", "dental", "vision"] as Benefit[]).map((b) => ({
    benefit: b,
    recurringCents: lines.filter((d) => d.benefit === b && d.kind === "recurring").reduce((a, d) => a + d.amountCents, 0),
    adjustmentCents: lines.filter((d) => d.benefit === b && d.kind === "adjustment").reduce((a, d) => a + d.amountCents, 0),
  }));
  const benefitTotal = benefits.reduce((a, b) => a + b.recurringCents + b.adjustmentCents, 0);
  const withholding = PAYSLIP_FIXTURE.withholding;
  const taxTotal = withholding.reduce((a, w) => a + w.cents, 0);
  const gross = PAYSLIP_FIXTURE.grossPerRunCents;
  const net = gross - benefitTotal - PAYSLIP_FIXTURE.retirementCents - taxTotal;
  return { runId: r.id, payday: r.payday, periodStart: r.periodStart, periodEnd: r.periodEnd, postedAt: r.postedAt ?? null, grossCents: gross, benefits, benefitTotalCents: benefitTotal, retirementCents: PAYSLIP_FIXTURE.retirementCents, withholding, taxTotalCents: taxTotal, netCents: net, insufficientWages: net < 0 };
}

export async function employeeDocumentsView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["employee"]);
  const s = await loadState(scenario);
  const mine = s.cases.filter((c) => c.employeeId === user.personId);
  return {
    plans: [
      { id: "doc_benefits_guide", title: "Nexa benefits guide", kind: "Plan document" },
      { id: "doc_election_rules", title: "Election rules", kind: "Plan document" },
      { id: "doc_contributions", title: "Contribution schedule", kind: "Plan document" },
      { id: "doc_payroll_policy", title: "Payroll policy", kind: "Plan document" },
      { id: "doc_medical_standard", title: "Aetna Standard Medical — illustrative summary", kind: "Plan summary" },
      { id: "doc_medical_plus", title: "Aetna Plus Medical — illustrative summary", kind: "Plan summary" },
      { id: "doc_dental_vision", title: "Nexa Dental and Vision — illustrative summary", kind: "Plan summary" },
      { id: `doc_election_statement`, title: "My current election statement", kind: "Statement" },
    ],
    receipts: mine.filter((c) => c.receipt).map((c) => ({ caseId: c.id, caseNumber: c.caseNumber, event: EVENT_LABEL[c.eventCode], receivedAt: c.receipt!.receivedAt, approved: c.status === "approved" })),
    evidence: s.evidence.filter((e) => mine.some((c) => c.id === e.caseId)).map((e) => ({ ...evidenceForEmployee(e), caseNumber: mine.find((c) => c.id === e.caseId)!.caseNumber })),
    payslips: s.payRuns.filter((r) => r.status === "posted").map((r) => ({ runId: r.id, payday: r.payday })),
  };
}

// ---------------- HR ----------------

export type QueueTab = "action" | "employee" | "carrier" | "payroll" | "continuation";

function hrScope(user: DemoUser, s: ScenarioState) {
  return s.cases.filter((c) => c.employerId === user.employerId && c.status !== "draft");
}

export async function hrQueueView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["hr_admin"]);
  const s = await loadState(scenario);
  const now = s.clock.businessNow;
  const rows = hrScope(user, s).map((c) => {
    const tasks = s.tasks.filter((t) => t.caseId === c.id && t.status === "open");
    const exec = executionSummary(s, c);
    const inst = s.instructions.filter((i) => i.caseId === c.id);
    const cobra = s.cobra.find((r) => r.caseId === c.id);
    const tabs: QueueTab[] = [];
    const hrTasks = tasks.filter((t) => ["u_daniel", "u_specialist"].includes(t.ownerId));
    if (["submitted", "under_review"].includes(c.status) || hrTasks.some((t) => !["cobra_silence", "carrier_silence"].includes(t.kind))) tabs.push("action");
    if (c.status === "needs_information" || tasks.some((t) => t.kind === "information_request")) tabs.push("employee");
    if (c.status === "approved" && !exec.linesOk) tabs.push("carrier");
    if (inst.some((i) => ["approval_needed", "mismatch", "blocked"].includes(i.state))) tabs.push("payroll");
    if (cobra && !["notice_tracked"].includes(cobra.state)) tabs.push("continuation");
    const deadline = c.evaluation?.timing.deadline ?? null;
    const nextDue = tasks.map((t) => t.dueAt).filter(Boolean).sort()[0] ?? null;
    const late = c.evaluation?.timing.status === "late" || c.receipt?.timingAtReceipt === "late";
    const overdue = !!nextDue && nextDue < now;
    const risk: "high" | "medium" | "low" = exec.issues.length || late || overdue || tasks.some((t) => t.kind === "urgent_support") ? "high" : tasks.some((t) => t.blocking) || c.status === "submitted" ? "medium" : "low";
    const next = tasks.sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))[0];
    return {
      id: c.id,
      caseNumber: c.caseNumber,
      employeeName: c.employeeName,
      event: EVENT_LABEL[c.eventCode],
      background: c.background,
      status: statusLabel(s, c),
      risk,
      riskReason: exec.issues.length ? "Provider issue" : late ? "Late report" : overdue ? "Overdue task" : risk === "medium" ? "Needs a decision" : "On track",
      ageDays: c.receipt ? Math.max(0, Math.floor((new Date(now).getTime() - new Date(c.receipt.receivedAt).getTime()) / 86400000)) : 0,
      owner: ownerName(next?.ownerId ?? c.ownerId),
      nextAction: next?.nextAction ?? (c.completedAt ? "None — complete" : c.status === "approved" ? "Waiting for carrier or payroll" : "Review"),
      deadline,
      nextDue,
      tabs,
      completed: !!c.completedAt,
      terminal: ["declined", "withdrawn"].includes(c.status),
      aiMatch: caseAiMatch(s, c),
      readyToApprove: c.background ? c.sampleAiMatch === 100 && ["submitted", "under_review"].includes(c.status) : readyAt100(s, c),
    };
  });
  const order = { high: 0, medium: 1, low: 2 };
  rows.sort((a, b) => Number(a.completed || a.terminal) - Number(b.completed || b.terminal) || order[a.risk] - order[b.risk] || (a.nextDue ?? "9").localeCompare(b.nextDue ?? "9"));
  const counts = Object.fromEntries((["action", "employee", "carrier", "payroll", "continuation"] as QueueTab[]).map((t) => [t, rows.filter((r) => r.tabs.includes(t)).length])) as Record<QueueTab, number>;
  return { now, rows, counts, queuedRecords: queuedRecords(s) };
}
export type HrQueueRow = Awaited<ReturnType<typeof hrQueueView>>["rows"][number];

export async function hrCaseView(user: DemoUser, scenario: ScenarioId, caseId: string) {
  assertRole(user, ["hr_admin"]);
  const s = await loadState(scenario);
  const c = s.cases.find((x) => x.id === caseId && x.employerId === user.employerId);
  if (!c || c.status === "draft") throw new DomainError(404, "case_not_found", "We could not find that case.");
  const evaluation = c.status === "approved" ? c.evaluation : evaluateCase(s, c);
  const today = localDate(s.clock.businessNow);
  const exec = executionSummary(s, c);
  const txns = s.txns.filter((t) => t.caseId === c.id);
  const cobra = s.cobra.find((r) => r.caseId === c.id);
  return {
    now: s.clock.businessNow,
    today,
    case: {
      ...c,
      eventLabel: EVENT_LABEL[c.eventCode],
      statusLabel: statusLabel(s, c),
      ownerName: ownerName(c.ownerId),
      backupName: ownerName(c.backupOwnerId),
      latestRevision: c.revisions.at(-1) ?? null,
      activeApproval: c.approvals.filter((a) => !a.supersededAt).at(-1) ?? null,
    },
    evaluation,
    household: s.people.filter((p) => p.employerId === c.employerId && !p.id.startsWith("p_bg")).map(personView),
    currentElections: (["medical", "dental", "vision"] as Benefit[]).map((b) => electionOn(s, b, today)).filter(Boolean).map((e) => electionCard(s, e!)),
    evidence: s.evidence.filter((e) => e.caseId === c.id),
    tasks: tasksView(s, s.tasks.filter((t) => t.caseId === c.id)),
    lines: c.lines.map((l) => lineView(s, c, l)),
    txns: txns.map((t) => ({ ...t, summary: decodeOrder(t.order), batch: s.batches.find((b) => b.id === t.batchId) ?? null })),
    observations: s.observations.filter((o) => o.caseId === c.id),
    instructions: s.instructions.filter((i) => i.caseId === c.id).map((i) => instructionView(s, i)),
    cobra: cobra ? { ...cobra, private: undefined, contactOnFile: !!cobra.private.mailingAddress } : null,
    exec: { linesOk: exec.linesOk, payrollDone: exec.payrollDone, cobraOk: exec.cobraOk, openBlocking: exec.openBlocking.length, complete: !!c.completedAt },
    milestones: milestones(s, c),
    timeline: s.audit.filter((a) => a.caseId === c.id),
    ai: s.ai.filter((a) => a.caseId === c.id),
    notifications: s.outbox.filter((n) => n.caseId === c.id),
    lossReasonLabel: c.facts.lossReason ? LOSS_REASON_LABEL[c.facts.lossReason] : null,
    nextBatchAt: nextBatchAt(s),
    queuedRecords: queuedRecords(s),
    aiReview: aiReview(s, c, evaluation),
  };
}
/** Approved changes waiting for the next carrier batch file (all cases). */
function queuedRecords(s: ScenarioState) {
  return s.txns.filter((t) => t.delivery === "queued" && t.route === "edi_834" && !t.superseded).length;
}
export type HrCaseView = Awaited<ReturnType<typeof hrCaseView>>;

function lineView(s: ScenarioState, c: QleCase, l: ExecutionLine) {
  const txn = s.txns.find((t) => t.id === l.currentTxnId);
  const obs = s.observations.find((o) => o.id === l.observationId);
  return { ...l, person: personName(s, l.personId, c), planName: plan(l.planId).shortName, tierLabel: TIER_LABEL[l.tierAfter], delivery: txn?.delivery ?? null, memberResult: txn?.memberResult ?? null, memberReason: txn?.memberReason ?? null, observed: obs ? { planName: plan(obs.planId).shortName, tierLabel: TIER_LABEL[obs.tier], startDate: obs.startDate, endDate: obs.endDate, sourceRef: obs.sourceRef, observedAt: obs.observedAt } : null };
}

function instructionView(s: ScenarioState, i: PayrollInstruction) {
  const run = s.payRuns.find((r) => r.id === i.targetRunId)!;
  const c = s.cases.find((x) => x.id === i.caseId)!;
  return { ...i, payday: run.payday, runStatus: run.status, cutoffAt: run.cutoffAt, caseNumber: c.caseNumber, employeeName: c.employeeName, totalCents: i.newRecurringCents + i.adjustmentCents };
}

export async function hrPayrollView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["hr_admin"]);
  const s = await loadState(scenario);
  const scoped = new Set(hrScope(user, s).map((c) => c.id));
  return {
    now: s.clock.businessNow,
    instructions: s.instructions.filter((i) => scoped.has(i.caseId)).map((i) => instructionView(s, i)),
    runs: s.payRuns.map((r) => ({ ...r, totalCents: s.ledger.filter((d) => d.runId === r.id).reduce((a, d) => a + d.amountCents, 0) })),
    tasks: tasksView(s, s.tasks.filter((t) => scoped.has(t.caseId) && ["payroll_authorization", "payroll_mismatch"].includes(t.kind) && t.status === "open")),
  };
}

export async function hrOverviewView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["hr_admin"]);
  const q = await hrQueueView(user, scenario);
  const s = await loadState(scenario);
  const scoped = new Set(hrScope(user, s).map((c) => c.id));
  const openTasks = s.tasks.filter((t) => scoped.has(t.caseId) && t.status === "open");
  const eligible = s.cases.filter((c) => scoped.has(c.id) && !c.background && c.status !== "draft");
  return {
    now: s.clock.businessNow,
    counts: q.counts,
    needsAction: q.rows.filter((r) => r.tabs.includes("action")).slice(0, 6),
    dueSoon: openTasks
      .filter((t) => t.dueAt)
      .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
      .slice(0, 6)
      .map((t) => ({ ...t, ownerName: ownerName(t.ownerId), caseNumber: s.cases.find((c) => c.id === t.caseId)?.caseNumber ?? "", overdue: t.dueAt! < s.clock.businessNow })),
    integration: {
      queued: s.txns.filter((t) => t.delivery === "queued" && !t.superseded).length,
      unknown: s.batches.filter((b) => b.transport === "unknown").length,
      awaiting: s.txns.filter((t) => !t.superseded && t.memberResult === "pending" && t.delivery !== "queued").length,
      nextBatchAt: nextBatchAt(s),
    },
    northStar: {
      completed: eligible.filter((c) => c.completedAt).length,
      due: eligible.filter((c) => !["declined", "withdrawn"].includes(c.status)).length,
      declined: eligible.filter((c) => c.status === "declined").length,
      withdrawn: eligible.filter((c) => c.status === "withdrawn").length,
      note: "Demo counts only. Unresolved eligible cases stay in the denominator; declined and withdrawn are reported separately. The demo cannot prove real customer improvement.",
    },
  };
}

export async function hrIntegrationsView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["hr_admin"]);
  const s = await loadState(scenario);
  return {
    now: s.clock.businessNow,
    store: storeMode(),
    carriers: s.carriers,
    batches: s.batches.map((b) => batchView(s, b)),
    pending: s.txns
      .filter((t) => t.delivery === "queued" && t.route === "edi_834" && !t.superseded)
      .map((t) => {
        const c = s.cases.find((x) => x.id === t.caseId)!;
        return { id: t.id, caseId: c.id, caseNumber: c.caseNumber, approvedAt: c.approvals.filter((a) => !a.supersededAt).at(-1)?.at ?? null, summary: decodeOrder(t.order), benefit: t.order.benefit };
      })
      .filter((t) => s.cases.find((c) => c.id === t.caseId)?.employerId === user.employerId),
    // Cases HR still has to approve; their 834 records appear in the next batch once approved.
    awaitingApproval: hrScope(user, s)
      .filter((c) => !c.background && ["submitted", "under_review", "needs_information"].includes(c.status))
      .map((c) => ({ id: c.id, caseNumber: c.caseNumber, event: EVENT_LABEL[c.eventCode], employeeName: c.employeeName, aiMatch: caseAiMatch(s, c) })),
    apiTxns: s.txns.filter((t) => t.route === "api").map((t) => ({ id: t.id, caseNumber: s.cases.find((c) => c.id === t.caseId)!.caseNumber, summary: decodeOrder(t.order), delivery: t.delivery, memberResult: t.memberResult, apiReference: t.apiReference ?? null, sentAt: t.sentAt ?? null })),
    nextBatchAt: nextBatchAt(s),
    label: EDI_LABEL,
  };
}

export async function auditView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["hr_admin"]);
  const s = await loadState(scenario);
  const scoped = new Set(hrScope(user, s).map((c) => c.id));
  return {
    events: s.audit
      .filter((a) => a.caseId === null || scoped.has(a.caseId))
      .slice()
      .reverse()
      .map((a) => ({ ...a, actorName: ownerName(a.actor), caseNumber: s.cases.find((c) => c.id === a.caseId)?.caseNumber ?? null })),
    ai: s.ai.filter((a) => a.caseId === null || scoped.has(a.caseId)).slice().reverse(),
    metrics: s.metrics,
    acaHistory: acaHistory(s, scoped),
  };
}

function acaHistory(s: ScenarioState, scoped: Set<string>) {
  return s.elections.map((e) => ({
    employeeRef: "NXS-000417",
    employerRef: "emp_nexa",
    benefit: e.benefit,
    plan: plan(e.planId).shortName,
    tier: TIER_LABEL[e.tier],
    coverageFrom: e.effectiveFrom,
    coverageTo: e.effectiveTo,
    caseRef: e.caseId && scoped.has(e.caseId) ? s.cases.find((c) => c.id === e.caseId)!.caseNumber : null,
    contributionRef: `${RATE_REF}:${e.planId}:${e.tier}`,
    superseded: e.effectiveTo !== null,
  }));
}
const RATE_REF = "nexa-rates-2026.1";

// ---------------- broker ----------------

export async function brokerTasksView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["broker"]);
  const s = await loadState(scenario);
  return s.tasks
    .filter((t) => t.ownerId === user.id && t.kind === "broker_correction")
    .map((t) => ({ id: t.id, title: t.title, status: t.status, dueAt: t.dueAt, caseNumber: s.cases.find((c) => c.id === t.caseId)!.caseNumber, submitted: !!t.broker?.submissionRef, verified: !!t.broker?.result }));
}

export async function brokerTaskView(user: DemoUser, scenario: ScenarioId, taskId: string) {
  assertRole(user, ["broker"]);
  const s = await loadState(scenario);
  const t = s.tasks.find((x) => x.id === taskId && x.ownerId === user.id && x.kind === "broker_correction");
  if (!t) throw new DomainError(404, "task_not_found", "We could not find that assigned task.");
  const c = s.cases.find((x) => x.id === t.caseId)!;
  const txn = s.txns.find((x) => x.id === t.txnId)!;
  // Minimum necessary: the packet, the issue, due date and permitted evidence names only.
  return {
    task: { id: t.id, title: t.title, reason: t.reason, nextAction: t.nextAction, dueAt: t.dueAt, status: t.status, broker: t.broker!, ownerName: ownerName(t.ownerId), backupName: ownerName(t.backupOwnerId) },
    caseNumber: c.caseNumber,
    order: { planId: txn.order.planId, tier: txn.order.tier, startDate: txn.order.startDate, endDate: txn.order.endDate, action: txn.order.action },
    permittedEvidence: s.evidence.filter((e) => e.caseId === c.id && e.reviewedBy).map((e) => ({ id: e.id, documentType: e.documentType ?? "Supporting document" })),
    plans: PLANS.filter((p) => p.benefit === txn.order.benefit).map((p) => ({ id: p.id, name: p.shortName })),
  };
}

// ---------------- simulators ----------------

function batchView(s: ScenarioState, b: CarrierBatch) {
  return { ...b, txns: b.txnIds.map((id) => txnView(s, s.txns.find((t) => t.id === id)!)) };
}
function txnView(s: ScenarioState, t: CarrierTxn) {
  const obs = s.observations.filter((o) => o.txnId === t.id);
  return { id: t.id, caseNumber: s.cases.find((c) => c.id === t.caseId)!.caseNumber, route: t.route, delivery: t.delivery, memberResult: t.memberResult, memberReason: t.memberReason ?? null, superseded: t.superseded, correctionOf: t.correctionOf, apiReference: t.apiReference ?? null, sentAt: t.sentAt ?? null, order: t.order, summary: decodeOrder(t.order), observations: obs as CarrierObservation[] };
}

export async function integrationsView(user: DemoUser, scenario: ScenarioId) {
  assertRole(user, ["demo_operator", "carrier_operator", "cobra_admin"]);
  const s = await loadState(scenario);
  const carrier = user.role !== "cobra_admin";
  const ops = user.role === "demo_operator";
  const cobra = user.role !== "carrier_operator";
  return {
    role: user.role,
    now: s.clock.businessNow,
    preset: ops ? s.preset : null,
    autopilot: s.autopilot !== false,
    store: storeMode(),
    scenario: { id: scenario, ...SCENARIO_META[scenario] },
    nextBatchAt: nextBatchAt(s),
    carrier: carrier
      ? {
          batches: s.batches.slice().reverse().map((b) => batchView(s, b)),
          apiRequests: s.txns.filter((t) => t.route === "api").slice().reverse().map((t) => txnView(s, t)),
          queued: s.txns.filter((t) => t.delivery === "queued" && t.route === "edi_834" && !t.superseded).map((t) => txnView(s, t)),
          roster: s.roster.map((r) => ({ ...r, member: personName(s, r.personId), planName: plan(r.planId).shortName, tierLabel: TIER_LABEL[r.tier] })),
          label: EDI_LABEL,
        }
      : null,
    manual: ops ? s.tasks.filter((t) => t.kind === "broker_correction").map((t) => ({ id: t.id, title: t.title, status: t.status, dueAt: t.dueAt, ownerName: ownerName(t.ownerId), submissionRef: t.broker?.submissionRef ?? null, verified: !!t.broker?.result })) : null,
    payroll: ops
      ? {
          runs: s.payRuns.map((r) => ({ ...r, totalCents: s.ledger.filter((d) => d.runId === r.id).reduce((a, d) => a + d.amountCents, 0) })),
          instructions: s.instructions.map((i) => instructionView(s, i)),
          setup: s.payrollSetup,
        }
      : null,
    cobra: cobra
      ? s.cobra.map((r: CobraReferral) => ({
          ...r,
          caseNumber: s.cases.find((c) => c.id === r.caseId)!.caseNumber,
          // Only the administrator receives the referral's contact details; nobody else does.
          private: user.role === "cobra_admin" ? r.private : undefined,
        }))
      : null,
    outbox: ops ? s.outbox.slice().reverse() : null,
    audit: ops ? s.audit.slice(-25).reverse() : null,
  };
}
export type IntegrationsView = Awaited<ReturnType<typeof integrationsView>>;

export async function notificationsView(user: DemoUser, scenario: ScenarioId): Promise<Notification[]> {
  const s = await loadState(scenario);
  return s.outbox.filter((n) => n.recipientUserId === user.id).slice().reverse();
}

export async function fixturesContext(scenario: ScenarioId) {
  const s = await loadState(scenario);
  return { scenario: { id: scenario, ...SCENARIO_META[scenario] }, now: s.clock.businessNow };
}

export function scenarioList() {
  return (Object.keys(SCENARIO_META) as ScenarioId[]).map((id) => ({ id, ...SCENARIO_META[id] }));
}

export function fmtTotal(cents: number) {
  return fmtMoney(cents);
}
export { OWNERS, addDays };
export type { AuditEvent };
