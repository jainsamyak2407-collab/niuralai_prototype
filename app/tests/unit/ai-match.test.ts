import { describe, expect, it } from "vitest";
import type { ScenarioId } from "@/lib/contracts/domain";
import { getStore } from "@/server/store/store";
import { caseById, freshStore, ok, run, state } from "./helpers";

// A conflicting document at 60%: the form says one date, the document another.
async function conflictDoc(scenario: ScenarioId, caseId: string, docDate: string, formDate: string) {
  const store = getStore();
  const s = await store.load(scenario);
  const id = `ev_conf_${Math.random().toString(36).slice(2, 8)}`;
  s.evidence.push({
    id, caseId, fileName: "decree.pdf", mimeType: "application/pdf", sizeBytes: 1000, sha256: "x", storagePath: "x", uploadedBy: "u_maya",
    uploadedAt: s.clock.businessNow, status: "needs_confirmation", readMode: "model", documentType: "Divorce fact summary",
    proposedFacts: [{ field: "eventDate", label: "Date the divorce became final", value: docDate, page: 1, quote: docDate, confirmed: null, conflictWith: { formValue: formDate } }],
    readNote: null, confidence: 60, confidenceSummary: "1 item needs attention.",
  });
  s.rev += 1;
  await store.commit(s);
  return id;
}

async function divorceDraft(formDate: string) {
  const d = await ok("u_maya", "divorce", { type: "case.createDraft", eventCode: "divorce" });
  const c = await caseById("divorce", d.entityId!);
  await ok("u_maya", "divorce", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { direction: "remove_from_nexa", divorceFinal: true, eventDate: formDate, formerSpousePersonId: "p_arjun", childCoverageOrder: "none", formerSpouseContactKnown: true } });
  return c.id;
}

describe("AI match after resolving a conflict", () => {
  it("choosing the document's date corrects the form and scores 100%, but HR still approves", async () => {
    freshStore(true);
    const id = await divorceDraft("2026-09-23");
    const fileId = await conflictDoc("divorce", id, "2026-09-15", "2026-09-23");
    let c = await caseById("divorce", id);
    const r = await ok("u_maya", "divorce", { type: "case.confirmFact", caseId: id, expectedVersion: c.version, fileId, factIndex: 0, choice: "document" });
    expect(r.message).toContain("AI match 100%");
    const f = (await state("divorce")).evidence.find((e) => e.id === fileId)!;
    expect(f.confidence).toBe(100);
    expect(f.reviewedBy).toBe("ai_auto");
    c = await caseById("divorce", id);
    expect(c.facts.eventDate).toBe("2026-09-15");
    await ok("u_maya", "divorce", { type: "case.submit", caseId: id, expectedVersion: c.version, attestation: true });
    expect((await caseById("divorce", id)).status).toBe("submitted");
  });

  it("keeping the form's date against the document stays below 100% and waits for HR", async () => {
    freshStore(true);
    const id = await divorceDraft("2026-09-23");
    const fileId = await conflictDoc("divorce", id, "2026-09-15", "2026-09-23");
    let c = await caseById("divorce", id);
    await ok("u_maya", "divorce", { type: "case.confirmFact", caseId: id, expectedVersion: c.version, fileId, factIndex: 0, choice: "form" });
    const f = (await state("divorce")).evidence.find((e) => e.id === fileId)!;
    expect(f.confidence).toBe(60);
    expect(f.reviewedBy).toBeUndefined();
    c = await caseById("divorce", id);
    await ok("u_maya", "divorce", { type: "case.submit", caseId: id, expectedVersion: c.version, attestation: true });
    expect((await caseById("divorce", id)).status).not.toBe("approved");
  });
});

describe("bulk approval", () => {
  it("approves every 100% case in one action and leaves the rest for review", async () => {
    freshStore(false);
    const id = await divorceDraft("2026-09-23");
    const fileId = await conflictDoc("divorce", id, "2026-09-15", "2026-09-23");
    let c = await caseById("divorce", id);
    await ok("u_maya", "divorce", { type: "case.confirmFact", caseId: id, expectedVersion: c.version, fileId, factIndex: 0, choice: "document" });
    c = await caseById("divorce", id);
    await ok("u_maya", "divorce", { type: "case.submit", caseId: id, expectedVersion: c.version, attestation: true });
    expect((await caseById("divorce", id)).status).toBe("submitted"); // autopilot off: waits for HR

    const s = await state("divorce");
    const samples = s.cases.filter((x) => x.background && x.sampleAiMatch != null);
    const ids = [id, ...samples.map((x) => x.id)];
    const r = await ok("u_daniel", "divorce", { type: "hr.bulkApprove", caseIds: ids });
    expect(r.message).toContain("Approved 4 cases");
    expect(r.message).toContain("1 left for review");
    const after = await state("divorce");
    expect(after.cases.find((x) => x.id === id)!.status).toBe("approved");
    expect(after.cases.find((x) => x.employeeName === "Chris Wong")!.status).toBe("under_review");
  });

  it("refuses when nothing selected is ready, and other employers' cases are ignored", async () => {
    freshStore(false);
    const s = await state("birth");
    const chris = s.cases.find((x) => x.employeeName === "Chris Wong")!;
    const orbit = s.cases.find((x) => x.employerId !== "emp_nexa" && x.background)!;
    const out = await run("u_daniel", "birth", { type: "hr.bulkApprove", caseIds: [chris.id, orbit.id] });
    expect(out.status).toBe(422);
    expect((await state("birth")).cases.find((x) => x.id === orbit.id)!.status).toBe("under_review");
  });
});

describe("AI review summary for HR", () => {
  it("explains a 100% case with verified sources, and lists what to check otherwise", async () => {
    const { aiReview } = await import("@/server/ai/review");
    const { evaluateCase } = await import("@/server/domain/evaluate");
    freshStore(false);
    const id = await divorceDraft("2026-09-23");
    const fileId = await conflictDoc("divorce", id, "2026-09-15", "2026-09-23");
    let s = await state("divorce");
    let c = s.cases.find((x) => x.id === id)!;
    let r = aiReview(s, c, evaluateCase(s, c));
    expect(r.score).toBe(60);
    expect(r.toCheck.some((x) => x.includes("form shows September 23, 2026"))).toBe(true);
    await ok("u_maya", "divorce", { type: "case.confirmFact", caseId: id, expectedVersion: c.version, fileId, factIndex: 0, choice: "document" });
    s = await state("divorce");
    c = s.cases.find((x) => x.id === id)!;
    r = aiReview(s, c, evaluateCase(s, c));
    expect(r.score).toBe(100);
    expect(r.verified.some((x) => x.source.includes("form corrected from September 23, 2026"))).toBe(true);
    expect(r.verified.some((x) => x.source.startsWith("Rule "))).toBe(true);
  });
});
