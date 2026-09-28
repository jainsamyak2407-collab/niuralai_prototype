import type { DemoUser, Evaluation, ScenarioId, Tier } from "@/lib/contracts/domain";
import { estimateChunks, type KnowledgeChunk } from "@/lib/ai/knowledge";
import { fmtDateLong, localDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { PLAN_BY_ID, TIER_LABEL } from "@/server/config/plans";
import { employeeBenefitsView, employeeView, fixturesContext, hrCaseView, hrQueueView } from "@/server/views";

// Scoped context for Emma. Case facts come only through the role-scoped views
// (employee: own case; HR: own employer), never from raw scenario state. A case the
// user may not see yields no chunks at all.

const planName = (id: string) => PLAN_BY_ID.get(id)?.shortName ?? id;
const tierName = (t: Tier) => TIER_LABEL[t] ?? t;

interface CaseInput {
  caseId: string;
  caseNumber: string;
  eventLabel: string;
  statusLabel: string;
  version: number;
  evaluation: Evaluation | null;
  milestones: { label: string; state: string; explanation: string }[];
  evidence: { documentType: string | null; status: string; readMode: string | null }[];
  payroll: { benefit: string; state: string; previousCents: number; newCents: number; adjustmentCents: number; payday: string }[];
  requests: { title: string; items: string[]; dueAt: string | null }[];
  today: string;
  audience: "employee" | "hr";
}

function caseChunks(i: CaseInput): KnowledgeChunk[] {
  const base = { docId: `case_${i.caseId}`, title: `${i.audience === "employee" ? "Your request" : "Case"} ${i.caseNumber}`, version: `v${i.version}`, effectiveDate: i.today, effectiveTo: null, kind: "case_record" as const, employerId: null };
  const out: KnowledgeChunk[] = [];
  const current = i.milestones.find((m) => m.state === "current" || m.state === "attention");
  out.push({
    ...base,
    id: `${i.caseId}:status`,
    section: "Status and next step",
    text: `${i.eventLabel} request ${i.caseNumber}. Status: ${i.statusLabel}. ${current ? `Current step: ${current.label} — ${current.explanation}` : ""} Milestones: ${i.milestones.map((m) => `${m.label} (${m.state})`).join("; ")}.${i.requests.length ? ` Open requests from HR: ${i.requests.map((r) => `${r.title}${r.items.length ? ` — ${r.items.join("; ")}` : ""}${r.dueAt ? `, due ${fmtDateLong(localDate(r.dueAt), true)}` : ""}`).join(" | ")}.` : ""}`,
  });
  const ev = i.evaluation;
  if (ev) {
    out.push({
      ...base,
      id: `${i.caseId}:timing`,
      section: "Request window and dates",
      text: `${ev.timing.label} (${ev.timing.ruleId}): ${ev.timing.message}${ev.timing.eventDate ? ` Event date ${fmtDateLong(ev.timing.eventDate, true)}.` : ""}${ev.timing.deadline ? ` Deadline ${fmtDateLong(ev.timing.deadline, true)}.` : ""} Proposed coverage: ${ev.proposedLines.map((l) => `${l.benefit} ${l.action.replace("_", " ")}${l.startDate ? ` from ${fmtDateLong(l.startDate, true)}` : ""}${l.endDate ? ` ending ${fmtDateLong(l.endDate, true)}` : ""}`).join("; ") || "none yet"}.${ev.missingFacts.length ? ` Still needed: ${ev.missingFacts.join("; ")}.` : ""}`,
    });
    if (ev.costs.length) {
      const f = ev.adjustmentForecast;
      out.push({
        ...base,
        id: `${i.caseId}:costs`,
        section: "Cost estimate for this request",
        kind: "estimate",
        text: `Estimate from the calculation service, not a payroll posting. ${ev.costs.map((c) => `${c.benefit}: ${planName(c.planBefore)} ${tierName(c.tierBefore)} ${fmtMoney(c.beforeCents)} per paycheck -> ${planName(c.planAfter)} ${tierName(c.tierAfter)} ${fmtMoney(c.afterCents)} per paycheck`).join("; ")}. Total per paycheck: ${fmtMoney(ev.totalBeforeCents)} before, ${fmtMoney(ev.totalAfterCents)} after.${f ? ` Forecast for ${fmtDateLong(f.targetPayday, true)}: new recurring ${fmtMoney(f.newRecurringCents)}, one-time adjustment ${fmtMoney(f.adjustmentCents)} (${f.basis}).` : ""}`,
      });
    }
    const checks = ev.checks.filter((c) => c.result !== "not_applicable").slice(0, 8);
    if (checks.length) {
      out.push({ ...base, id: `${i.caseId}:checks`, section: "Rule checks", text: `Rule checks (deterministic): ${checks.map((c) => `${c.label}: ${c.result.replace("_", " ")} — ${c.reason}`).join(" | ")}` });
    }
  }
  if (i.evidence.length) {
    out.push({ ...base, id: `${i.caseId}:evidence`, section: "Documents", text: `Documents on this request: ${i.evidence.map((e) => `${e.documentType ?? "Document"} — ${e.status.replaceAll("_", " ")}${e.readMode === "manual" ? " (manual review)" : ""}`).join("; ")}.` });
  }
  if (i.payroll.length) {
    out.push({
      ...base,
      id: `${i.caseId}:payroll`,
      section: "Payroll changes",
      text: `Payroll instructions: ${i.payroll.map((p) => `${p.benefit}: ${p.state.replaceAll("_", " ")}; ${fmtMoney(p.previousCents)} -> ${fmtMoney(p.newCents)} per paycheck, adjustment ${fmtMoney(p.adjustmentCents)}, payday ${fmtDateLong(p.payday, true)}`).join(" | ")}.`,
    });
  }
  return out;
}

export interface EmmaContext {
  today: string;
  chunks: KnowledgeChunk[];
  caseId: string | null; // set only when the user may see the case
  caseNumber: string | null;
  caseStatus: string | null;
  caseDenied: boolean;
}

export async function emmaContext(user: DemoUser, scenario: ScenarioId, caseId?: string): Promise<EmmaContext> {
  const ctx: EmmaContext = { today: "", chunks: [], caseId: null, caseNumber: null, caseStatus: null, caseDenied: false };
  if (user.role !== "employee") ctx.today = localDate((await fixturesContext(scenario)).now);
  if (user.role === "employee") {
    const b = await employeeBenefitsView(user, scenario);
    ctx.today = b.today;
    ctx.chunks.push(...estimateChunks(b.current.map((e) => ({ benefit: e.benefit, planId: e.planId, tier: e.tier })), b.today));
    if (caseId) {
      try {
        const v = await employeeView(user, scenario, caseId);
        ctx.caseId = v.case.id;
        ctx.caseNumber = v.case.caseNumber;
        ctx.caseStatus = v.case.status;
        ctx.chunks.push(
          ...caseChunks({
            caseId: v.case.id,
            caseNumber: v.case.caseNumber,
            eventLabel: v.case.eventLabel,
            statusLabel: v.case.statusLabel.label,
            version: v.case.version,
            evaluation: v.evaluation,
            milestones: v.milestones,
            evidence: v.evidence,
            payroll: v.payroll,
            requests: v.requests.filter((r) => r.status === "open"),
            today: v.today,
            audience: "employee",
          }),
        );
      } catch {
        ctx.caseDenied = true;
      }
    }
  } else if (user.role === "hr_admin") {
    if (caseId) {
      try {
        const v = await hrCaseView(user, scenario, caseId);
        ctx.caseId = v.case.id;
        ctx.caseNumber = v.case.caseNumber;
        ctx.caseStatus = v.case.status;
        ctx.chunks.push(
          ...caseChunks({
            caseId: v.case.id,
            caseNumber: v.case.caseNumber,
            eventLabel: v.case.eventLabel,
            statusLabel: v.case.statusLabel.label,
            version: v.case.version,
            evaluation: v.evaluation,
            milestones: v.milestones,
            evidence: v.evidence,
            payroll: v.instructions.map((p) => ({ benefit: p.benefit, state: p.state, previousCents: p.previousRecurringCents, newCents: p.newRecurringCents, adjustmentCents: p.adjustmentCents, payday: p.payday })),
            requests: v.tasks.filter((t) => t.status === "open").map((t) => ({ title: t.title, items: t.items ?? [], dueAt: t.dueAt })),
            today: v.today,
            audience: "hr",
          }),
        );
      } catch {
        ctx.caseDenied = true;
      }
    } else {
      const q = await hrQueueView(user, scenario);
      const rows = q.rows.filter((r) => !r.completed && !r.terminal).slice(0, 8);
      ctx.chunks.push({
        id: "hr:queue",
        docId: "hr_queue",
        title: "HR queue (your employer)",
        section: "Open cases by risk",
        version: "live",
        effectiveDate: ctx.today,
        effectiveTo: null,
        kind: "case_record",
        employerId: null,
        text: `Open life-event cases, highest risk first: ${rows.map((r) => `${r.caseNumber} ${r.employeeName} (${r.event}) — ${r.status.label}, risk ${r.risk} (${r.riskReason}), next: ${r.nextAction}, owner ${r.owner}`).join(" | ") || "none"}. Queue tabs needing action: ${Object.entries(q.counts).map(([k, n]) => `${k} ${n}`).join(", ")}.`,
      });
    }
  }
  return ctx;
}
