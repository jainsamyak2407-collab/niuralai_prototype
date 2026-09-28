import type { Command } from "@/lib/contracts/commands";
import type { DemoUser, QleCase, ScenarioState } from "@/lib/contracts/domain";
import { NEXA, PARTNER_ID, userById } from "@/server/config/identities";
import type { Ctx } from "./ctx";
import { blockingOpen } from "./evaluate";
import { execute } from "./workflow";

// Autopilot (demo setting, on by default): the simulated outside systems respond at once.
// HR still approves every case and sends the batch file to the carrier. After that, the
// simulated carrier, payroll system and COBRA administrator answer through the SAME
// commands a simulator click would issue, so every step is validated and audited.
// Anything flagged (a carrier mismatch, a large payroll adjustment, an unknown delivery)
// stops and waits for a person.

export const RULES_ACTOR: DemoUser = {
  id: "system_rules",
  name: "Rules engine (straight-through)",
  email: "rules@demo.example",
  role: "hr_admin",
  title: "Nexa straight-through policy",
  partnerId: PARTNER_ID,
  employerId: NEXA.id,
};

let seq = 0;
type AutoCommand = Command extends infer C ? (C extends Command ? Omit<C, "idempotencyKey"> : never) : never;
function run(ctx: Ctx, actor: DemoUser, cmd: AutoCommand): boolean {
  try {
    const r = execute({ ...ctx, actor, nested: true }, { ...cmd, idempotencyKey: `auto-${Date.now()}-${++seq}` } as Command);
    return r.ok;
  } catch {
    return false; // a refused step stays for a person; autopilot never overrides a rule
  }
}

/** A case qualifies when every check passed (or does not apply) and every document matched 100%. */
export function readyAt100(s: ScenarioState, c: QleCase): boolean {
  const ev = c.evaluation;
  if (!ev || c.background || c.approvals.length || c.specialistReview) return false;
  if (!["submitted", "under_review"].includes(c.status)) return false;
  if (!ev.proposedLines.length || blockingOpen(ev).length) return false;
  if (ev.checks.some((k) => (k.result === "needs_review" || k.result === "needs_information") && !k.resolvedBy)) return false;
  const files = s.evidence.filter((e) => e.caseId === c.id && e.status !== "rejected");
  if (!files.length || !files.every((e) => e.reviewedBy === "ai_auto")) return false;
  return !s.tasks.some((t) => t.caseId === c.id && t.kind === "information_request" && t.status === "open");
}

/** Case-level AI match: the lowest score across its documents; null when none was scored. */
export function caseAiMatch(s: ScenarioState, c: QleCase): number | null {
  if (c.background) return c.sampleAiMatch ?? null;
  const files = s.evidence.filter((e) => e.caseId === c.id && e.status !== "rejected");
  const scores = files.map((e) => e.confidence).filter((x): x is number => typeof x === "number");
  return scores.length ? Math.min(...scores) : null;
}

export function runAutopilot(ctx: Ctx) {
  const s = ctx.s;
  if (s.autopilot === false) return;
  const carrier = userById("u_carrier")!;
  const ops = userById("u_ops")!;
  const cobra = userById("u_cobra")!;
  for (let round = 0; round < 12; round++) {
    let progressed = false;
    // Approval and sending the batch file stay with HR. The simulated carrier: transport receipt, file acceptance, member results, coverage.
    for (const b of s.batches) {
      if (b.transport === "pending") progressed = run(ctx, carrier, { type: "ops.batchTransport", batchId: b.id, outcome: "received" }) || progressed;
      if (b.transport === "received" && b.fileValidation === "pending") progressed = run(ctx, carrier, { type: "ops.batchValidation", batchId: b.id, outcome: "accepted" }) || progressed;
      const open = b.txnIds.map((id) => s.txns.find((t) => t.id === id)!).some((t) => !t.superseded && (t.memberResult === "pending" || (t.memberResult === "accepted" && !s.observations.some((o) => o.txnId === t.id))));
      if (b.fileValidation === "accepted" && open) progressed = run(ctx, carrier, { type: "ops.publishAccepted", batchId: b.id }) || progressed;
    }
    for (const t of s.txns) {
      if (t.route === "api" && !t.superseded && t.delivery === "acknowledged" && t.memberResult === "pending") progressed = run(ctx, carrier, { type: "ops.publishAccepted", batchId: t.id }) || progressed;
    }
    // Payroll: created only after the carrier confirms coverage. HR already reviewed this pay
    // change (new deduction and catch-up) when approving the case, so it is authorized here.
    // A retroactive change flagged "Payroll review required" still waits for HR. small adjustments authorized by policy; the payroll system applies the instruction.
    for (const i of s.instructions) {
      if (i.state === "approval_needed" && !i.adjustmentBasis.includes("Payroll review required")) progressed = run(ctx, RULES_ACTOR, { type: "hr.authorizePayroll", instructionId: i.id }) || progressed;
      if (i.state === "scheduled") progressed = run(ctx, ops, { type: "ops.payrollInstruction", instructionId: i.id, outcome: "accept" }) || progressed;
    }
    // COBRA: send the minimal referral once the removal is approved; the administrator acknowledges.
    for (const r of s.cobra) {
      const c = s.cases.find((x) => x.id === r.caseId);
      if (r.state === "review_needed" && c?.status === "approved" && r.contactRoute !== "contact_verification_needed") progressed = run(ctx, RULES_ACTOR, { type: "hr.sendCobraReferral", referralId: r.id, contactRoute: "verified_address_on_file" }) || progressed;
      if (r.state === "sent") progressed = run(ctx, cobra, { type: "ops.cobra", referralId: r.id, action: "acknowledge" }) || progressed;
    }
    if (!progressed) break;
  }
}
