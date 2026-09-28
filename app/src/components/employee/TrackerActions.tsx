"use client";

import { type ReactNode, useEffect, useState } from "react";
import { CheckCircle2, LifeBuoy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandError, type CommandResponse, ConfirmModal, Field, textareaClass } from "@/components/ui/client";
import { RECEIVED_KEY } from "./ReviewSubmit";
import { cmd, useCaseCommand } from "./useCaseCommand";

/** Event-specific confirmation carried over from the submit result. */
export function ReceivedBanner({ caseId }: { caseId: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    try {
      setText(sessionStorage.getItem(RECEIVED_KEY(caseId)));
    } catch {
      setText(null);
    }
  }, [caseId]);
  if (!text) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-[10px] border border-success/30 bg-success-soft px-4 py-3 text-sm">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      <p className="flex-1 text-ink">{text}</p>
      <button
        type="button"
        aria-label="Dismiss"
        className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface"
        onClick={() => {
          try {
            sessionStorage.removeItem(RECEIVED_KEY(caseId));
          } catch {
            // ignore
          }
          setText(null);
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** Reply to one HR information request. The original request and answers are kept. */
export function InfoReply({ caseId, version, taskId, uploader }: { caseId: string; version: number; taskId: string; uploader: ReactNode }) {
  const { run, pending } = useCaseCommand(version);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const fid = `reply-${taskId}`;
  async function send() {
    if (!message.trim()) {
      setError("Add a short reply.");
      document.getElementById(fid)?.focus();
      return;
    }
    setError(null);
    const res = await run((v) => cmd({ type: "case.respond", caseId, expectedVersion: v, taskId, message: message.trim() }), { successToast: true });
    if (!res.ok) return setResult(res);
    setResult(null);
    setMessage("");
  }
  return (
    <div className="space-y-3">
      <Field label="Your reply" required error={error} id={fid} hint="Your reply and any file you add go to HR with this request.">
        {(a) => <textarea id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={textareaClass(a.invalid)} rows={3} maxLength={2000} value={message} onChange={(e) => (setMessage(e.target.value), setError(null))} />}
      </Field>
      {uploader}
      {result ? <CommandError result={result} onRetry={send} /> : null}
      <div className="flex justify-end">
        <Button onClick={send} pending={pending} pendingLabel="Sending…">
          Send reply to HR
        </Button>
      </div>
    </div>
  );
}

/** "Need care before this is confirmed?" — creates an urgent HR task (4-hour target). */
export function UrgentSupport({ caseId }: { caseId: string }) {
  const { run, pending } = useCaseCommand(0);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [sent, setSent] = useState(false);
  async function send() {
    if (message.trim().length < 3) {
      setError("Tell HR briefly what care you need and when.");
      document.getElementById("urgent-message")?.focus();
      return;
    }
    setError(null);
    const res = await run(() => cmd({ type: "case.urgentSupport", caseId, message: message.trim() }), { successToast: true });
    if (!res.ok) return setResult(res);
    setResult(null);
    setSent(true);
    setOpen(false);
    setMessage("");
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-primary">
          <LifeBuoy className="size-4" aria-hidden />
        </span>
        <p className="text-ink-2">If someone needs care before coverage is confirmed, HR can contact you today with your receipt and known dates. HR cannot promise how a claim will be paid.</p>
      </div>
      {sent ? <p className="text-success-text">Sent. HR has been asked to contact you today.</p> : null}
      {open ? (
        <>
          <Field label="What care is needed, and when?" required error={error} id="urgent-message" hint="Do not include diagnoses. A date and the kind of visit is enough.">
            {(a) => <textarea id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={textareaClass(a.invalid)} rows={3} maxLength={1000} value={message} onChange={(e) => (setMessage(e.target.value), setError(null))} />}
          </Field>
          {result ? <CommandError result={result} onRetry={send} /> : null}
          <div className="flex gap-2">
            <Button onClick={send} pending={pending} pendingLabel="Sending…">
              Ask HR for help today
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Request urgent help
        </Button>
      )}
    </div>
  );
}

/** Withdraw with a confirmation that restates the consequence. */
export function WithdrawAction({ caseId, version, caseNumber, sent }: { caseId: string; version: number; caseNumber: string; sent: boolean }) {
  const { run, pending } = useCaseCommand(version);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommandResponse | null>(null);
  async function confirm() {
    if (reason.trim().length < 3) {
      setError("Tell HR briefly why you are withdrawing.");
      return;
    }
    const res = await run((v) => cmd({ type: "case.withdraw", caseId, expectedVersion: v, reason: reason.trim() }), { successToast: true });
    if (!res.ok) return setResult(res);
    setOpen(false);
  }
  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Withdraw request
      </Button>
      <ConfirmModal open={open} title={`Withdraw ${caseNumber}?`} confirmLabel="Withdraw request" tone="destructive" pending={pending} onConfirm={confirm} onCancel={() => setOpen(false)}>
        <p>HR stops working on this request. Your current coverage stays as it is.</p>
        {sent ? <p className="mt-2">This change was already sent to the insurance provider, so HR will send a correction. Nothing already sent is deleted.</p> : null}
        <div className="mt-3">
          <Field label="Reason" required error={error} id="withdraw-reason">
            {(a) => <textarea id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={textareaClass(a.invalid)} rows={2} maxLength={500} value={reason} onChange={(e) => (setReason(e.target.value), setError(null))} />}
          </Field>
        </div>
        {result ? (
          <div className="mt-3">
            <CommandError result={result} onRetry={confirm} />
          </div>
        ) : null}
      </ConfirmModal>
    </>
  );
}
