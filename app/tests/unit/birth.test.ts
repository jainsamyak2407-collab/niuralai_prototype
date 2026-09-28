import { beforeEach, describe, expect, it } from "vitest";
import { attachEvidence, caseById, freshStore, ok, run, state } from "./helpers";

async function birthSubmitted() {
  const d = await ok("u_maya", "birth", { type: "case.createDraft", eventCode: "birth" });
  const id = d.entityId!;
  let c = await caseById("birth", id);
  await ok("u_maya", "birth", { type: "case.updateDraft", caseId: id, expectedVersion: c.version, facts: { children: [{ personId: "p_child_ava", firstName: "Ava", lastName: "Shah", dob: "2026-09-01", ssnStatus: "pending" }] } });
  c = await caseById("birth", id);
  await ok("u_maya", "birth", {
    type: "case.setElections",
    caseId: id,
    expectedVersion: c.version,
    elections: [
      { benefit: "medical", planId: "aetna_standard", addPersonIds: ["p_child_ava"], removePersonIds: [], enroll: true },
      { benefit: "dental", planId: "nexa_dental", addPersonIds: [], removePersonIds: [], enroll: false },
      { benefit: "vision", planId: "nexa_vision", addPersonIds: [], removePersonIds: [], enroll: false },
    ],
  });
  const ev = await attachEvidence("birth", id, [{ field: "eventDate", label: "Date of birth", value: "2026-09-01" }]);
  c = await caseById("birth", id);
  await ok("u_maya", "birth", { type: "case.confirmFact", caseId: id, expectedVersion: c.version, fileId: ev, factIndex: 0, choice: "document" });
  c = await caseById("birth", id);
  const key = "submit-birth-1";
  const sub = await ok("u_maya", "birth", { type: "case.submit", caseId: id, expectedVersion: c.version, attestation: true }, key);
  return { id, ev, sub, key };
}

