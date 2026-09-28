import type { ScenarioId } from "@/lib/contracts/domain";
import { loadState } from "@/server/views";

/** Business clock for the broker pages (read-only; the broker views do not return it). */
export async function businessNow(scenario: ScenarioId): Promise<string> {
  return (await loadState(scenario)).clock.businessNow;
}
