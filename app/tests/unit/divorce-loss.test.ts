import { beforeEach, describe, expect, it } from "vitest";
import { attachEvidence, caseById, freshStore, ok, run, state } from "./helpers";
import { employeeView } from "@/server/views";
import { userById } from "@/server/config/identities";

async function throughCarrier(scenario: "divorce" | "loss", id: string) {
  await ok("u_ops", scenario, { type: "ops.clock", advance: "next_batch" });
  const s = await state(scenario);
  for (const b of s.batches.filter((x) => x.transport === "pending")) {
    await ok("u_carrier", scenario, { type: "ops.batchTransport", batchId: b.id, outcome: "received" });
    await ok("u_carrier", scenario, { type: "ops.batchValidation", batchId: b.id, outcome: "accepted" });
    await ok("u_carrier", scenario, { type: "ops.publishAccepted", batchId: b.id });
  }
  // API route (dental/vision)
  const s2 = await state(scenario);
  for (const t of s2.txns.filter((x) => x.route === "api" && x.caseId === id && !x.superseded)) {
    await ok("u_carrier", scenario, { type: "ops.publishAccepted", batchId: t.id });
  }
}

describe("divorce", () => {
  beforeEach(() => freshStore());

  it("removes only Arjun, keeps Leela, reduces $450 → $284, COBRA handoff, private fields hidden", async () => {
    const d = await ok("u_maya", "divorce", { type: "case.createDraft", eventCode: "divorce" });
    const id = d.entityId!;
    let c = await caseById("divorce", id);
    await ok("u_maya", "divorce", { type: "case.updateDraft", caseId: id, expectedVersion: c.version, facts: { direction: "remove_from_nexa", divorceFinal: true, eventDate: "2026-09-15", formerSpousePersonId: "p_arjun", childCoverageOrder: "none", formerSpouseContactKnown: true } });
    c = await caseById("divorce", id);
    expect(c.evaluation!.timing.status).toBe("within_window");
    expect(c.evaluation!.totalBeforeCents).toBe(45000);
    expect(c.evaluation!.totalAfterCents).toBe(28400);
    expect(c.evaluation!.proposedLines.filter((l) => l.action === "terminate").every((l) => l.personId === "p_arjun" && l.endDate === "2026-09-30")).toBe(true);
    expect(c.evaluation!.proposedLines.some((l) => l.personId === "p_leela")).toBe(false);
    const ev = await attachEvidence("divorce", id);
    c = await caseById("divorce", id);
    await ok("u_maya", "divorce", { type: "case.submit", caseId: id, expectedVersion: c.version, attestation: true });
    let s = await state("divorce");
    const ref = s.cobra.find((r) => r.caseId === id)!;
    expect(ref.state).toBe("review_needed"); // created at identification, before carrier work
    c = await caseById("divorce", id);
    await ok("u_daniel", "divorce", { type: "hr.reviewEvidence", caseId: id, expectedVersion: c.version, fileId: ev, outcome: "accept" });
    c = await caseById("divorce", id);
    await ok("u_daniel", "divorce", { type: "hr.approve", caseId: id, expectedVersion: c.version, revisionNo: c.revisions.at(-1)!.revisionNo });
    await ok("u_daniel", "divorce", { type: "hr.sendCobraReferral", referralId: ref.id, contactRoute: "verified_address_on_file" });
    await throughCarrier("divorce", id);
    s = await state("divorce");
    c = s.cases.find((x) => x.id === id)!;
    expect(c.lines.filter((l) => l.action === "terminate").every((l) => l.coverageState === "end_confirmed")).toBe(true);
    const insts = s.instructions.filter((i) => i.caseId === id);
    expect(insts.reduce((a, i) => a + i.newRecurringCents, 0)).toBe(28400);
    expect(insts.every((i) => i.adjustmentCents === 0)).toBe(true); // no September refund
    // Leela still covered on the carrier roster
    expect(s.roster.filter((r) => r.personId === "p_leela" && r.endDate === null)).toHaveLength(3);
    expect(c.completedAt).toBeUndefined(); // payroll and COBRA receipt still open
    for (const i of insts) await ok("u_ops", "divorce", { type: "ops.payrollInstruction", instructionId: i.id, outcome: "accept" });
    await ok("u_ops", "divorce", { type: "ops.payrollPost", runId: "run_2026-09-30" });
    await ok("u_ops", "divorce", { type: "ops.payrollPost", runId: "run_2026-10-15" });
    c = await caseById("divorce", id);
    expect(c.completedAt).toBeUndefined(); // administrator has not acknowledged
    await ok("u_cobra", "divorce", { type: "ops.cobra", referralId: ref.id, action: "acknowledge" });
    s = await state("divorce");
    c = s.cases.find((x) => x.id === id)!;
    expect(c.completedAt).toBeTruthy();
    expect(s.ledger.filter((d) => d.runId === "run_2026-10-15").reduce((a, d) => a + d.amountCents, 0)).toBe(28400);
    // Employee view never contains the former spouse's private contact
    const view = await employeeView(userById("u_maya")!, "divorce", id);
    expect(JSON.stringify(view)).not.toContain("Hudson Row");
    expect(JSON.stringify(view)).not.toContain("arjun.private");
  });

  it("outside-plan direction creates no Nexa termination or COBRA referral", async () => {
    const d = await ok("u_maya", "divorce", { type: "case.createDraft", eventCode: "divorce" });
    let c = await caseById("divorce", d.entityId!);
    await ok("u_maya", "divorce", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { direction: "lost_outside_coverage", eventDate: "2026-09-15" } });
    c = await caseById("divorce", d.entityId!);
    expect(c.evaluation!.proposedLines).toHaveLength(0);
    const s = await state("divorce");
    expect(s.cobra).toHaveLength(0);
  });

  it("an unfinalized divorce cannot terminate coverage", async () => {
    const d = await ok("u_maya", "divorce", { type: "case.createDraft", eventCode: "divorce" });
    let c = await caseById("divorce", d.entityId!);
    await ok("u_maya", "divorce", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { direction: "remove_from_nexa", divorceFinal: false, eventDate: "2026-09-15", formerSpousePersonId: "p_arjun", childCoverageOrder: "none" } });
    c = await caseById("divorce", d.entityId!);
    expect(c.evaluation!.checks.find((k) => k.id === "divorce_final")!.result).toBe("needs_information");
    await ok("u_maya", "divorce", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true, asReviewRequest: true });
    c = await caseById("divorce", d.entityId!);
    const r = await run("u_daniel", "divorce", { type: "hr.approve", caseId: c.id, expectedVersion: c.version, revisionNo: 1 });
    expect(r.status).toBe(422);
  });
});

