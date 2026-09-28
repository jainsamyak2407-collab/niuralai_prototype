import { beforeEach, describe, expect, it } from "vitest";
import type { ScenarioId } from "@/lib/contracts/domain";
import { attachEvidence, caseById, freshStore, ok, run, state } from "./helpers";

async function submitBirth(scenario: ScenarioId, children: { id: string; name: string; dob: string }[], opts: { dental?: boolean } = {}) {
  const d = await ok("u_maya", scenario, { type: "case.createDraft", eventCode: "birth" });
  const id = d.entityId!;
  let c = await caseById(scenario, id);
  await ok("u_maya", scenario, { type: "case.updateDraft", caseId: id, expectedVersion: c.version, facts: { children: children.map((k) => ({ personId: k.id, firstName: k.name, lastName: "Shah", dob: k.dob, ssnStatus: "on_file" })) } });
  c = await caseById(scenario, id);
  const plan = { medical: "aetna_standard", dental: "nexa_dental", vision: "nexa_vision" } as const;
  await ok("u_maya", scenario, {
    type: "case.setElections",
    caseId: id,
    expectedVersion: c.version,
    elections: (["medical", "dental", "vision"] as const).map((b) => ({ benefit: b, planId: plan[b], addPersonIds: b === "medical" || (b === "dental" && opts.dental) ? children.map((k) => k.id) : [], removePersonIds: [], enroll: b === "medical" || (b === "dental" && !!opts.dental) })),
  });
  const ev = await attachEvidence(scenario, id);
  c = await caseById(scenario, id);
  await ok("u_maya", scenario, { type: "case.submit", caseId: id, expectedVersion: c.version, attestation: true });
  c = await caseById(scenario, id);
  await ok("u_daniel", scenario, { type: "hr.reviewEvidence", caseId: id, expectedVersion: c.version, fileId: ev, outcome: "accept" });
  c = await caseById(scenario, id);
  return { id, c };
}
async function approve(scenario: ScenarioId, id: string) {
  const c = await caseById(scenario, id);
  return ok("u_daniel", scenario, { type: "hr.approve", caseId: id, expectedVersion: c.version, revisionNo: c.revisions.at(-1)!.revisionNo });
}
async function sendAndValidate(scenario: ScenarioId) {
  await ok("u_ops", scenario, { type: "ops.runBatch" });
  const s = await state(scenario);
  const b = s.batches.at(-1)!;
  await ok("u_carrier", scenario, { type: "ops.batchTransport", batchId: b.id, outcome: "received" });
  await ok("u_carrier", scenario, { type: "ops.batchValidation", batchId: b.id, outcome: "accepted" });
  return b;
}

