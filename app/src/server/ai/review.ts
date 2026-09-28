import type { Evaluation, QleCase, ScenarioState } from "@/lib/contracts/domain";
import { fmtDateLong, isValidDate } from "@/lib/dates";
import { caseAiMatch } from "@/server/domain/autopilot";

// AI case review for HR: one score plus a grounded summary. Every line comes from a stored
// record (the document reading with its page and quote, or a rules-engine check with its
// rule id), so HR can see why the score is what it is and what is left to check.
// HR still decides; nothing here approves a case.

export interface AiReview {
  score: number | null;
  headline: string;
  verified: { label: string; value: string; source: string }[];
  toCheck: string[];
}

const show = (v: string) => (isValidDate(v) ? fmtDateLong(v, true) : v);

export function aiReview(s: ScenarioState, c: QleCase, ev: Evaluation | null): AiReview {
  const score = caseAiMatch(s, c);
  const verified: AiReview["verified"] = [];
  const toCheck: string[] = [];

  if (c.background) {
    const task = s.tasks.find((t) => t.caseId === c.id);
    if (score === 100) verified.push({ label: "Document reading", value: task?.reason ?? "All key facts match.", source: "Sample case (seeded)" });
    else if (task) toCheck.push(task.reason);
    return { score, headline: headline(score, toCheck.length), verified, toCheck };
  }

  const files = s.evidence.filter((e) => e.caseId === c.id && e.status !== "rejected");
  for (const f of files) {
    for (const p of f.proposedFacts) {
      if (p.field === "documentType") continue;
      const where = `${f.documentType ?? f.fileName}${p.page ? `, page ${p.page}` : ""}${p.quote ? `: “${p.quote}”` : ""}`;
      if (!p.conflictWith) verified.push({ label: p.label, value: show(p.confirmed?.value ?? p.value), source: `${where} · matches the form` });
      else if (p.confirmed && (p.confirmed.choice === "document" || p.confirmed.value === p.value)) verified.push({ label: p.label, value: show(p.value), source: `${where} · form corrected from ${show(p.conflictWith.formValue)}` });
      else if (p.confirmed) toCheck.push(`${p.label}: the employee kept ${show(p.confirmed.value)}, but the document shows ${show(p.value)}.`);
      else toCheck.push(`${p.label}: the document shows ${show(p.value)}; the form shows ${show(p.conflictWith.formValue)}.`);
    }
    if (f.confidence !== 100) toCheck.push(`${f.fileName}: ${f.confidence == null ? "AI reading was unavailable. Read the document yourself." : (f.confidenceSummary ?? `AI match ${f.confidence}%.`)}`);
  }
  if (!files.length) toCheck.push("No document uploaded yet.");

  for (const k of ev?.checks ?? []) {
    const outcome = k.resolvedBy?.outcome ?? k.result;
    if (outcome === "passed") verified.push({ label: k.label, value: k.reason, source: `Rule ${k.ruleId} v${k.ruleVersion}` });
    else if (outcome === "needs_review" || outcome === "needs_information") toCheck.push(`${k.label}: ${k.reason}`);
  }
  if (ev && !ev.proposedLines.length) toCheck.push("The rules have not produced a coverage change yet.");

  return { score, headline: headline(score, toCheck.length), verified, toCheck };
}

function headline(score: number | null, open: number) {
  if (score === null) return "No AI score yet. Review the documents and checks yourself.";
  if (score === 100 && !open) return "AI match 100%. Every key fact matches the documents and Nexa's rules. Ready for your approval.";
  if (score === 100) return `AI match 100% on the documents. ${open} item${open === 1 ? "" : "s"} still need${open === 1 ? "s" : ""} your review.`;
  return `AI match ${score}%. ${open} item${open === 1 ? "" : "s"} need${open === 1 ? "s" : ""} your review before approval.`;
}