describe("loss of other coverage", () => {
  beforeEach(() => freshStore());

  async function draft(facts: Record<string, unknown>) {
    const d = await ok("u_maya", "loss", { type: "case.createDraft", eventCode: "loss_of_other_coverage" });
    const c = await caseById("loss", d.entityId!);
    await ok("u_maya", "loss", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts });
    return caseById("loss", d.entityId!);
  }

  it("uses Oct 31 coverage end (not Oct 12 last workday), starts Nov 1, $166 → $332, no catch-up", async () => {
    let c = await draft({ lostCoveragePersonIds: ["p_arjun"], lossReason: "employment_ended", lastWorkday: "2026-10-12", coverageEndDate: "2026-10-31", priorEmployer: "Harbor Logistics (fictional)" });
    expect(c.evaluation!.proposedLines.filter((l) => l.action === "add").every((l) => l.startDate === "2026-11-01")).toBe(true);
    expect(c.evaluation!.totalBeforeCents).toBe(16600);
    expect(c.evaluation!.totalAfterCents).toBe(33200);
    const ev = await attachEvidence("loss", c.id, [{ field: "personName", label: "Person named", value: "Arjun Shah" }]);
    c = await caseById("loss", c.id);
    await ok("u_maya", "loss", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true });
    c = await caseById("loss", c.id);
    await ok("u_daniel", "loss", { type: "hr.reviewEvidence", caseId: c.id, expectedVersion: c.version, fileId: ev, outcome: "accept" });
    c = await caseById("loss", c.id);
    await ok("u_daniel", "loss", { type: "hr.approve", caseId: c.id, expectedVersion: c.version, revisionNo: c.revisions.at(-1)!.revisionNo });
    // Current election unchanged until the carrier confirms
    let s = await state("loss");
    expect(s.elections.find((e) => e.benefit === "medical" && e.effectiveTo === null)!.tier).toBe("EE");
    await throughCarrier("loss", c.id);
    s = await state("loss");
    c = s.cases.find((x) => x.id === c.id)!;
    expect(c.lines.filter((l) => l.action === "add").every((l) => l.coverageState === "confirmed_current" || l.coverageState === "confirmed_future")).toBe(true);
    const insts = s.instructions.filter((i) => i.caseId === c.id);
    expect(insts.reduce((a, i) => a + i.newRecurringCents, 0)).toBe(33200);
    expect(insts.every((i) => i.adjustmentCents === 0)).toBe(true);
    expect(s.payRuns.find((r) => r.id === insts[0].targetRunId)!.payday).toBe("2026-11-13");
    expect(s.cobra).toHaveLength(0);
  });

  it("a notice that does not name Arjun blocks approval until a named notice arrives through HR's request", async () => {
    let c = await draft({ lostCoveragePersonIds: ["p_arjun"], lossReason: "employment_ended", lastWorkday: "2026-10-12", coverageEndDate: "2026-10-31" });
    const bad = await attachEvidence("loss", c.id, [{ field: "coverageEndDate", label: "Date other coverage ends", value: "2026-10-31" }]);
    c = await caseById("loss", c.id);
    expect(c.evaluation!.checks.find((k) => k.id === "evidence_names")).toBeUndefined(); // evaluation refreshes on the next change
    await ok("u_maya", "loss", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true });
    c = await caseById("loss", c.id);
    await ok("u_daniel", "loss", { type: "hr.reviewEvidence", caseId: c.id, expectedVersion: c.version, fileId: bad, outcome: "accept" });
    c = await caseById("loss", c.id);
    const names = c.evaluation!.checks.find((k) => k.id === "evidence_names")!;
    expect(names.result).toBe("needs_information");
    expect(names.reason).toContain("does not name Arjun Shah");
    const blocked = await run("u_daniel", "loss", { type: "hr.approve", caseId: c.id, expectedVersion: c.version, revisionNo: c.revisions.at(-1)!.revisionNo });
    expect(blocked.status).toBe(422);
    const req = await ok("u_daniel", "loss", { type: "hr.requestInformation", caseId: c.id, expectedVersion: c.version, reason: "The notice does not name Arjun", items: ["A notice that names Arjun Shah and the coverage end date"], dueDate: "2026-11-05", employeeMessage: "Please upload a notice from Harbor Logistics that names Arjun." });
    const good = await attachEvidence("loss", c.id, [{ field: "personName", label: "Person named", value: "Arjun Shah" }]);
    c = await caseById("loss", c.id);
    await ok("u_maya", "loss", { type: "case.respond", caseId: c.id, expectedVersion: c.version, taskId: req.taskIds![0], message: "Uploaded the notice that names Arjun." });
    c = await caseById("loss", c.id);
    await ok("u_daniel", "loss", { type: "hr.reviewEvidence", caseId: c.id, expectedVersion: c.version, fileId: good, outcome: "accept" });
    c = await caseById("loss", c.id);
    expect(c.evaluation!.checks.find((k) => k.id === "evidence_names")!.result).toBe("passed");
    await ok("u_daniel", "loss", { type: "hr.approve", caseId: c.id, expectedVersion: c.version, revisionNo: c.revisions.at(-1)!.revisionNo });
  });

  it("first request on Nov 2 returns Dec 1 and flags a possible gap", async () => {
    await ok("u_ops", "loss", { type: "ops.clock", advance: "plus_day" });
    await ok("u_ops", "loss", { type: "ops.clock", advance: "plus_day" });
    const c = await draft({ lostCoveragePersonIds: ["p_arjun"], lossReason: "employment_ended", lastWorkday: "2026-10-12", coverageEndDate: "2026-10-31" });
    expect(c.evaluation!.proposedLines.find((l) => l.action === "add")!.startDate).toBe("2026-12-01");
    expect(c.evaluation!.checks.find((k) => k.id === "gap")!.result).toBe("needs_review");
  });

  it("nonpayment and voluntary cancellation route to review; job dismissal for cause does not", async () => {
    for (const reason of ["nonpayment", "voluntary_cancellation", "cobra_cancelled_early"]) {
      const c = await draft({ lostCoveragePersonIds: ["p_arjun"], lossReason: reason, coverageEndDate: "2026-10-31" });
      expect(c.evaluation!.checks.find((k) => k.id === "loss_reason")!.result).toBe("needs_review");
    }
    const ok1 = await draft({ lostCoveragePersonIds: ["p_arjun"], lossReason: "cobra_exhausted", coverageEndDate: "2026-10-31" });
    expect(ok1.evaluation!.checks.find((k) => k.id === "loss_reason")!.result).toBe("passed");
    const fired = await draft({ lostCoveragePersonIds: ["p_arjun"], lossReason: "employment_ended", coverageEndDate: "2026-10-31" });
    expect(fired.evaluation!.checks.find((k) => k.id === "loss_reason")!.reason).toContain("not the plan-coverage fraud exclusion");
  });

  it("a state move blocks approval until an authorized review is recorded", async () => {
    const c = await draft({ lostCoveragePersonIds: ["p_arjun"], lossReason: "employment_ended", coverageEndDate: "2026-10-31", residenceStateChanged: "CA" });
    expect(c.evaluation!.checks.find((k) => k.id === "jurisdiction")!.result).toBe("needs_review");
    expect(c.evaluation!.checks.find((k) => k.id === "jurisdiction")!.reason).toContain("State rule review required");
  });
});

