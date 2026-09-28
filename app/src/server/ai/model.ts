import { createAnthropic } from "@ai-sdk/anthropic";

// One model provider, server-side only. The key is read only from
// APP_ANTHROPIC_API_KEY and passed explicitly; the model id comes from AI_MODEL.
// Callers always have a deterministic fallback, so a missing key never blocks a form.

export const AI_TIMEOUT_MS = 25_000;
export const AI_MAX_RETRIES = 1;

export function aiModel() {
  const apiKey = process.env.APP_ANTHROPIC_API_KEY;
  const id = process.env.AI_MODEL;
  if (!apiKey || !id) return null;
  const provider = createAnthropic({ apiKey });
  return { id, model: provider(id) };
}

/** Provider options that keep latency inside the request budget. */
export const FAST = { anthropic: { effort: "low" as const } };

/** A safe, non-sensitive category for a model failure. Never includes prompt or document text. */
export function failureKind(e: unknown): "timeout" | "not_configured" | "invalid_output" | "provider_error" {
  const name = (e as { name?: string })?.name ?? "";
  if (name === "AbortError" || name === "TimeoutError" || /timeout|aborted/i.test((e as Error)?.message ?? "")) return "timeout";
  if (/NoObjectGenerated|TypeValidation|JSONParse|NoOutput/i.test(name)) return "invalid_output";
  return "provider_error";
}

export const FAILURE_TEXT: Record<ReturnType<typeof failureKind>, string> = {
  timeout: "the AI service did not answer within 25 seconds",
  not_configured: "the AI service is not configured",
  invalid_output: "the AI answer did not match the required format",
  provider_error: "the AI service returned an error",
};

// Small per-instance call budget per user: bounded cost even if a client loops.
const calls = new Map<string, number[]>();
export function withinBudget(userId: string, limit = 30, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const list = (calls.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    calls.set(userId, list);
    return false;
  }
  list.push(now);
  calls.set(userId, list);
  return true;
}
