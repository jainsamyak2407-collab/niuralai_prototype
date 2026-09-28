import type { ScenarioId } from "@/lib/contracts/domain";
import { seedScenario } from "@/server/domain/seed";
import { ConflictError, getStore } from "@/server/store/store";

// Demo reset: reseeds one scenario as the next revision. Earlier revisions stay in
// storage history. Only synthetic records change; other scenarios are untouched.
export async function resetScenario(id: ScenarioId, opts: { autopilot: boolean; by: string }) {
  const store = getStore();
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await store.load(id);
    const next = seedScenario(id, new Date().toISOString());
    next.autopilot = opts.autopilot;
    next.rev = current.rev + 1;
    next.audit[0].summary += ` Reset by ${opts.by}; autopilot ${opts.autopilot ? "on" : "off"}. Previous revisions remain in storage history.`;
    try {
      await store.commit(next);
      return;
    } catch (e) {
      if (e instanceof ConflictError) continue;
      throw e;
    }
  }
  throw new ConflictError("Several changes arrived at once.");
}
