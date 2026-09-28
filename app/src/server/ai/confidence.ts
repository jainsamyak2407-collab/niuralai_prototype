import type { Extraction } from "@/lib/contracts/ai";
import type { EvidenceFile, ProposedFact, QleCase, ScenarioState } from "@/lib/contracts/domain";
import { fmtDateLong, isValidDate } from "@/lib/dates";
import { personName } from "@/server/domain/evaluate";

// Match confidence for the prototype. A deterministic rule, not the model's own number:
// start at 100 and subtract for each problem the reading surfaced against the form and
// Nexa's rules. 100 means every key fact matches, so the document is verified
// automatically and HR can approve without sending anything back to the employee.

export const CONFIDENCE_LABEL = "AI match confidence (prototype rule)";

export interface Confidence {
  score: number | null; // null = manual review, no automated score
  summary: string;
  issues: string[];
}

const LOSS = ["loss_of_other_coverage", "medicaid_chip_loss"];

export function scoreDocument(s: ScenarioState, c: QleCase, mode: "model" | "fixture_hash" | "manual", x: Extraction | null, facts: ProposedFact[]): Confidence {
  if (mode === "manual" || !x) return { score: null, summary: "AI reading was unavailable. HR reads this document.", issues: [] };
  if (!x.readable) return { score: 15, summary: "The file could not be read. A clearer copy of the exact document is needed.", issues: ["File unreadable"] };
  const issues: string[] = [];
  let score = 100;
  for (const f of facts.filter((p) => p.conflictWith)) {
    issues.push(`Document shows ${fmtDateLong(f.value, true)}; the form shows ${f.conflictWith!.formValue.split(", ").map((v) => (isValidDate(v) ? fmtDateLong(v, true) : v)).join(" and ")}.`);
    score -= 40;
  }
  const loss = LOSS.includes(c.eventCode);
  const hasKeyDate = loss ? !!x.coverageEndDate : !!x.eventDate || facts.some((p) => p.field === "otherFact");
  if (!hasKeyDate) {
    issues.push(loss ? "The date coverage ends is not shown." : "The event date is not shown.");
    score -= 30;
  }
  if (loss) {
    const named = (who: string) => facts.some((p) => p.field === "personName" && p.value.toLowerCase().includes(who.toLowerCase()));
    const missing = (c.facts.lostCoveragePersonIds ?? []).map((id) => personName(s, id)).filter((who) => !named(who));
    if (missing.length) {
      issues.push(`The notice does not name ${missing.join(" or ")}.`);
      score -= 45;
    }
  }
  if (x.uncertainFields.includes("embedded_instructions")) {
    issues.push("The document contains text that looks like instructions (treated as data only).");
    score -= 30;
  }
  score = Math.max(5, score);
  if (score === 100) {
    const people = facts.filter((p) => p.field === "personName").map((p) => p.value);
    const dateFact = facts.find((p) => p.field === "eventDate" || p.field === "coverageEndDate");
    const what = [people.length ? people.join(", ") : null, dateFact ? `${dateFact.label.toLowerCase()} ${fmtDateLong(dateFact.value, true)}` : null].filter(Boolean).join("; ");
    return { score, summary: `All key facts match the form and Nexa's rules${what ? `: ${what}` : ""}. Verified automatically.`, issues };
  }
  return { score, summary: `${issues.length} item${issues.length === 1 ? "" : "s"} need${issues.length === 1 ? "s" : ""} attention: ${issues.join(" ")}`, issues };
}

/**
 * Re-score after the employee resolves a conflict. Choosing the document's value makes the
 * form match the document, so that difference no longer counts against the match. Keeping
 * the form's value against the document keeps the difference, and HR reviews it.
 * Returns true when the document is now verified automatically (100%).
 */
export function rescoreAfterConfirm(f: EvidenceFile, at: string): boolean {
  if (typeof f.confidence !== "number") return false;
  f.confidenceAtRead ??= f.confidence;
  const conflicts = f.proposedFacts.filter((p) => p.conflictWith);
  const matchesDoc = (p: ProposedFact) => !!p.confirmed && (p.confirmed.choice === "document" || p.confirmed.value === p.value);
  const fixed = conflicts.filter(matchesDoc);
  const open = conflicts.filter((p) => !p.confirmed);
  const kept = conflicts.filter((p) => p.confirmed && !matchesDoc(p));
  const score = Math.min(100, f.confidenceAtRead + 40 * fixed.length);
  const show = (p: ProposedFact) => `${p.label.toLowerCase()} ${isValidDate(p.value) ? fmtDateLong(p.value, true) : p.value}`;
  if (score === 100 && !open.length && !kept.length) {
    f.confidence = 100;
    f.confidenceSummary = `Form corrected to match the document (${fixed.map(show).join("; ")}). All key facts now match the form and Nexa's rules. Verified automatically.`;
    f.status = "accepted_for_review";
    f.reviewedBy = "ai_auto";
    f.reviewedAt = at;
    for (const p of f.proposedFacts) if (!p.confirmed) p.confirmed = { choice: "document", value: p.value, by: "ai_auto", at };
    return true;
  }
  f.confidence = score;
  f.confidenceSummary = kept.length
    ? `The form keeps a different value than the document (document shows ${kept.map(show).join("; ")}). HR reviews this difference.`
    : open.length
      ? `${open.length} difference${open.length === 1 ? "" : "s"} still to resolve: ${open.map(show).join("; ")}.`
      : (f.confidenceSummary ?? "");
  return false;
}