describe("permissions", () => {
  beforeEach(() => freshStore());
  it("HR cannot read another employer's case; Maya cannot read someone else's", async () => {
    const s = await state("birth");
    const orbit = s.cases.find((c) => c.employerId === "emp_orbit")!;
    const r = await run("u_daniel", "birth", { type: "hr.addNote", caseId: orbit.id, note: "peek" });
    expect(r.status).toBe(404);
    const other = s.cases.find((c) => c.background && c.employerId === "emp_nexa")!;
    await expect(employeeView(userById("u_maya")!, "birth", other.id)).rejects.toThrow();
  });
  it("broker cannot act on an unassigned task", async () => {
    const s = await state("birth");
    const t = s.tasks[0];
    const r = await run("u_priya", "birth", { type: "broker.recordSubmission", taskId: t.id, reference: "PORTAL-1" });
    expect(r.status).toBe(404);
  });
});

describe("COBRA election notice from the portal", () => {
  it("HR sends the notice to the beneficiary only after the administrator acknowledges", async () => {
    const { freshStore: fresh, ok: okc, run: runc, state: st, caseById: byId, attachEvidence: attach } = await import("./helpers");
    fresh(true);
    const d = await okc("u_maya", "divorce", { type: "case.createDraft", eventCode: "divorce" });
    let c = await byId("divorce", d.entityId!);
    await okc("u_maya", "divorce", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { direction: "remove_from_nexa", divorceFinal: true, eventDate: "2026-09-15", formerSpousePersonId: "p_arjun", childCoverageOrder: "none", formerSpouseContactKnown: true } });
    await attach("divorce", c.id);
    c = await byId("divorce", c.id);
    await okc("u_maya", "divorce", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true });
    const s0 = await st("divorce");
    const r0 = s0.cobra.find((x) => x.caseId === c.id)!;
    expect((await runc("u_daniel", "divorce", { type: "hr.sendCobraNotice", referralId: r0.id })).status).toBe(422);
    const store = (await import("@/server/store/store")).getStore();
    const s = await store.load("divorce");
    const r = s.cobra.find((x) => x.id === r0.id)!;
    r.state = "received";
    r.receivedAt = s.clock.businessNow;
    s.rev += 1;
    await store.commit(s);
    const out = await okc("u_daniel", "divorce", { type: "hr.sendCobraNotice", referralId: r.id });
    expect(out.message).toContain("Arjun Shah");
    const after = await st("divorce");
    const mail = after.outbox.find((n) => n.key === `cobra_notice:${r.id}`)!;
    expect(mail.recipientEmail).toBe("arjun.private@example.invalid");
    expect(mail.preview).toContain("Dear Arjun Shah");
    expect(mail.recipientRole).toBe("beneficiary");
    expect(after.outbox.some((n) => n.recipientUserId === "u_maya" && n.subject.includes("COBRA continuation coverage rights"))).toBe(false);
    expect(after.cobra.find((x) => x.id === r.id)!.state).toBe("notice_tracked");
  });
});
