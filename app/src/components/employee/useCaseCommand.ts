"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Command } from "@/lib/contracts/commands";
import { type CommandInput, type CommandResponse, useCommand } from "@/components/ui/client";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Build = (expectedVersion: number) => CommandInput;

/**
 * Case-scoped command sender for the wizard.
 * - Tracks the case version locally so back-to-back saves never send a stale version.
 * - Serializes sends: an autosave and a click never race each other.
 * - Keeps one intent key until a send succeeds, so "Try again" never repeats an effect.
 */
export function useCaseCommand(caseVersion: number) {
  const { send } = useCommand();
  const router = useRouter();
  const version = useRef(caseVersion);
  const key = useRef(newKey());
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const [inflight, setInflight] = useState(0);
  const [last, setLast] = useState<CommandResponse | null>(null);

  useEffect(() => {
    if (caseVersion > version.current) version.current = caseVersion;
  }, [caseVersion]);

  const run = useCallback(
    (build: Build, opts: { successToast?: boolean } = {}): Promise<CommandResponse> => {
      setInflight((n) => n + 1);
      const p = chain.current.then(async () => {
        const res = await send({ ...build(version.current), idempotencyKey: key.current } as CommandInput, { successToast: opts.successToast ?? false });
        if (res.ok) {
          if (typeof res.version === "number") version.current = res.version;
          key.current = newKey();
        } else if (res.code === "version_conflict") {
          const latest = res.latest as { version?: number } | undefined;
          if (typeof latest?.version === "number") version.current = latest.version;
          router.refresh();
        }
        setLast(res);
        return res;
      });
      chain.current = p.catch(() => undefined).finally(() => setInflight((n) => n - 1));
      return p;
    },
    [send, router],
  );

  return { run, pending: inflight > 0, last, clearLast: () => setLast(null) };
}

/** Plain-language save failure copy (GPT.md §9). */
export const SAVE_FAILED = "We could not save this change. Your answers are still here. Try again.";

export function saveError(res: CommandResponse | null): CommandResponse | null {
  if (!res || res.ok) return null;
  if (res.code === "invalid_input" || res.code === "version_conflict" || res.code === "not_editable") return res;
  return { ...res, message: SAVE_FAILED, nextAction: undefined };
}

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** One command variant without its idempotency key (distributive, unlike `CommandInput`). */
export type CommandBody = DistOmit<Command, "idempotencyKey">;

/**
 * Type-checked command builder. `CommandInput` (Omit over the command union) collapses to
 * the shared keys only, so a literal with command fields fails excess-property checks.
 * This checks the literal against the exact command variant instead.
 */
export function cmd(c: CommandBody): CommandInput {
  return c as unknown as CommandInput;
}
