import type { HrCaseView } from "@/server/views";
import { fmtDate } from "@/lib/dates";

// Server-side helpers for the HR case page. Pure functions over the HR view.

export function nameLookup(v: HrCaseView): (id: string) => string {
  const m = new Map<string, string>();
  for (const p of v.household) m.set(p.id, p.name);
  for (const ch of v.case.facts.children ?? [])
    m.set(ch.personId, `${ch.firstName} ${ch.lastName}`.trim() || "New child");
  for (const l of v.lines) m.set(l.personId, l.person);
  return (id) => m.get(id) ?? "Household member";
}

export function lineDate(l: {
  action: string;
  startDate: string | null;
  endDate: string | null;
}): string {
  return l.action === "terminate"
    ? `Ends ${fmtDate(l.endDate)}`
    : `From ${fmtDate(l.startDate)}`;
}

/** Open blocking checks, as the server computes them for approval. */
export function blockingChecks(v: HrCaseView) {
  return (v.evaluation?.checks ?? []).filter(
    (k) =>
      k.blocking &&
      !(k.result === "passed" || k.result === "not_applicable" || k.resolvedBy),
  );
}

export function canDecide(status: string) {
  return ["submitted", "under_review", "needs_information"].includes(status);
}

export function firstName(full: string) {
  return full.split(" ")[0] ?? full;
}

/** Whether a line is eligible for a correction or broker assignment (mirrors the server rule). */
export function lineFailed(v: HrCaseView, l: HrCaseView["lines"][number]) {
  const txn = v.txns.find((t) => t.id === l.currentTxnId);
  return (
    l.coverageState === "mismatch" ||
    txn?.memberResult === "rejected" ||
    txn?.delivery === "file_rejected" ||
    (txn?.delivery === "receipt_unknown" &&
      txn.batch?.transport === "not_received")
  );
}
