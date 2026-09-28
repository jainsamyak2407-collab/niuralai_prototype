"use client";

import { useCallback, useRef, useState } from "react";
import type { Command } from "@/lib/contracts/commands";
import {
  type CommandInput,
  type CommandResponse,
  useCommand,
} from "@/components/ui/client";

// Distributive Omit so each command keeps its own fields (plain Omit collapses the union).
export type HrCommand = Command extends infer C
  ? C extends Command
    ? Omit<C, "idempotencyKey">
    : never
  : never;

/**
 * One form intent → one idempotency key. A retry after a failure reuses the key so the
 * server never repeats the effect; success resets it. The last failed result stays in
 * state for an inline `CommandError`, and field errors map to inputs.
 */
export function useHrCommand() {
  const { send, pending } = useCommand();
  // Read the key at send time (a ref), so a reset is never missed by a stale closure.
  const key = useRef<string | null>(null);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const run = useCallback(
    async (cmd: HrCommand) => {
      key.current ??= crypto.randomUUID();
      const r = await send(cmd as CommandInput, { intentKey: key.current });
      if (r.ok) {
        key.current = null;
        setResult(null);
      } else {
        // A validation failure was not processed, so a fresh key is safe after edits.
        if (r.code === "invalid_input") key.current = null;
        setResult(r);
      }
      return r;
    },
    [send],
  );
  const fieldError = (name: string) => result?.fieldErrors?.[name] ?? null;
  return { run, pending, result, clear: () => setResult(null), fieldError };
}
