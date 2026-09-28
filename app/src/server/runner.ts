import { command as commandSchema, type Command } from "@/lib/contracts/commands";
import type { CommandResult, DemoUser, ScenarioId, ScenarioState } from "@/lib/contracts/domain";
import { type Ctx, DomainError } from "@/server/domain/ctx";
import { seedScenario } from "@/server/domain/seed";
import { execute } from "@/server/domain/workflow";
import { ConflictError, getStore } from "@/server/store/store";

// Runs one validated command: load latest revision → execute on a copy → commit the
// next revision. A concurrent writer produces a conflict and we retry on fresh state.
// Idempotency keys are stored inside the committed state, so a retried request returns
// the original result without repeating the business effect.

export interface RunOutcome {
  status: number;
  body: CommandResult & { latest?: unknown };
}

const FIELD_MESSAGES: Record<string, string> = {
  invalid_type: "This value is missing or has the wrong type.",
  too_small: "This is too short.",
  too_big: "This is too long.",
  invalid_string: "Enter a valid value.",
  invalid_format: "Enter a valid value.",
};

export async function runCommand(actor: DemoUser, scenarioId: ScenarioId, raw: unknown): Promise<RunOutcome> {
  const parsed = commandSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".") || "form";
      // Plain language only; never raw validator text for unknown codes.
      fieldErrors[k] ??= issue.message && !issue.message.startsWith("Invalid") && !issue.message.includes("expected") ? issue.message : (FIELD_MESSAGES[issue.code] ?? "Check this value.");
    }
    return { status: 400, body: { ok: false, code: "invalid_input", message: "Some answers need attention.", fieldErrors, nextAction: "Fix the highlighted fields and try again." } };
  }
  const cmd: Command = parsed.data;
  const store = getStore();
  for (let attempt = 0; attempt < 4; attempt++) {
    let state: ScenarioState;
    try {
      state = await store.load(scenarioId);
    } catch {
      return { status: 503, body: { ok: false, code: "store_unavailable", message: "We could not reach saved data. Your answers are still here. Try again.", nextAction: "Try again." } };
    }
    const prior = state.processed[cmd.idempotencyKey];
    if (prior) return { status: 200, body: { ...prior.result, message: prior.result.message } };
    const real = new Date().toISOString();
    let next: ScenarioState;
    let result: CommandResult;
    if (cmd.type === "ops.reset") {
      if (!["demo_operator"].includes(actor.role)) return { status: 403, body: { ok: false, code: "forbidden", message: "Only the demo operator can reset a scenario." } };
      if (cmd.confirmScenario !== scenarioId) return { status: 422, body: { ok: false, code: "confirm_mismatch", message: "Confirm the scenario you are resetting." } };
      next = seedScenario(scenarioId, real);
      next.audit[0].summary += ` Reset by ${actor.name}; previous revisions remain in storage history.`;
      result = { ok: true, message: `Scenario reset. Only the ${scenarioId} scenario's synthetic records changed.` };
    } else {
      const ctx: Ctx = { s: structuredClone(state), actor, real };
      try {
        result = execute(ctx, cmd);
      } catch (e) {
        if (e instanceof DomainError) {
          return { status: e.status, body: { ok: false, code: e.code, message: e.message, nextAction: e.nextAction, fieldErrors: e.fieldErrors, latest: e.latest } };
        }
        console.error("command failed", cmd.type, (e as Error).message);
        return { status: 500, body: { ok: false, code: "unexpected", message: "Something went wrong on our side. Nothing was saved. Try again.", nextAction: "Try again." } };
      }
      next = ctx.s;
    }
    next.rev = state.rev + 1;
    next.processed[cmd.idempotencyKey] = { at: next.clock.businessNow, result };
    const keys = Object.keys(next.processed);
    if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete next.processed[k];
    try {
      await store.commit(next);
      return { status: 200, body: result };
    } catch (e) {
      if (e instanceof ConflictError) continue;
      return { status: 503, body: { ok: false, code: "save_failed", message: "We could not save this change. Your answers are still here. Try again.", nextAction: "Try again." } };
    }
  }
  return { status: 409, body: { ok: false, code: "busy", message: "Several changes arrived at once. Try again.", nextAction: "Try again." } };
}

/** Commit a state change produced outside the command union (evidence upload, AI logs). */
export async function mutate<T>(scenarioId: ScenarioId, fn: (s: ScenarioState) => Promise<T> | T): Promise<T> {
  const store = getStore();
  for (let attempt = 0; attempt < 4; attempt++) {
    const state = await store.load(scenarioId);
    const next = structuredClone(state);
    const out = await fn(next);
    next.rev = state.rev + 1;
    try {
      await store.commit(next);
      return out;
    } catch (e) {
      if (e instanceof ConflictError) continue;
      throw e;
    }
  }
  throw new ConflictError("Too many concurrent changes.");
}
