import { beforeEach, describe, expect, it } from "vitest";
import { attachEvidence, caseById, freshStore, ok, state } from "./helpers";
import type { ScenarioId } from "@/lib/contracts/domain";

// Autopilot: a clean case runs from submission to "enrolled, pay update scheduled"
// with no manual step. Problems still stop for a person.
describe("autopilot", () => {
  beforeEach(() => freshStore(true));

  it("birth: straight-through approval, instant carrier confirmation, catch-up authorized by policy", async () => {
    const d = await ok("u_maya", "birth", { type: "case.createDraft", eventCode: "birth" });
    let c = await caseById("birth", d.entityId!);
    await ok("u_maya", "birth", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { children: [{ personId: "p_child_a", firstName: "Ava", lastName: "Shah", dob: "2026-09-01", ssnStatus: "pending" }] } });
    await markAutoVerified("birth", c.id);
    c = await caseById("birth", c.id);
    await ok("u_maya", "birth", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true });
    const s = await state("birth");
    c = s.cases.find((x) => x.id === c.id)!;
    expect(c.status).toBe("approved");
    expect(c.approvals[0].actor).toBe("system_rules");
    expect(c.lines.every((l) => l.coverageState === "confirmed_current")).toBe(true);
    const inst = s.instructions.find((i) => i.caseId === c.id)!;
    // Approved Sep 27, before the Sep 30 cutoff: only the Sep 15 paycheck was short (USD 100).
    expect(inst.adjustmentCents).toBe(10000);
    expect(inst.state).toBe("instruction_accepted");
    // Completion still waits for the posted paycheck.
    expect(c.completedAt).toBeUndefined();
    await ok("u_ops", "birth", { type: "ops.payrollPost", runId: "run_2026-09-30" });
    const s2 = await state("birth");
    expect(s2.ledger.filter((x) => x.runId === "run_2026-09-30").reduce((a, x) => a + x.amountCents, 0)).toBe(36600);
    expect(s2.cases.find((x) => x.id === c.id)!.completedAt).toBeTruthy();
  });

  it("divorce: removal confirmed and COBRA referral sent and acknowledged automatically", async () => {
    const d = await ok("u_maya", "divorce", { type: "case.createDraft", eventCode: "divorce" });
    let c = await caseById("divorce", d.entityId!);
    await ok("u_maya", "divorce", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { direction: "remove_from_nexa", divorceFinal: true, eventDate: "2026-09-15", formerSpousePersonId: "p_arjun", childCoverageOrder: "none", formerSpouseContactKnown: true } });
    await markAutoVerified("divorce", c.id);
    c = await caseById("divorce", c.id);
    await ok("u_maya", "divorce", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true });
    const s = await state("divorce");
    c = s.cases.find((x) => x.id === c.id)!;
    expect(c.status).toBe("approved");
    expect(c.lines.filter((l) => l.action === "terminate").every((l) => l.coverageState === "end_confirmed")).toBe(true);
    expect(s.cobra.find((r) => r.caseId === c.id)!.state).toBe("received");
    await ok("u_ops", "divorce", { type: "ops.payrollPost", runId: "run_2026-10-15" });
    expect((await caseById("divorce", c.id)).completedAt).toBeTruthy();
  });

  it("loss: enrolled from Nov 1 automatically; the problem document still stops for HR", async () => {
    const facts = { lostCoveragePersonIds: ["p_arjun"], lossReason: "employment_ended", lastWorkday: "2026-10-12", coverageEndDate: "2026-10-31" };
    const d = await ok("u_maya", "loss", { type: "case.createDraft", eventCode: "loss_of_other_coverage" });
    let c = await caseById("loss", d.entityId!);
    await ok("u_maya", "loss", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts });
    await markAutoVerified("loss", c.id, "Arjun Shah");
    c = await caseById("loss", c.id);
    await ok("u_maya", "loss", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true });
    c = await caseById("loss", c.id);
    expect(c.status).toBe("approved");
    expect(c.lines.filter((l) => l.action === "add").every((l) => l.startDate === "2026-11-01" && l.coverageState !== "awaiting_confirmation")).toBe(true);

  });

  it("loss: a document under 100% is not approved automatically", async () => {
    const facts = { lostCoveragePersonIds: ["p_arjun"], lossReason: "employment_ended", lastWorkday: "2026-10-12", coverageEndDate: "2026-10-31" };
    const d = await ok("u_maya", "loss", { type: "case.createDraft", eventCode: "loss_of_other_coverage" });
    let c = await caseById("loss", d.entityId!);
    await ok("u_maya", "loss", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts });
    await attachEvidence("loss", c.id, [{ field: "coverageEndDate", label: "Date other coverage ends", value: "2026-10-31" }]);
    c = await caseById("loss", c.id);
    await ok("u_maya", "loss", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true });
    expect((await caseById("loss", c.id)).status).toBe("submitted");
  });

  it("a wrong carrier date still stops for HR, and the correction then runs automatically", async () => {
    await ok("u_ops", "birth", { type: "ops.preset", preset: "carrier_wrong_start_date" });
    const d = await ok("u_maya", "birth", { type: "case.createDraft", eventCode: "birth" });
    let c = await caseById("birth", d.entityId!);
    await ok("u_maya", "birth", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { children: [{ personId: "p_child_a", firstName: "Ava", lastName: "Shah", dob: "2026-09-01", ssnStatus: "pending" }] } });
    await markAutoVerified("birth", c.id);
    c = await caseById("birth", c.id);
    await ok("u_maya", "birth", { type: "case.submit", caseId: c.id, expectedVersion: c.version, attestation: true });
    c = await caseById("birth", c.id);
    const ava = c.lines.find((l) => l.personId === "p_child_a")!;
    expect(ava.coverageState).toBe("mismatch");
    await ok("u_daniel", "birth", { type: "hr.sendCorrection", caseId: c.id, lineId: ava.id });
    c = await caseById("birth", c.id);
    expect(c.lines.every((l) => l.coverageState === "confirmed_current")).toBe(true);
  });
});

async function markAutoVerified(scenario: ScenarioId, caseId: string, name?: string) {
  const { getStore } = await import("@/server/store/store");
  const store = getStore();
  const s = await store.load(scenario);
  s.evidence.push({
    id: `ev_auto_${Math.random().toString(36).slice(2, 8)}`,
    caseId,
    fileName: "happy.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    sha256: "x",
    storagePath: "x",
    uploadedBy: "u_maya",
    uploadedAt: s.clock.businessNow,
    status: "accepted_for_review",
    readMode: "model",
    documentType: "Synthetic happy-path document",
    proposedFacts: name ? [{ field: "personName", label: "Person named", value: name, page: 1, quote: name, confirmed: { choice: "document", value: name, by: "ai_auto", at: s.clock.businessNow } }] : [],
    readNote: null,
    reviewedBy: "ai_auto",
    reviewedAt: s.clock.businessNow,
    confidence: 100,
    confidenceSummary: "All key facts match.",
  });
  s.rev += 1;
  await store.commit(s);
}
