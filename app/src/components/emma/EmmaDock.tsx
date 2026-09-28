"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type FormEvent, type ReactNode, use, useEffect, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import type { EmmaApiResult, SourceRef } from "@/lib/contracts/ai";
import type { Role } from "@/lib/contracts/domain";

// Emma: a docked right panel beside the working page (never over required controls).
// Grounded answers with sources; it proposes, it never approves or changes records.

const Ctx = createContext<{ open: boolean; toggle: () => void; ask: (q: string) => void; pendingQuestion: string | null; clearPending: () => void; enabled: boolean }>({
  open: false,
  toggle: () => {},
  ask: () => {},
  pendingQuestion: null,
  clearPending: () => {},
  enabled: false,
});

export function EmmaProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [pendingQuestion, setPending] = useState<string | null>(null);
  return (
    <Ctx value={{ open, enabled, toggle: () => setOpen((v) => !v), ask: (q) => { setPending(q); setOpen(true); }, pendingQuestion, clearPending: () => setPending(null) }}>
      {children}
    </Ctx>
  );
}
export const useEmma = () => use(Ctx);

/** Button any page can place: "Explain with Emma". Opens the dock with a question. */
export function AskEmmaButton({ question, children, className = "" }: { question: string; children: ReactNode; className?: string }) {
  const { ask, enabled } = useEmma();
  if (!enabled) return null;
  return (
    <button type="button" onClick={() => ask(question)} className={`inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-strong hover:underline underline-offset-4 ${className}`}>
      <Sparkles className="size-4" aria-hidden />
      {children}
    </button>
  );
}

const KIND_LABEL: Record<SourceRef["kind"], string> = {
  federal_guidance: "Federal guidance",
  nexa_policy: "Nexa policy (synthetic)",
  carrier_demo_config: "Carrier demo configuration",
  estimate: "Estimate",
  case_record: "Your case record",
};

interface Turn {
  q: string;
  result: EmmaApiResult | null;
  error?: string;
}

function suggestions(role: Role, path: string): string[] {
  if (role === "hr_admin") return path.includes("/admin/qle/") ? ["Summarize this case and what needs review", "Why is this check not passed?", "What should I ask the employee for?"] : ["Which cases need action first?", "What does the evidence correction target mean?"];
  if (path.includes("/options")) return ["Compare the two medical plans for my choices", "Why is dental not changing?"];
  if (path.includes("/life-events/new")) return ["Which life event should I choose?", "Does pregnancy count as a life event?"];
  if (path.includes("/cases/")) return ["What happens next with my request?", "When will my pay change?"];
  return ["When can I change my benefits?", "How much does adding a child cost?", "What is Nexa's request window?"];
}

export function EmmaDock({ role }: { role: Role }) {
  const { open, toggle, pendingQuestion, clearPending } = useEmma();
  const pathname = usePathname();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const caseId = pathname.match(/\/(?:cases|qle|life-events)\/(case_[^/]+)/)?.[1];

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setTurns((t) => [...t, { q: question, result: null }]);
    setQ("");
    try {
      const res = await fetch("/api/emma", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, caseId, page: pathname }) });
      const body = (await res.json()) as EmmaApiResult;
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, result: body, error: body.ok ? undefined : body.message } : x)));
    } catch {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: "Emma is unavailable right now. Your request and forms still work. Try again, or ask HR." } : x)));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!pendingQuestion) return;
    const qq = pendingQuestion;
    clearPending();
    void ask(qq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  if (!open) return null;
  return (
    <aside aria-label="Emma, benefits assistant" className="flex w-[360px] shrink-0 flex-col border-l border-divider bg-surface max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:w-full">
      <div className="flex items-center justify-between border-b border-divider px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <p className="text-base font-medium">Emma</p>
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">AI · answers cite sources</span>
        </div>
        <button type="button" onClick={toggle} aria-label="Close Emma" className="grid size-8 place-items-center rounded-full hover:bg-fill">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {turns.length === 0 ? (
          <div className="text-sm text-ink-2">
            <p>I can explain Nexa&apos;s benefit rules, plans and your request using approved documents. I can&apos;t approve, change coverage or post payroll. HR decides.</p>
            <p className="mt-3 text-xs text-muted">Try asking</p>
            <div className="mt-2 flex flex-col gap-2">
              {suggestions(role, pathname).map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="rounded-[8px] border border-line px-3 py-2 text-left text-sm text-ink hover:bg-fill">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-full border border-line px-3 py-1.5 text-sm">{t.q}</p>
            {!t.result && !t.error ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Checking approved sources…
              </p>
            ) : null}
            {t.error ? <p className="rounded-[8px] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-ink">{t.error}</p> : null}
            {t.result?.response ? (
              <div className="rounded-[10px] border border-line">
                <div className="px-3 py-2.5 text-sm whitespace-pre-line text-ink">{t.result.response.answer}</div>
                {t.result.mode === "fallback" ? <p className="border-t border-divider bg-fill px-3 py-1.5 text-xs text-muted">{t.result.message ?? "AI unavailable. Showing matching policy text (deterministic fallback)."}</p> : null}
                {t.result.response.sourceRefs.length ? (
                  <div className="border-t border-divider px-3 py-2">
                    <p className="text-xs font-medium text-ink">Sources</p>
                    <ul className="mt-1 space-y-1">
                      {t.result.response.sourceRefs.map((s, j) => (
                        <li key={j} className="text-xs text-muted">
                          <span className="text-ink">{s.title}</span> · {s.section} · v{s.version} · {s.effectiveDate} · {KIND_LABEL[s.kind]}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {t.result.response.uncertainFields.length ? <p className="border-t border-divider px-3 py-2 text-xs text-warning-text">Not confirmed: {t.result.response.uncertainFields.join(", ")}</p> : null}
                {t.result.response.proposedActions.length ? (
                  <div className="flex flex-wrap gap-2 border-t border-divider px-3 py-2">
                    {t.result.response.proposedActions.map((a, j) =>
                      a.href ? (
                        <Link key={j} href={a.href} className="rounded-[8px] border border-line px-2.5 py-1 text-xs text-primary-strong hover:bg-fill">
                          {a.label}
                        </Link>
                      ) : (
                        <button key={j} type="button" onClick={() => ask(a.label)} className="rounded-[8px] border border-line px-2.5 py-1 text-xs text-primary-strong hover:bg-fill">
                          {a.label}
                        </button>
                      ),
                    )}
                  </div>
                ) : null}
                <p className="border-t border-divider px-3 py-1.5 text-[11px] text-muted">{t.result.mode === "model" ? `AI-generated with ${t.result.model}. Check the sources; HR makes decisions.` : "Deterministic retrieval — no model was used."}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-divider px-3 py-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor="emma-q" className="sr-only">
          Ask Emma
        </label>
        <input id="emma-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your benefits…" className="h-9 flex-1 rounded-full border border-line px-3 text-sm focus:outline-2 focus:outline-primary" maxLength={600} />
        <button type="submit" disabled={busy || q.trim().length < 2} aria-label="Send" className="grid size-9 place-items-center rounded-full bg-primary text-white disabled:opacity-50">
          <Send className="size-4" aria-hidden />
        </button>
      </form>
    </aside>
  );
}
