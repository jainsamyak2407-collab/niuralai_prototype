import { Lock } from "lucide-react";
import type { HrCaseView } from "@/server/views";
import { ownerName } from "@/server/config/identities";
import {
  DateText,
  EmptyState,
  Section,
  StatusPill,
  Tag,
} from "@/components/ui/primitives";
import { InternalNoteForm } from "../ExecutionActions";
import { humanize } from "../labels";

const AI_KIND: Record<string, string> = {
  rule_check: "Rule check",
  reconciliation_check: "Reconciliation check",
  document_read: "Document read",
  facts_proposed: "Facts proposed",
  facts_confirmed: "Facts confirmed",
  summary_prepared: "Summary prepared",
  emma_answer: "Emma answer",
  model_unavailable: "Model unavailable",
};

/** Case history: audit events in business time, internal ones marked; AI activity beside it. */
export function TimelineSection({ v }: { v: HrCaseView }) {
  const events = v.timeline.slice().reverse();
  return (
    <Section
      id="timeline"
      title="Timeline"
      description="Business time, newest first. Internal events never reach the employee."
      bodyClassName="grid lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="min-w-0 border-divider lg:border-r">
        {events.length === 0 ? (
          <EmptyState title="No history yet" />
        ) : (
          <ol className="divide-y divide-divider">
            {events.map((a) => (
              <li
                key={a.id}
                className="grid gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[176px_minmax(0,1fr)]"
              >
                <div className="text-[13px]">
                  <DateText time={a.at} className="text-ink" />
                  <p className="text-muted">{ownerName(a.actor)}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.visibility === "internal" ? (
                      <Tag className="gap-1">
                        <Lock className="size-3" aria-hidden />
                        Internal
                      </Tag>
                    ) : (
                      <StatusPill tone="blue">Employee sees</StatusPill>
                    )}
                    <span className="text-xs text-muted">
                      {humanize(a.type)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink">{a.summary}</p>
                  {a.visibility === "employee" &&
                  a.employeeSummary &&
                  a.employeeSummary !== a.summary ? (
                    <p className="mt-0.5 text-[13px] text-muted">
                      Employee sees: “{a.employeeSummary}”
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <aside className="flex min-w-0 flex-col gap-5 border-t border-divider px-5 py-4 lg:border-t-0">
        <InternalNoteForm caseId={v.case.id} />
        <div>
          <h3 className="text-sm font-medium text-ink">AI activity</h3>
          <p className="mt-0.5 text-xs text-muted">
            What was deterministic and what a model proposed. No confidence
            scores are shown; models do not produce calibrated ones.
          </p>
          {v.ai.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">
              No AI or rule-engine activity recorded for this case yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {v.ai
                .slice()
                .reverse()
                .map((a) => (
                  <li key={a.id} className="text-[13px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tag>
                        {a.model ? a.model : (AI_KIND[a.kind] ?? "Rule check")}
                      </Tag>
                      <span className="text-muted">
                        <DateText time={a.at} />
                      </span>
                    </div>
                    <p className="mt-1 text-ink">{a.label}</p>
                    <p className="text-muted">{a.detail}</p>
                    {a.model ? (
                      <p className="text-xs text-muted">
                        {AI_KIND[a.kind] ?? humanize(a.kind)} · proposed only, a
                        person confirms
                      </p>
                    ) : null}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </aside>
    </Section>
  );
}