describe("birth flow", () => {
  beforeEach(() => freshStore());

  it("submits once, preserves receipt, approves, catches a wrong date and repairs it", async () => {
    const { id, ev, sub, key } = await birthSubmitted();
    expect(sub.message).toContain("Congratulations on your new arrival");
    // idempotent resubmission
    const again = await ok("u_maya", "birth", { type: "case.submit", caseId: id, expectedVersion: 1, attestation: true }, key);
    expect(again.entityId).toBe(id);
    let s = await state("birth");
    expect(s.cases.filter((c) => !c.background)).toHaveLength(1);
    const receivedAt = s.cases.find((c) => c.id === id)!.receipt!.receivedAt;
    expect(s.tasks.some((t) => t.caseId === id && t.kind === "ssn_follow_up")).toBe(true);

    // Maya cannot approve her own case
    const forbidden = await run("u_maya", "birth", { type: "hr.approve", caseId: id, expectedVersion: 1, revisionNo: 1 });
    expect(forbidden.status).toBe(403);

    // HR approves the next day; receipt is unchanged
    await ok("u_ops", "birth", { type: "ops.clock", advance: "plus_day" });
    let c = await caseById("birth", id);
    await ok("u_daniel", "birth", { type: "hr.reviewEvidence", caseId: id, expectedVersion: c.version, fileId: ev, outcome: "accept" });
    c = await caseById("birth", id);
    await ok("u_daniel", "birth", { type: "hr.approve", caseId: id, expectedVersion: c.version, revisionNo: c.revisions.at(-1)!.revisionNo });
    c = await caseById("birth", id);
    expect(c.receipt!.receivedAt).toBe(receivedAt);
    expect(c.lines.map((l) => [l.personId, l.action, l.startDate, l.tierAfter])).toEqual([
      ["p_child_ava", "add", "2026-09-01", "EC"],
      ["p_maya", "tier_change", "2026-09-01", "EC"],
    ]);
    // Approval does not mark coverage or change current elections
    s = await state("birth");
    expect(s.elections.find((e) => e.benefit === "medical" && e.effectiveTo === null)!.tier).toBe("EE");

    // Nightly batch (clock → 10 p.m.), transport, file, publish with wrong date preset
    await ok("u_ops", "birth", { type: "ops.clock", advance: "next_batch" });
    s = await state("birth");
    const batch = s.batches[0];
    expect(batch.recordCount).toBe(2);
    await ok("u_carrier", "birth", { type: "ops.batchTransport", batchId: batch.id, outcome: "received" });
    await ok("u_carrier", "birth", { type: "ops.batchValidation", batchId: batch.id, outcome: "accepted" });
    await ok("u_ops", "birth", { type: "ops.preset", preset: "carrier_wrong_start_date" });
    await ok("u_carrier", "birth", { type: "ops.publishAccepted", batchId: batch.id });
    c = await caseById("birth", id);
    const ava = c.lines.find((l) => l.personId === "p_child_ava")!;
    expect(ava.coverageState).toBe("mismatch");
    expect(ava.mismatch!.message).toBe("Ava Shah's requested start is September 1. The carrier record shows October 1.");
    expect(c.lines.find((l) => l.personId === "p_maya")!.coverageState).toBe("confirmed_current");
    expect(c.completedAt).toBeUndefined();
    s = await state("birth");
    expect(s.instructions).toHaveLength(0); // payroll waits for matching carrier evidence

    // Correction for the failed line only
    await ok("u_daniel", "birth", { type: "hr.sendCorrection", caseId: id, lineId: ava.id });
    await ok("u_ops", "birth", { type: "ops.clock", advance: "next_batch" });
    s = await state("birth");
    const b2 = s.batches[1];
    expect(b2.recordCount).toBe(1);
    await ok("u_carrier", "birth", { type: "ops.batchTransport", batchId: b2.id, outcome: "received" });
    await ok("u_carrier", "birth", { type: "ops.batchValidation", batchId: b2.id, outcome: "accepted" });
    await ok("u_carrier", "birth", { type: "ops.publishAccepted", batchId: b2.id });
    c = await caseById("birth", id);
    expect(c.lines.every((l) => l.coverageState === "confirmed_current")).toBe(true);
    expect(c.receipt!.receivedAt).toBe(receivedAt);

    // Stale response for the superseded transaction is kept but ignored
    const stale = await ok("u_carrier", "birth", { type: "ops.publishObservation", eventId: "late-cb-1", txnId: ava.currentTxnId!, planId: "aetna_standard", tier: "EC", startDate: "2026-10-01", endDate: null, sourceRef: "late callback" });
    expect(stale.message).toContain("Stale");
    c = await caseById("birth", id);
    expect(c.lines.every((l) => l.coverageState === "confirmed_current")).toBe(true);

    // Payroll: before Sep 30 posts, the $200 is a labeled forecast
    s = await state("birth");
    let inst = s.instructions.find((i) => i.benefit === "medical")!;
    expect(inst.adjustmentBasis).toContain("Forecast");
    // Clock reaches Sep 30: the payroll simulator posts the old $150; recalculated at authorization
    await ok("u_ops", "birth", { type: "ops.clock", advance: "next_payday" });
    s = await state("birth");
    expect(s.payRuns.find((r) => r.payday === "2026-09-30")!.status).toBe("posted");
    inst = s.instructions.find((i) => i.benefit === "medical")!;
    expect(inst.newRecurringCents).toBe(25000);
    expect(inst.adjustmentCents).toBe(20000);
    expect(inst.state).toBe("approval_needed");
    expect(s.payRuns.find((r) => r.id === inst.targetRunId)!.payday).toBe("2026-10-15");
    await ok("u_daniel", "birth", { type: "hr.authorizePayroll", instructionId: inst.id });
    s = await state("birth");
    expect(s.instructions.find((i) => i.id === inst.id)!.adjustmentCents).toBe(20000);
    expect(s.instructions.find((i) => i.id === inst.id)!.adjustmentBasis).not.toContain("Forecast");
    await ok("u_ops", "birth", { type: "ops.payrollInstruction", instructionId: inst.id, outcome: "accept" });
    await ok("u_ops", "birth", { type: "ops.payrollPost", runId: "run_2026-10-15" });
    s = await state("birth");
    const oct15 = s.ledger.filter((d) => d.runId === "run_2026-10-15").reduce((a, d) => a + d.amountCents, 0);
    expect(oct15).toBe(46600);
    await ok("u_ops", "birth", { type: "ops.payrollPost", runId: "run_2026-10-30" });
    s = await state("birth");
    const oct30 = s.ledger.filter((d) => d.runId === "run_2026-10-30").reduce((a, d) => a + d.amountCents, 0);
    expect(oct30).toBe(26600);
    c = s.cases.find((x) => x.id === id)!;
    expect(s.instructions.find((i) => i.id === inst.id)!.state).toBe("posted");
    expect(c.completedAt).toBeTruthy();
    expect(s.elections.find((e) => e.benefit === "medical" && e.effectiveTo === null)!.coveredPersonIds).toContain("p_child_ava");
    expect(s.outbox.some((n) => n.key.startsWith("complete:"))).toBe(true);
  });

  it("future birth date cannot be submitted", async () => {
    const d = await ok("u_maya", "birth", { type: "case.createDraft", eventCode: "birth" });
    let c = await caseById("birth", d.entityId!);
    await ok("u_maya", "birth", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { children: [{ personId: "p_child_x", firstName: "Baby", lastName: "Shah", dob: "2026-10-20", ssnStatus: "pending" }] } });
    c = await caseById("birth", d.entityId!);
    const r = await run("u_maya", "birth", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true });
    expect(r.status).toBe(422);
    expect(r.body.message).toBe("You can prepare now, but submit the birth request after your child is born.");
  });

  it("stale expectedVersion returns a conflict, not last-write-wins", async () => {
    const d = await ok("u_maya", "birth", { type: "case.createDraft", eventCode: "birth" });
    const r = await run("u_maya", "birth", { type: "case.updateDraft", caseId: d.entityId!, expectedVersion: 99, facts: { explanation: "x" } });
    expect(r.status).toBe(409);
  });
});
