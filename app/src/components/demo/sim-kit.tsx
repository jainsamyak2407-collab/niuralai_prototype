"use client";

import { type ReactNode, useCallback, useId, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Command } from "@/lib/contracts/commands";
import { CommandError, type CommandInput, type CommandResponse, Field, Sheet, textareaClass, useCommand, useIntentKey } from "@/components/ui/client";

/** A command without its idempotency key, kept as a discriminated union (plain Omit collapses it). */
export type SimCommand = Command extends infer C ? (C extends Command ? Omit<C, "idempotencyKey"> : never) : never;
export const asInput = (cmd: SimCommand) => cmd as unknown as CommandInput;

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * One-click simulator actions. Tracks which control is pending, keeps the last failure
 * inline with a retry that reuses the same idempotency key, so a retry never repeats
 * the effect.
 */
export function useSimAction() {
  const { send, pending } = useCommand();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; cmd: SimCommand; key: string; result: CommandResponse } | null>(null);
  const [last, setLast] = useState<{ id: string; result: CommandResponse } | null>(null);

  const run = useCallback(
    async (id: string, cmd: SimCommand, key = newKey()) => {
      setBusyId(id);
      setFailure(null);
      const result = await send(asInput(cmd), { intentKey: key });
      setBusyId(null);
      if (!result.ok) setFailure({ id, cmd, key, result });
      else setLast({ id, result });
      return result;
    },
    [send],
  );
  const retry = useCallback(() => {
    if (failure) void run(failure.id, failure.cmd, failure.key);
  }, [failure, run]);

  return {
    run,
    retry,
    failure,
    last,
    dismiss: () => setFailure(null),
    isBusy: (id: string) => busyId === id,
    anyBusy: busyId !== null || pending,
  };
}

/** Inline failure for one area of the simulator, with a retry. */
export function ActionError({ action, scope }: { action: ReturnType<typeof useSimAction>; scope?: (id: string) => boolean }) {
  if (!action.failure) return null;
  if (scope && !scope(action.failure.id)) return null;
  return <CommandError result={action.failure.result} onRetry={action.retry} />;
}

/** Visible reason for a control that cannot be used yet. */
export function Why({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-xs text-muted">
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/**
 * Right-side sheet that asks for a reason or note, then runs one command. Keeps the
 * text after a failure; the idempotency key stays stable until the command succeeds.
 */
export function ReasonSheet({
  open,
  onClose,
  title,
  intro,
  label,
  hint,
  placeholder,
  confirmLabel,
  pendingLabel,
  tone = "primary",
  minLength = 3,
  maxLength = 300,
  optional = false,
  submit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro?: ReactNode;
  label: string;
  hint?: ReactNode;
  placeholder?: string;
  confirmLabel: string;
  pendingLabel: string;
  tone?: "primary" | "destructive";
  minLength?: number;
  maxLength?: number;
  optional?: boolean;
  submit: (text: string, key: string) => Promise<CommandResponse>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const intent = useIntentKey();
  const formId = useId();

  const close = useCallback(() => {
    setError(null);
    setResult(null);
    onClose();
  }, [onClose]);

  async function onSubmit() {
    const value = text.trim();
    if (!optional && value.length < minLength) {
      setError(`Write at least ${minLength} characters so the next person knows why.`);
      return;
    }
    if (value.length > maxLength) {
      setError(`Keep this under ${maxLength} characters.`);
      return;
    }
    setError(null);
    setBusy(true);
    const res = await submit(value, intent.key);
    setBusy(false);
    if (res.ok) {
      intent.reset();
      setText("");
      setResult(null);
      onClose();
    } else {
      setResult(res);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      width={460}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button variant={tone === "destructive" ? "destructive" : "primary"} form={formId} type="submit" pending={busy} pendingLabel={pendingLabel}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        {intro ? <div className="text-sm text-ink-2">{intro}</div> : null}
        <Field label={label} required={!optional} error={error} hint={hint}>
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={textareaClass(invalid)}
              value={text}
              maxLength={maxLength + 20}
              placeholder={placeholder}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>
        <CommandError result={result} onRetry={() => void onSubmit()} />
      </form>
    </Sheet>
  );
}
