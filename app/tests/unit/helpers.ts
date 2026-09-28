import type { Command } from "@/lib/contracts/commands";
import type { ScenarioId, ScenarioState } from "@/lib/contracts/domain";
import { userById } from "@/server/config/identities";
import { runCommand } from "@/server/runner";
import { getStore, MemoryStore, setStoreForTests } from "@/server/store/store";

let n = 0;
/** Manual step-by-step tests turn autopilot off; autopilot tests pass true. */
export function freshStore(autopilot = false) {
  const s = new MemoryStore(autopilot);
  setStoreForTests(s);
  return s;
}

export async function run(userId: string, scenario: ScenarioId, cmd: Record<string, unknown> & { type: Command["type"] }, key?: string) {
  const user = userById(userId)!;
  const out = await runCommand(user, scenario, { idempotencyKey: key ?? `test-key-${++n}-${Math.random().toString(36).slice(2)}`, ...cmd });
  return out;
}

export async function ok(userId: string, scenario: ScenarioId, cmd: Record<string, unknown> & { type: Command["type"] }, key?: string) {
  const out = await run(userId, scenario, cmd, key);
  if (!out.body.ok) throw new Error(`${cmd.type} failed: ${out.status} ${out.body.message} ${JSON.stringify(out.body.fieldErrors ?? {})}`);
  return out.body;
}

export async function state(scenario: ScenarioId): Promise<ScenarioState> {
  return getStore().load(scenario);
}

export async function caseById(scenario: ScenarioId, id: string) {
  return (await state(scenario)).cases.find((c) => c.id === id)!;
}

/** Upload-free evidence acceptance: insert a reviewed-ready file as the evidence route would. */
export async function attachEvidence(scenario: ScenarioId, caseId: string, facts: { field: "eventDate" | "coverageEndDate" | "personName"; label: string; value: string; conflictWith?: string }[] = []) {
  const store = getStore();
  const s = await store.load(scenario);
  const id = `ev_test_${++n}`;
  s.evidence.push({
    id,
    caseId,
    fileName: "fixture.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    sha256: "x",
    storagePath: "x",
    uploadedBy: "u_maya",
    uploadedAt: s.clock.businessNow,
    status: facts.length ? "needs_confirmation" : "accepted_for_review",
    readMode: "fixture_hash",
    documentType: "Synthetic fixture",
    proposedFacts: facts.map((f) => ({ field: f.field, label: f.label, value: f.value, page: 1, quote: f.value, confirmed: null, conflictWith: f.conflictWith ? { formValue: f.conflictWith } : undefined })),
    readNote: null,
  });
  s.rev += 1;
  await store.commit(s);
  return id;
}