describe("edge cases", () => {
  beforeEach(() => freshStore());

  it("twins across midnight keep separate dates; one rejected twin does not roll back the other", async () => {
    const { id } = await submitBirth("birth", [
      { id: "p_child_a", name: "Ava", dob: "2026-08-31" },
      { id: "p_child_b", name: "Rhea", dob: "2026-09-01" },
    ]);
    let c = await caseById("birth", id);
    const adds = c.evaluation!.proposedLines.filter((l) => l.action === "add");
    expect(adds.map((l) => l.startDate)).toEqual(["2026-08-31", "2026-09-01"]);
    await approve("birth", id);
    const b = await sendAndValidate("birth");
    await ok("u_ops", "birth", { type: "ops.preset", preset: "carrier_reject_one_record" });
    await ok("u_carrier", "birth", { type: "ops.publishAccepted", batchId: b.id });
    c = await caseById("birth", id);
    const ava = c.lines.find((l) => l.personId === "p_child_a")!;
    const rhea = c.lines.find((l) => l.personId === "p_child_b")!;
    expect(ava.coverageState).toBe("confirmed_current");
    expect(rhea.coverageState).toBe("awaiting_confirmation");
    const s = await state("birth");
    expect(s.tasks.some((t) => t.kind === "record_rejected" && t.lineId === rhea.id && t.status === "open")).toBe(true);
    // correct only the rejected twin
    await ok("u_daniel", "birth", { type: "hr.sendCorrection", caseId: id, lineId: rhea.id });
    const b2 = await sendAndValidate("birth");
    expect(b2.recordCount).toBe(1);
    await ok("u_carrier", "birth", { type: "ops.publishAccepted", batchId: b2.id });
    c = await caseById("birth", id);
    expect(c.lines.every((l) => l.coverageState === "confirmed_current")).toBe(true);
  });

  it("medical success with dental failure keeps medical confirmed", async () => {
    await ok("u_ops", "birth", { type: "ops.preset", preset: "dental_failure" });
    const { id } = await submitBirth("birth", [{ id: "p_child_a", name: "Ava", dob: "2026-09-01" }], { dental: true });
    await approve("birth", id);
    const b = await sendAndValidate("birth");
    await ok("u_carrier", "birth", { type: "ops.publishAccepted", batchId: b.id });
    const c = await caseById("birth", id);
    expect(c.lines.filter((l) => l.benefit === "medical").every((l) => l.coverageState === "confirmed_current")).toBe(true);
    expect(c.lines.filter((l) => l.benefit === "dental").some((l) => l.coverageState === "awaiting_confirmation")).toBe(true);
    const s = await state("birth");
    expect(s.instructions.some((i) => i.benefit === "medical")).toBe(true);
    expect(s.instructions.some((i) => i.benefit === "dental")).toBe(false);
  });

  it("unknown transport requires an inquiry before resend; not received requeues with the same operation keys", async () => {
    const { id } = await submitBirth("birth", [{ id: "p_child_a", name: "Ava", dob: "2026-09-01" }]);
    await approve("birth", id);
    await ok("u_ops", "birth", { type: "ops.preset", preset: "transport_unknown" });
    await ok("u_ops", "birth", { type: "ops.runBatch" });
    let s = await state("birth");
    const b = s.batches[0];
    expect(b.transport).toBe("unknown");
    const keys = s.txns.map((t) => t.order.operationKey).sort();
    const blocked = await run("u_carrier", "birth", { type: "ops.batchTransport", batchId: b.id, outcome: "received" });
    expect(blocked.status).toBe(422);
    await ok("u_daniel", "birth", { type: "hr.recordDeliveryInquiry", batchId: b.id, outcome: "not_received", reference: "INQ-1" });
    await ok("u_ops", "birth", { type: "ops.runBatch" });
    s = await state("birth");
    expect(s.batches).toHaveLength(2);
    expect(s.txns.map((t) => t.order.operationKey).sort()).toEqual(keys);
  });

  it("a duplicate callback is ingested once", async () => {
    const { id } = await submitBirth("birth", [{ id: "p_child_a", name: "Ava", dob: "2026-09-01" }]);
    await approve("birth", id);
    const b = await sendAndValidate("birth");
    const s = await state("birth");
    const t = s.txns.find((x) => x.order.personId === "p_child_a")!;
    await ok("u_carrier", "birth", { type: "ops.memberResult", txnId: t.id, outcome: "accepted" });
    const ev = { type: "ops.publishObservation" as const, eventId: "cb-1", txnId: t.id, planId: "aetna_standard", tier: "EC", startDate: "2026-09-01", endDate: null, sourceRef: "callback-1" };
    await ok("u_carrier", "birth", ev);
    await ok("u_carrier", "birth", ev);
    const s2 = await state("birth");
    expect(s2.observations.filter((o) => o.eventId === "cb-1")).toHaveLength(1);
    expect(b.recordCount).toBe(2);
  });

  it("a payroll mismatch keeps coverage confirmed but payroll unresolved", async () => {
    const { id } = await submitBirth("birth", [{ id: "p_child_a", name: "Ava", dob: "2026-09-01" }]);
    await approve("birth", id);
    const b = await sendAndValidate("birth");
    await ok("u_carrier", "birth", { type: "ops.publishAccepted", batchId: b.id });
    await ok("u_ops", "birth", { type: "ops.payrollPost", runId: "run_2026-09-30" });
    let s = await state("birth");
    const inst = s.instructions.find((i) => i.benefit === "medical")!;
    await ok("u_daniel", "birth", { type: "hr.authorizePayroll", instructionId: inst.id });
    await ok("u_ops", "birth", { type: "ops.payrollInstruction", instructionId: inst.id, outcome: "accept" });
    await ok("u_ops", "birth", { type: "ops.payrollPost", runId: "run_2026-10-15", override: { benefit: "medical", amountCents: 25000 } });
    s = await state("birth");
    const c = s.cases.find((x) => x.id === id)!;
    expect(s.instructions.find((i) => i.id === inst.id)!.state).toBe("mismatch");
    expect(c.lines.every((l) => l.coverageState === "confirmed_current")).toBe(true);
    expect(c.completedAt).toBeUndefined();
    await ok("u_daniel", "birth", { type: "hr.requestPayrollCorrection", instructionId: inst.id });
    s = await state("birth");
    const corr = s.instructions.find((i) => i.correctionOf === inst.id)!;
    expect(corr.adjustmentCents).toBe(20000);
  });

  it("existing child: composite tier unchanged, still transmitted, payroll verified unchanged", async () => {
    const { id } = await submitBirth("divorce", [{ id: "p_child_n", name: "Nia", dob: "2026-09-20" }]);
    await approve("divorce", id);
    let c = await caseById("divorce", id);
    expect(c.lines.map((l) => l.action)).toEqual(["add"]);
    expect(c.lines[0].tierAfter).toBe("FAM");
    const b = await sendAndValidate("divorce");
    await ok("u_carrier", "divorce", { type: "ops.publishAccepted", batchId: b.id });
    const s = await state("divorce");
    expect(s.instructions.find((i) => i.caseId === id)!.state).toBe("verified_no_change");
    c = s.cases.find((x) => x.id === id)!;
    expect(c.completedAt).toBeTruthy();
  });

  it("day 31 birth request goes to HR timing review, not denial; receipt preserved", async () => {
    for (let i = 0; i < 5; i++) await ok("u_ops", "birth", { type: "ops.clock", advance: "plus_day" }); // Oct 2
    const d = await ok("u_maya", "birth", { type: "case.createDraft", eventCode: "birth" });
    let c = await caseById("birth", d.entityId!);
    await ok("u_maya", "birth", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { children: [{ personId: "p_child_a", firstName: "Ava", lastName: "Shah", dob: "2026-09-01", ssnStatus: "on_file" }], explanation: "Hospital paperwork was delayed." } });
    c = await caseById("birth", d.entityId!);
    expect(c.evaluation!.timing.status).toBe("late");
    await ok("u_maya", "birth", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true, asReviewRequest: true });
    c = await caseById("birth", d.entityId!);
    expect(c.status).toBe("submitted");
    expect(c.evaluation!.checks.find((k) => k.id === "timing")!.result).toBe("needs_review");
  });

  it("six-month-late divorce: specialist review, no automatic backdate or refund", async () => {
    const d = await ok("u_maya", "divorce", { type: "case.createDraft", eventCode: "divorce" });
    let c = await caseById("divorce", d.entityId!);
    await ok("u_maya", "divorce", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { direction: "remove_from_nexa", divorceFinal: true, eventDate: "2026-03-16", formerSpousePersonId: "p_arjun", childCoverageOrder: "none", explanation: "I did not know I had to report it." } });
    c = await caseById("divorce", d.entityId!);
    expect(c.evaluation!.timing.status).toBe("late");
    expect(c.evaluation!.checks.find((k) => k.id === "late_divorce")!.result).toBe("needs_review");
    expect(c.evaluation!.adjustmentForecast?.adjustmentCents ?? 0).toBe(0);
    expect(c.evaluation!.adjustmentForecast?.basis).toContain("Payroll review required");
    await ok("u_maya", "divorce", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true, asReviewRequest: true });
    c = await caseById("divorce", d.entityId!);
    const r = await run("u_daniel", "divorce", { type: "hr.approve", caseId: c.id, expectedVersion: c.version, revisionNo: c.revisions.at(-1)!.revisionNo });
    expect(r.status).toBe(422);
  });

  it("reset affects only the selected scenario", async () => {
    await ok("u_maya", "birth", { type: "case.createDraft", eventCode: "birth" });
    await ok("u_maya", "divorce", { type: "case.createDraft", eventCode: "divorce" });
    const wrong = await run("u_ops", "birth", { type: "ops.reset", confirmScenario: "divorce" });
    expect(wrong.status).toBe(422);
    await ok("u_ops", "birth", { type: "ops.reset", confirmScenario: "birth" });
    expect((await state("birth")).cases.filter((c) => !c.background)).toHaveLength(0);
    expect((await state("divorce")).cases.filter((c) => !c.background)).toHaveLength(1);
  });

  it("a material reply after approval invalidates the approval", async () => {
    const { id } = await submitBirth("birth", [{ id: "p_child_a", name: "Ava", dob: "2026-09-01" }]);
    let c = await caseById("birth", id);
    const info = await ok("u_daniel", "birth", { type: "hr.requestInformation", caseId: id, expectedVersion: c.version, reason: "Check the date of birth", items: ["Confirm Ava's date of birth"], dueDate: "2026-10-02", employeeMessage: "Please confirm Ava's date of birth on the hospital record." });
    c = await caseById("birth", id);
    await ok("u_maya", "birth", { type: "case.respond", caseId: id, expectedVersion: c.version, taskId: info.taskIds![0], message: "It is September 2.", facts: { children: [{ personId: "p_child_a", firstName: "Ava", lastName: "Shah", dob: "2026-09-02", ssnStatus: "on_file" }] } });
    c = await caseById("birth", id);
    expect(c.revisions.at(-1)!.material).toBe(true);
    expect(c.status).toBe("under_review");
    expect(c.receipt!.revisionNo).toBe(1); // original receipt kept
  });

  it("a rule or rate change flags open cases without rewriting the approval", async () => {
    const { id } = await submitBirth("birth", [{ id: "p_child_a", name: "Ava", dob: "2026-09-01" }]);
    await approve("birth", id);
    const before = (await caseById("birth", id)).approvals[0];
    await ok("u_ops", "birth", { type: "ops.rateChange", note: "Aetna Standard EC rate revised for 2026.2" });
    const s = await state("birth");
    const c = s.cases.find((x) => x.id === id)!;
    expect(c.approvals[0]).toEqual(before);
    expect(s.tasks.some((t) => t.caseId === id && t.title === "Rule or rate version changed")).toBe(true);
  });

  it("posting a future pay run moves the business clock to that payday first", async () => {
    await ok("u_ops", "birth", { type: "ops.payrollPost", runId: "run_2026-10-15" });
    const s = await state("birth");
    expect(s.clock.businessNow).toBe("2026-10-15T13:00:00.000Z");
    expect(s.payRuns.filter((r) => ["run_2026-09-30", "run_2026-10-15"].includes(r.id)).every((r) => r.status === "posted")).toBe(true);
  });
});
