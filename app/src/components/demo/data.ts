import type { ScenarioId } from "@/lib/contracts/domain";
import { OWNERS, userById } from "@/server/config/identities";
import { CARRIERS, PLANS } from "@/server/config/plans";
import { loadState } from "@/server/views";

// Read-only helpers for the simulator pages. They add labels only (names, plan names,
// case numbers); they never widen what a role can see.

export function planOptions() {
  return PLANS.map((p) => ({ id: p.id, benefit: p.benefit as string, shortName: p.shortName }));
}

export function carrierNames() {
  return Object.fromEntries(CARRIERS.map((c) => [c.id, { name: c.name, groupNumber: c.groupNumber }]));
}

export function personNames(ids: string[]) {
  return Object.fromEntries([...new Set(ids)].map((id) => [id, OWNERS[id]?.name ?? userById(id)?.name ?? id]));
}

/** Case numbers for linking outbox rows. Demo operator only; case numbers carry no personal data. */
export async function caseNumbers(scenario: ScenarioId) {
  const s = await loadState(scenario);
  return Object.fromEntries(s.cases.map((c) => [c.id, c.caseNumber]));
}
