"use client";

import { createContext, type ReactNode, use, useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { Command } from "@/lib/contracts/commands";
import type { CommandResult } from "@/lib/contracts/domain";
import { Button } from "./button";

// ---------------- Toasts ----------------
type ToastItem = { id: number; tone: "success" | "error" | "info"; text: string; action?: { label: string; href: string } };
const ToastCtx = createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx value={{ push }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? XCircle : Info;
          return (
            <div key={t.id} className="animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-[8px] border border-line bg-surface px-3.5 py-3 text-sm shadow-[var(--shadow-flyout)]">
              <Icon className={`mt-0.5 size-4 shrink-0 ${t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-info"}`} aria-hidden />
              <p className="flex-1 text-ink">{t.text}</p>
              {t.action ? (
                <a href={t.action.href} className="text-primary hover:underline">
                  {t.action.label}
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </ToastCtx>
  );
}
export function useToast() {
  const ctx = use(ToastCtx);
  if (!ctx) throw new Error("useToast needs ToastProvider");
  return ctx.push;
}

// ---------------- Commands ----------------
// Distributive omit keeps each command's own fields (a plain Omit on a union drops them).
export type CommandInput = Command extends infer C ? (C extends Command ? Omit<C, "idempotencyKey"> & { idempotencyKey?: string } : never) : never;
export type CommandResponse = CommandResult & { latest?: unknown };

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Send one domain command. The idempotency key is stable for one user intent: pass the
 * same `intentKey` when retrying after a failure so the server never repeats the effect.
 * On success the page data refreshes; on failure the caller keeps the user's input.
 */
export function useCommand() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const send = useCallback(
    async (cmd: CommandInput, opts: { successToast?: boolean; intentKey?: string } = {}): Promise<CommandResponse> => {
      setBusy(true);
      try {
        const res = await fetch("/api/command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...cmd, idempotencyKey: cmd.idempotencyKey ?? opts.intentKey ?? newKey() }) });
        const body = (await res.json().catch(() => ({ ok: false, message: "We could not reach the server. Your answers are still here. Try again." }))) as CommandResponse;
        if (body.ok) {
          if (opts.successToast !== false) toast({ tone: "success", text: body.message });
          startTransition(() => router.refresh());
        }
        return body;
      } catch {
        return { ok: false, code: "network", message: "We could not save this change. Your answers are still here. Try again." };
      } finally {
        setBusy(false);
      }
    },
    [router, toast],
  );
  return { send, pending: busy || pending };
}

/** Stable idempotency key for one form intent; call reset() after success. */
export function useIntentKey() {
  const ref = useRef<string>(newKey());
  return { key: ref.current, reset: () => (ref.current = newKey()) };
}

// ---------------- Form fields ----------------
export function Field({ label, required, error, hint, children, id }: { label: string; required?: boolean; error?: string | null; hint?: ReactNode; children: (a: { id: string; describedBy?: string; invalid: boolean }) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const errId = `${fid}-error`;
  const hintId = `${fid}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fid} className="text-sm text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
      </label>
      {children({ id: fid, describedBy, invalid: !!error })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="text-xs text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = (invalid = false) =>
  `h-9 w-full rounded-[8px] border bg-surface px-3 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-primary ${invalid ? "border-danger" : "border-line"}`;
export const textareaClass = (invalid = false) =>
  `min-h-20 w-full rounded-[8px] border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-primary ${invalid ? "border-danger" : "border-line"}`;

// ---------------- Sheet (right drawer with scrim) and confirm modal ----------------
export function Sheet({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="animate-sheet-in absolute top-0 right-0 flex h-full max-w-full flex-col rounded-l-[12px] bg-surface shadow-[var(--shadow-modal)] outline-none" style={{ width }}>
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <h2 className="text-lg font-medium">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full hover:bg-fill" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-divider px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, children, confirmLabel, onConfirm, onCancel, pending, tone = "primary" }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; pending?: boolean; tone?: "primary" | "destructive" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-[12px] bg-surface shadow-[var(--shadow-modal)]">
        <div className="border-b border-divider px-5 py-4">
          <h2 className="text-lg font-medium">{title}</h2>
        </div>
        <div className="px-5 py-4 text-sm text-ink-2">{children}</div>
        <div className="flex justify-end gap-2 border-t border-divider px-5 py-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={tone === "destructive" ? "destructive" : "primary"} onClick={onConfirm} pending={pending} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Inline, retryable error for a failed command. Never replaces the page. */
export function CommandError({ result, onRetry }: { result: CommandResponse | null; onRetry?: () => void }) {
  if (!result || result.ok) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
      <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <div className="flex-1">
        <p className="text-ink">{result.message}</p>
        {result.nextAction ? <p className="mt-0.5 text-ink-2">{result.nextAction}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
