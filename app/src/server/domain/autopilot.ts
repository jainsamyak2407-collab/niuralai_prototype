import type { Command } from "@/lib/contracts/commands";
import type { DemoUser, QleCase } from "@/lib/contracts/domain";
import { NEXA, PARTNER_ID, userById } from "@/server/config/identities";
import type { Ctx } from "./ctx";
import { blockingOpen } from "./evaluate";
import { execute } from "./workflow";

// Autopilot (demo setting, on by default): straight-through processing for clean cases.
// It issues the SAME commands a person or simulator would, through the same handlers,
// so every step is validated and audited. It never forces an outcome: anything flagged
// (a check needing review, a document under 100%, a carrier mismatch, a large payroll
// adjustment, an unknown delivery) stops and waits for a person.

export const RULES_ACTOR: DemoUser = {
  id: "system_rules",
  name: "Rules engine (straight-through)",
  email: "rules@demo.example",
  role: "hr_admin",
  title: "Nexa straight-through policy",
  partnerId: PARTNER_ID,
  employerId: NEXA.id,
};
const AUTO_PAYROLL_LIMIT_CENTS = 50_000; // adjustments up to USD 500 are authorized by policy

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
function straightThrough(ctx: Ctx, c: QleCase): boolean {
  const ev = c.evaluation;
  if (!ev || c.background || c.approvals.length || c.specialistReview) return false;
  if (!["submitted", "under_review"].includes(c.status)) return false;
  if (!ev.proposedLines.length || blockingOpen(ev).length) return false;
  if (ev.checks.some((k) => (k.result === "needs_review" || k.result === "needs_information") && !k.resolvedBy)) return false;
  const files = ctx.s.evidence.filter((e) => e.caseId === c.id && e.status !== "rejected");
  if (!files.length || !files.every((e) => e.reviewedBy === "ai_auto")) return false;
  return !ctx.s.tasks.some((t) => t.caseId === c.id && t.kind === "information_request" && t.status === "open");
}

export function runAutopilot(ctx: Ctx) {
  const s = ctx.s;
  if (s.autopilot === false) return;
  const carrier = userById("u_carrier")!;
  const ops = userById("u_ops")!;
  const cobra = userById("u_cobra")!;
  for (let round = 0; round < 12; round++) {
    let progressed = false;
    // 1. Straight-through approval for clean cases.
    for (const c of s.cases) {
      if (straightThrough(ctx, c)) progressed = run(ctx, RULES_ACTOR, { type: "hr.approve", caseId: c.id, expectedVersion: c.version, revisionNo: c.revisions.at(-1)!.revisionNo }) || progressed;
    }
    // 2. Send approved changes now instead of waiting for 10 p.m.
    if (s.txns.some((t) => t.delivery === "queued" && t.route === "edi_834" && !t.superseded)) progressed = run(ctx, ops, { type: "ops.runBatch" }) || progressed;
    // 3. Simulated carrier: transport receipt, file acceptance, member results, coverage.
    for (const b of s.batches) {
      if (b.transport === "pending") progressed = run(ctx, carrier, { type: "ops.batchTransport", batchId: b.id, outcome: "received" }) || progressed;
      if (b.transport === "received" && b.fileValidation === "pending") progressed = run(ctx, carrier, { type: "ops.batchValidation", batchId: b.id, outcome: "accepted" }) || progressed;
      const open = b.txnIds.map((id) => s.txns.find((t) => t.id === id)!).some((t) => !t.superseded && (t.memberResult === "pending" || (t.memberResult === "accepted" && !s.observations.some((o) => o.txnId === t.id))));
      if (b.fileValidation === "accepted" && open) progressed = run(ctx, carrier, { type: "ops.publishAccepted", batchId: b.id }) || progressed;
    }
    for (const t of s.txns) {
      if (t.route === "api" && !t.superseded && t.delivery === "acknowledged" && t.memberResult === "pending") progressed = run(ctx, carrier, { type: "ops.publishAccepted", batchId: t.id }) || progressed;
    }
    // 4. Payroll: small adjustments authorized by policy; the payroll system applies the instruction.
    for (const i of s.instructions) {
      if (i.state === "approval_needed" && Math.abs(i.adjustmentCents) <= AUTO_PAYROLL_LIMIT_CENTS && !i.adjustmentBasis.includes("Payroll review required")) progressed = run(ctx, RULES_ACTOR, { type: "hr.authorizePayroll", instructionId: i.id }) || progressed;
      if (i.state === "scheduled") progressed = run(ctx, ops, { type: "ops.payrollInstruction", instructionId: i.id, outcome: "accept" }) || progressed;
    }
    // 5. COBRA: send the minimal referral once the removal is approved; the administrator acknowledges.
    for (const r of s.cobra) {
      const c = s.cases.find((x) => x.id === r.caseId);
      if (r.state === "review_needed" && c?.status === "approved" && r.contactRoute !== "contact_verification_needed") progressed = run(ctx, RULES_ACTOR, { type: "hr.sendCobraReferral", referralId: r.id, contactRoute: "verified_address_on_file" }) || progressed;
      if (r.state === "sent") progressed = run(ctx, cobra, { type: "ops.cobra", referralId: r.id, action: "acknowledge" }) || progressed;
    }
    if (!progressed) break;
  }
}
