import { describe, expect, it } from "vitest";
import type { Extraction } from "@/lib/contracts/ai";
import type { ChangeOrder, QleCase } from "@/lib/contracts/domain";
import { toProposedFacts } from "@/server/ai/evidence";
import { build834, insReasons, validate834 } from "@/server/domain/edi";
import { explain834 } from "@/lib/edi834-explain";
import { getStore } from "@/server/store/store";
import { caseById, freshStore, ok, state } from "./helpers";

const extraction = (people: { name: string; role: string }[]): Extraction =>
  ({ readable: true, documentType: "Hospital record", eventDate: "2026-09-01", coverageEndDate: null, lastWorkday: null, people, sources: [], uncertainFields: [] }) as unknown as Extraction;

const birthCase = (first: string, last: string) =>
  ({ eventCode: "birth", employeeName: "Maya Shah", facts: { children: [{ personId: "p_child_a", firstName: first, lastName: last, dob: "2026-09-01", ssnStatus: "pending" }] } }) as unknown as QleCase;

describe("name check against the form", () => {
  it("flags a child's name typed differently from the document", () => {
    const facts = toProposedFacts(extraction([{ name: "Ava Shah", role: "child" }, { name: "Arjun Shah", role: "father" }]), birthCase("Eva", "Shah"), ["Maya Shah", "Arjun Shah"]);
    const ava = facts.find((f) => f.value === "Ava Shah")!;
    expect(ava.conflictWith?.formValue).toBe("Eva Shah");
    expect(facts.find((f) => f.value === "Arjun Shah")!.conflictWith).toBeUndefined();
  });

  it("does not flag a matching name (case and spacing ignored)", () => {
    const facts = toProposedFacts(extraction([{ name: "AVA  shah", role: "child" }]), birthCase("Ava", "Shah"), ["Maya Shah"]);
    expect(facts.some((f) => f.conflictWith)).toBe(false);
  });

  it("correcting the form to the document fixes the child's name and lifts the score", async () => {
    freshStore(false);
    const d = await ok("u_maya", "birth", { type: "case.createDraft", eventCode: "birth" });
    let c = await caseById("birth", d.entityId!);
    await ok("u_maya", "birth", { type: "case.updateDraft", caseId: c.id, expectedVersion: c.version, facts: { children: [{ personId: "p_child_a", firstName: "Eva", lastName: "Shah", dob: "2026-09-01", ssnStatus: "pending" }] } });
    const store = getStore();
    const s = await store.load("birth");
    s.evidence.push({ id: "ev_name", caseId: c.id, fileName: "hospital.pdf", mimeType: "application/pdf", sizeBytes: 1, sha256: "x", storagePath: "x", uploadedBy: "u_maya", uploadedAt: s.clock.businessNow, status: "needs_confirmation", readMode: "model", documentType: "Hospital record", proposedFacts: [{ field: "personName", label: "Person named (child)", value: "Ava Shah", page: 1, quote: "Ava Shah", confirmed: null, conflictWith: { formValue: "Eva Shah" } }], readNote: null, confidence: 60 });
    s.rev += 1;
    await store.commit(s);
    c = await caseById("birth", c.id);
    await ok("u_maya", "birth", { type: "case.confirmFact", caseId: c.id, expectedVersion: c.version, fileId: "ev_name", factIndex: 0, choice: "document" });
    c = await caseById("birth", c.id);
    expect(c.facts.children![0].firstName).toBe("Ava");
    expect((await state("birth")).evidence.find((e) => e.id === "ev_name")!.confidence).toBe(100);
  });
});

describe("EDI 834 file", () => {
  const order = (over: Partial<ChangeOrder>): ChangeOrder => ({ operationKey: "op1", employerId: "emp_nexa", groupNumber: "NEXA-001", subscriberId: "S100", personId: "p_child_a", memberName: "Ava Shah", relationship: "child", dob: "2026-09-01", benefit: "medical", planId: "aetna_std", action: "add", tier: "EC", startDate: "2026-09-01", endDate: null, caseId: "case_b1", caseNumber: "QLE-1", approvedRevision: 1, ssnStatus: "pending", ...over });

  it("builds a valid envelope with header counts, reason codes and member loops", () => {
    const orders = [order({}), order({ operationKey: "op2", personId: "p_maya", memberName: "Maya Shah", relationship: "self", action: "tier_change", tier: "EC" })];
    const text = build834({ id: "batch_b1", controlNumber: "101", sentAt: "2026-09-28T02:00:00.000Z" }, orders, insReasons([{ id: "case_b1", eventCode: "birth" }]));
    expect(validate834(text, 2).ok).toBe(true);
    expect(text).toContain("ISA*00*");
    expect(text).toContain("*260927*2200*"); // 10:00 PM Eastern on Sep 27
    expect(text).toContain("QTY*TO*2~");
    expect(text).toContain("INS*N*19*021*02*A~"); // child, add, birth
    expect(text).toContain("INS*Y*18*001*02*A***FT~"); // subscriber, change
    expect(text).toContain("HD*021**HLT*AETNA_STD*ECH~");
    const lines = explain834(text);
    expect(lines.find((l) => l.segment.startsWith("INS*N"))!.meaning).toBe("Member record: child, add, reason birth");
    expect(lines.at(-1)!.meaning).toBe("End of interchange");
  });
});
