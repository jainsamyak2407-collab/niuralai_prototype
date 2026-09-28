import { addDays, fmtDateTime, localDate, zonedToUtc } from "@/lib/dates";
import { ownerName } from "@/server/config/identities";
import { BATCH_SEND } from "@/server/config/payroll";
import { addBusinessDays, addTask, audit, type Ctx, HR_ID, notify } from "./ctx";
import { postRun, refreshCompletion, runBatch } from "./execution";

// The server-owned demo clock. Advancing it runs due jobs through the normal workflow
// functions. It cannot complete a case directly. Business time is stored separately
// from real audit ingestion time.

type Advance = "plus_hour" | "next_batch" | "plus_day" | "next_payday";

export function advanceClock(ctx: Ctx, advance: Advance): string {
  const s = ctx.s;
  const from = s.clock.businessNow;
  let to: string;
  if (advance === "plus_hour") to = new Date(new Date(from).getTime() + 3600_000).toISOString();
  else if (advance === "plus_day") to = new Date(new Date(from).getTime() + 24 * 3600_000).toISOString();
  else if (advance === "next_batch") {
    const d = localDate(from);
    const t = zonedToUtc(d, BATCH_SEND);
    to = t > from ? t : zonedToUtc(addDays(d, 1), BATCH_SEND);
  } else {
    const run = s.payRuns.filter((r) => r.status === "scheduled").sort((a, b) => a.payday.localeCompare(b.payday))[0];
    if (!run) return "No scheduled pay run left in the demo calendar.";
    to = zonedToUtc(run.payday, "09:00");
    if (to <= from) to = new Date(new Date(from).getTime() + 3600_000).toISOString();
  }
  const done = runDueJobs(ctx, from, to);
  s.clock.businessNow = to;
  audit(ctx, { caseId: null, type: "demo.clock", summary: `Demo clock advanced to ${fmtDateTime(to)}. Due jobs: ${done.length ? done.join("; ") : "none"}.` });
  return `Clock is now ${fmtDateTime(to)}. ${done.length ? done.join(" ") : "No jobs were due."}`;
}

export function runDueJobs(ctx: Ctx, from: string, to: string): string[] {
  const s = ctx.s;
  const events: { at: string; kind: "batch" | "payroll"; runId?: string }[] = [];
  for (let d = localDate(from); d <= localDate(to); d = addDays(d, 1)) {
    const t = zonedToUtc(d, BATCH_SEND);
    if (t > from && t <= to) events.push({ at: t, kind: "batch" });
  }
  for (const r of s.payRuns) {
    const t = zonedToUtc(r.payday, "09:00");
    if (r.status === "scheduled" && t > from && t <= to) events.push({ at: t, kind: "payroll", runId: r.id });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  const done: string[] = [];
  for (const e of events) {
    s.clock.businessNow = e.at;
    if (e.kind === "batch") {
      const b = runBatch({ ...ctx, actor: { ...ctx.actor, id: "system" } }, true);
      if (b) done.push(`Nightly batch ${b.id} sent (${b.recordCount} record${b.recordCount === 1 ? "" : "s"}).`);
    } else {
      postRun(ctx, e.runId!);
      done.push(`Pay run ${e.runId!.replace("run_", "")} posted by the payroll simulator.`);
    }
  }
  s.clock.businessNow = to;
  // Future-dated confirmations become current when their date arrives.
  const today = localDate(to);
  for (const c of s.cases) {
    for (const l of c.lines) {
      if (l.coverageState === "confirmed_future" && l.startDate && l.startDate <= today) l.coverageState = "confirmed_current";
    }
    if (c.status === "approved") refreshCompletion(ctx, c);
  }
  done.push(...reminders(ctx));
  return done;
}

/** One reminder after the due time, one escalation to the named backup a business day later. Never approval or denial. */
function reminders(ctx: Ctx): string[] {
  const s = ctx.s;
  const now = s.clock.businessNow;
  const out: string[] = [];
  for (const t of s.tasks) {
    if (t.status !== "open" || !t.dueAt) continue;
    const c = s.cases.find((x) => x.id === t.caseId);
    if (c?.background) continue;
    if (!t.remindedAt && t.dueAt <= now) {
      t.remindedAt = now;
      notify(ctx, { key: `remind:${t.id}`, userId: t.ownerId, subject: `Reminder: ${t.title}`, preview: `Due ${fmtDateTime(t.dueAt)}. ${t.nextAction}`, caseId: t.caseId, eventType: "reminder", link: t.ownerId === "u_maya" ? `/employee/cases/${t.caseId}` : t.ownerId === "u_priya" ? "/broker/tasks" : `/admin/qle/${t.caseId}` });
      audit(ctx, { caseId: t.caseId, type: "task.reminder", summary: `Reminder sent to ${ownerName(t.ownerId)}: ${t.title}.`, actor: "system" });
      out.push(`Reminder: ${t.title}.`);
    } else if (t.remindedAt && !t.escalatedAt && addBusinessDays(t.dueAt, 1) <= now) {
      t.escalatedAt = now;
      const to = t.ownerId === "u_maya" ? HR_ID : t.backupOwnerId;
      notify(ctx, { key: `escalate:${t.id}`, userId: to, subject: `Escalated: ${t.title}`, preview: `${ownerName(t.ownerId)} has not acted. ${t.ownerId === "u_maya" ? "Employee silence is not a denial: decide the next step." : "Silence is not approval or coverage."}`, caseId: t.caseId, eventType: "escalation" });
      audit(ctx, { caseId: t.caseId, type: "task.escalated", summary: `Escalated to ${ownerName(to)}: ${t.title}. ${t.kind === "hr_review" ? "HR silence is not approval." : t.kind === "cobra_silence" ? "COBRA silence is not a notice." : ""}`, actor: "system" });
      out.push(`Escalated: ${t.title}.`);
    }
  }
  // Carrier silence: sent but no member result after two business days.
  for (const txn of s.txns) {
    if (txn.superseded || !txn.sentAt || txn.memberResult !== "pending" || txn.route === "manual") continue;
    if (addBusinessDays(txn.sentAt, 2) > now) continue;
    if (s.tasks.some((t) => t.txnId === txn.id && t.kind === "carrier_silence")) continue;
    addTask(ctx, { caseId: txn.caseId, kind: "carrier_silence", title: `No carrier response: ${txn.order.memberName} (${txn.order.benefit})`, reason: `Sent ${fmtDateTime(txn.sentAt)}. Carrier silence is not coverage.`, nextAction: "Follow up with the carrier or assign the broker. Keep the requested effective date.", ownerId: HR_ID, backupOwnerId: "u_priya", dueAt: addBusinessDays(now, 1), blocking: false, internalOnly: true, txnId: txn.id, lineId: txn.lineId });
    out.push(`Carrier silence flagged for ${txn.order.memberName}.`);
  }
  return out;
}
