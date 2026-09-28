"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, FileText } from "lucide-react";
import type { ProposedFact } from "@/lib/contracts/domain";
import type { EmployeeCaseView } from "@/server/views";
import { Button } from "@/components/ui/button";
import { CommandError, type CommandResponse, inputClass } from "@/components/ui/client";
import { DateText, StatusPill } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/dates";
import { EVIDENCE_STATUS, fmtBytes, READ_MODE } from "./labels";
import { cmd, useCaseCommand } from "./useCaseCommand";

type EvidenceItem = EmployeeCaseView["evidence"][number];

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const show = (v: string) => (isDate(v) ? fmtDate(v) : v);
const CHOICE: Record<"document" | "form" | "custom", string> = { document: "document value", form: "form value", custom: "value you entered" };

/** Uploaded files with their own status, read mode and proposed facts to confirm. */
export function EvidenceList({ caseId, version, files, emptyText }: { caseId: string; version: number; files: EvidenceItem[]; emptyText?: string }) {
  const { run, pending } = useCaseCommand(version);
  const [error, setError] = useState<CommandResponse | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  async function confirm(fileId: string, factIndex: number, choice: "document" | "form" | "custom", value?: string) {
    const go = async () => {
      const res = await run((v) => cmd({ type: "case.confirmFact", caseId, expectedVersion: v, fileId, factIndex, choice, value }), { successToast: true });
      setError(res.ok ? null : res);
      return res.ok;
    };
    setRetry(() => () => void go());
    return go();
  }

  if (!files.length) return <p className="text-sm text-muted">{emptyText ?? "No documents uploaded yet."}</p>;
  return (
    <div className="space-y-3">
      {error ? <CommandError result={error} onRetry={retry ?? undefined} /> : null}
      {files.map((f) => {
        const st = EVIDENCE_STATUS[f.status];
        return (
          <article key={f.id} className="rounded-[10px] border border-line">
            <header className="flex flex-wrap items-start gap-3 border-b border-divider px-4 py-3">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{f.fileName}</p>
                <p className="text-[13px] text-muted">
                  {f.documentType ?? "Document"} · {fmtBytes(f.sizeBytes)} · uploaded <DateText time={f.uploadedAt} />
                </p>
              </div>
              <StatusPill tone={st.tone}>{st.label}</StatusPill>
              <a href={`/api/evidence/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                View <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </header>
            <div className="space-y-3 px-4 py-3 text-sm">
              {f.readMode ? <p className="text-[13px] text-ink-2">{READ_MODE[f.readMode]}</p> : null}
              {f.readNote ? <p className="text-[13px] text-muted">{f.readNote}</p> : null}
              {f.status === "unreadable" ? <p className="text-[13px] text-ink-2">We could not read this file. Upload a clearer copy, or continue and HR will tell you exactly what is needed.</p> : null}
              {f.status === "rejected" ? <p className="text-[13px] text-danger-text">{f.rejectionReason ?? "This file was not accepted."}</p> : null}
              {f.reviewed ? <p className="text-[13px] text-success-text">HR reviewed this document. Reviewing a document does not certify it.</p> : null}
              {f.proposedFacts.length ? (
                <ul className="divide-y divide-divider rounded-[8px] border border-line">
                  {f.proposedFacts.map((p, i) => (
                    <FactRow key={i} fact={p} busy={pending} onConfirm={(choice, value) => confirm(f.id, i, choice, value)} />
                  ))}
                </ul>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FactRow({ fact, busy, onConfirm }: { fact: ProposedFact; busy: boolean; onConfirm: (choice: "document" | "form" | "custom", value?: string) => Promise<boolean> }) {
  const [custom, setCustom] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const date = isDate(fact.value);
  const id = `fact-${fact.field}-${fact.label.replace(/\W+/g, "-")}`;
  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{fact.label}</p>
          <p className="text-sm text-ink tabular">{show(fact.value)}</p>
          {fact.page || fact.quote ? (
            <p className="mt-0.5 text-xs text-muted">
              Source: {fact.page ? `page ${fact.page}` : "document"}
              {fact.quote ? <> · “{fact.quote}”</> : null}
            </p>
          ) : null}
        </div>
        {fact.confirmed ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-success-text">
            <CheckCircle2 className="size-4" aria-hidden /> Confirmed {show(fact.confirmed.value)} ({CHOICE[fact.confirmed.choice]})
          </span>
        ) : null}
      </div>
      {!fact.confirmed && fact.conflictWith ? (
        <div className="mt-2 rounded-[8px] bg-warning-soft px-3 py-2 text-[13px] text-ink">
          The document shows {show(fact.value)}; your form shows {show(fact.conflictWith.formValue)}. Please confirm which is correct.
        </div>
      ) : null}
      {!fact.confirmed ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {fact.conflictWith ? (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => onConfirm("document")}>
                Use document value ({show(fact.value)})
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => onConfirm("form")}>
                Use form value ({show(fact.conflictWith.formValue)})
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onConfirm("document")}>
              Confirm
            </Button>
          )}
          {custom === null ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setCustom("")}>
              Enter another value
            </Button>
          ) : (
            <form
              className="flex flex-wrap items-start gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!custom.trim()) return setErr(date ? "Enter a valid date." : "Enter the correct value.");
                setErr(null);
                if (await onConfirm("custom", custom.trim())) setCustom(null);
              }}
            >
              <label htmlFor={id} className="sr-only">
                Correct value for {fact.label}
              </label>
              <div>
                <input id={id} type={date ? "date" : "text"} value={custom} maxLength={200} onChange={(e) => setCustom(e.target.value)} aria-invalid={!!err} aria-describedby={err ? `${id}-error` : undefined} className={`${inputClass(!!err)} h-8 w-48`} />
                {err ? (
                  <p id={`${id}-error`} className="mt-1 text-xs text-danger-text">
                    {err}
                  </p>
                ) : null}
              </div>
              <Button type="submit" size="sm" pending={busy}>
                Save value
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => (setCustom(null), setErr(null))}>
                Cancel
              </Button>
            </form>
          )}
        </div>
      ) : null}
    </li>
  );
}
