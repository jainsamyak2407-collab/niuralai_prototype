import { AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import type { HrCaseView } from "@/server/views";
import { Section, StatusPill } from "@/components/ui/primitives";

/** AI case review: one match score, what was verified (with its source) and what HR should check. */
export function AiReviewSection({ v }: { v: HrCaseView }) {
  const r = v.aiReview;
  const full = r.score === 100 && r.toCheck.length === 0;
  return (
    <Section
      id="ai-review"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden />
          AI review
        </span>
      }
      description="Built from the AI document reading and the rules engine. The score is a prototype rule, not a number from the model. You decide."
      actions={
        <StatusPill tone={r.score === null ? "gray" : full ? "green" : "amber"}>
          {r.score === null ? "No score" : `AI match ${r.score}%`}
        </StatusPill>
      }
      bodyClassName=""
    >
      <p className={`border-b border-divider px-5 py-3 text-sm ${full ? "text-success-text" : "text-ink"}`}>{r.headline}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-divider">
        <div className="px-5 py-4">
          <h3 className="mb-2 text-[13px] font-medium text-ink">Verified ({r.verified.length})</h3>
          {r.verified.length ? (
            <ul className="flex flex-col gap-2.5">
              {r.verified.map((x, i) => (
                <li key={i} className="flex gap-2.5 text-[13px]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <span className="min-w-0">
                    <span className="text-ink">{x.label}:</span> <span className="text-ink-2">{x.value}</span>
                    <span className="block text-xs text-muted">{x.source}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Nothing verified yet.</p>
          )}
        </div>
        <div className="border-t border-divider px-5 py-4 lg:border-t-0">
          <h3 className="mb-2 text-[13px] font-medium text-ink">For you to check ({r.toCheck.length})</h3>
          {r.toCheck.length ? (
            <ul className="flex flex-col gap-2.5">
              {r.toCheck.map((x, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] text-ink-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-2">Nothing open. Confirm the change summary below, then approve.</p>
          )}
          <p className="mt-3 text-xs text-muted">The AI does not certify that a document is authentic. Open it if anything looks unusual.</p>
        </div>
      </div>
    </Section>
  );
}
