import { CheckCircle2, AlertTriangle } from "lucide-react";

/** AI match confidence (prototype rule): 100% = verified automatically; lower = flagged. */
export function ConfidenceBlock({ score, summary }: { score: number | null | undefined; summary?: string | null }) {
  if (score === null || score === undefined) return null;
  const ok = score === 100;
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`flex items-start gap-2.5 rounded-[8px] border px-3 py-2 ${ok ? "border-success/30 bg-success-soft" : "border-warning/40 bg-warning-soft"}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${ok ? "text-success" : "text-warning"}`} aria-hidden />
      <div className="min-w-0 text-[13px]">
        <p className="text-ink">
          <span className="tabular font-medium">AI match {score}%</span>
          <span className="text-muted"> · prototype confidence rule</span>
        </p>
        {summary ? <p className="text-ink-2">{summary}</p> : null}
      </div>
    </div>
  );
}
