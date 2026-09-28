import type {
  Benefit,
  CarrierObservation,
  CarrierTxn,
  ChangeOrder,
  CobraReferral,
  ExecutionLine,
  PayrollInstruction,
  QleCase,
  ScenarioState,
} from "@/lib/contracts/domain";
import { addDays, fmtDateLong, localDate, zonedToUtc } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { employeeCost, plan, TIER_LABEL } from "@/server/config/plans";
import { BATCH_SEND } from "@/server/config/payroll";
import { EVENT_LABEL } from "@/server/config/rules";
import { addTask, addBusinessDays, aiLog, audit, closeTasks, type Ctx, DomainError, EMPLOYEE_ID, HR_BACKUP, HR_ID, hoursFrom, metric, nextId, notify, now, today } from "./ctx";
import { build834, insReasons, sha256, txnSummaryLine, validate834 } from "./edi";
import { electionOn, personName } from "./evaluate";
import { computeAdjustment, priorAdjustments, targetRunFor } from "./payroll";

// ---------- change orders and delivery ----------

function carrierFor(s: ScenarioState, benefit: Benefit) {
  return s.carriers.find((c) => c.benefits.includes(benefit))!;
}

function orderFor(s: ScenarioState, c: QleCase, line: ExecutionLine, revisionNo: number, suffix: string): ChangeOrder {
  const person = s.people.find((p) => p.id === line.personId);
  const kid = c.facts.children?.find((k) => k.personId === line.personId);
  const subscriber = s.people.find((p) => p.id === c.employeeId)!;
  const carrier = carrierFor(s, line.benefit);
  return {
    operationKey: `op:${c.id}:${line.id}:r${revisionNo}${suffix}`,
    employerId: c.employerId,
    groupNumber: carrier.groupNumber,
    subscriberId: subscriber.subscriberId ?? "",
    personId: line.personId,
    memberName: personName(s, line.personId, c),
    relationship: person?.relationship ?? (kid ? "child" : "child"),
    dob: person?.dob ?? kid?.dob ?? null,
    benefit: line.benefit,
    planId: line.planId,
    action: line.action,
    tier: line.tierAfter,
    startDate: line.startDate,
    endDate: line.endDate,
    caseId: c.id,
    caseNumber: c.caseNumber,
    approvedRevision: revisionNo,
    ssnStatus: person?.ssnStatus ?? kid?.ssnStatus ?? "pending",
  };
}

export function queueTxn(ctx: Ctx, c: QleCase, line: ExecutionLine, correctionOf: string | null): CarrierTxn {
  const s = ctx.s;
  const carrier = carrierFor(s, line.benefit);
  const approval = c.approvals.find((a) => a.id === line.approvalId)!;
  const n = line.txnIds.length;
  const order = orderFor(s, c, line, approval.revisionNo, n ? `:c${n}` : "");
  if (s.txns.some((t) => t.order.operationKey === order.operationKey)) {
    throw new DomainError(409, "duplicate_operation", "This change was already queued.");
  }
  const txn: CarrierTxn = {
    id: nextId(s, "txn"),
    carrierId: carrier.id,
    route: line.route,
    lineId: line.id,
    caseId: c.id,
    order,
    correctionOf,
    batchId: null,
    delivery: "queued",
    memberResult: "pending",
    superseded: false,
    createdAt: now(ctx),
    attempts: [],
  };
  if (correctionOf) {
    const old = s.txns.find((t) => t.id === correctionOf);
    if (old) old.superseded = true;
  }
  s.txns.push(txn);
  line.currentTxnId = txn.id;
  line.txnIds.push(txn.id);
  line.coverageState = "awaiting_confirmation";
  line.mismatch = null;
  if (carrier.route === "api" && line.route === "api") sendApi(ctx, txn);
  return txn;
}

/** Simulated carrier API: a 202-style receipt means received, not covered. */
function sendApi(ctx: Ctx, txn: CarrierTxn) {
  const ref = `CVW-${txn.id.toUpperCase()}`;
  txn.delivery = "acknowledged";
  txn.sentAt = now(ctx);
  txn.apiReference = ref;
  txn.attempts.push({ id: nextId(ctx.s, "att"), at: now(ctx), outcome: `202 Accepted — transaction ${ref} (received, not covered)` });
  audit(ctx, { caseId: txn.caseId, type: "carrier.api_received", summary: `Simulated carrier API accepted ${txnSummaryLine(txn)} for processing (202, ref ${ref}). Receipt is not coverage.`, actor: "system" });
  if (ctx.s.preset === "dental_failure" && txn.order.benefit === "dental") {
    txn.memberResult = "rejected";
    txn.memberReason = "Carrier eligibility system rejected the dental record: dependent date of birth not accepted (simulated preset).";
    txn.delivery = "record_rejected";
    ctx.s.preset = "none";
    onRecordRejected(ctx, txn);
  }
}

export function approveExecution(ctx: Ctx, c: QleCase, approvalId: string) {
  const s = ctx.s;
  const approval = c.approvals.find((a) => a.id === approvalId)!;
  // Supersede lines from an older approval that have not been confirmed.
  for (const old of c.lines) {
    if (old.approvalId !== approvalId && old.coverageState !== "confirmed_current" && old.coverageState !== "confirmed_future" && old.coverageState !== "end_confirmed") {
      for (const tid of old.txnIds) {
        const t = s.txns.find((x) => x.id === tid);
        if (t) t.superseded = true;
      }
    }
  }
  const kept = c.lines.filter((l) => l.approvalId !== approvalId && ["confirmed_current", "confirmed_future", "end_confirmed"].includes(l.coverageState));
  const newLines: ExecutionLine[] = [];
  for (const pl of approval.lines) {
    const already = kept.find((l) => l.personId === pl.personId && l.benefit === pl.benefit && l.action === pl.action && l.startDate === pl.startDate && l.endDate === pl.endDate && l.tierAfter === pl.tierAfter && l.planId === pl.planId);
    if (already) continue; // unchanged confirmed work is preserved, not resent
    const carrier = carrierFor(s, pl.benefit);
    newLines.push({ ...pl, id: nextId(s, "ln"), caseId: c.id, approvalId, coverageState: "awaiting_confirmation", currentTxnId: null, txnIds: [], observationId: null, mismatch: null, route: carrier.route });
  }
  c.lines = [...kept, ...newLines];
  for (const l of newLines) queueTxn(ctx, c, l, null);
  const edi = newLines.filter((l) => l.route === "edi_834").length;
  const api = newLines.filter((l) => l.route === "api").length;
  audit(ctx, {
    caseId: c.id,
    type: "execution.queued",
    summary: `Queued ${newLines.length} carrier change${newLines.length === 1 ? "" : "s"}: ${edi} for the nightly 834 batch (cutoff 9:45 p.m., send 10:00 p.m. ET), ${api} through the simulated carrier API.`,
    employeeSummary: "Your approved change is being sent to the insurance provider.",
  });
}

export function runBatch(ctx: Ctx, auto = false) {
  const s = ctx.s;
  const queued = s.txns.filter((t) => t.delivery === "queued" && t.route === "edi_834" && !t.superseded);
  if (!queued.length) {
    if (auto) return null;
    throw new DomainError(422, "nothing_queued", "No approved changes are waiting for the next batch.", "Approve a case or send a correction first.");
  }
  const carrierId = queued[0].carrierId;
  const unknown = s.preset === "transport_unknown";
  const batchId = nextId(s, "batch");
  const control = String(100 + (s.counters.batch ?? 0));
  const sentAt = now(ctx);
  const payload = build834({ id: batchId, controlNumber: control, sentAt }, queued.map((t) => t.order), insReasons(s.cases));
  const v = validate834(payload, queued.length);
  const batch = {
    id: batchId,
    carrierId,
    controlNumber: control,
    txnIds: queued.map((t) => t.id),
    recordCount: queued.length,
    payloadHash: sha256(payload),
    queuedAt: queued[0].createdAt,
    sentAt,
    transport: unknown ? ("unknown" as const) : ("pending" as const),
    fileValidation: "pending" as const,
    attempts: [{ id: nextId(s, "att"), at: sentAt, outcome: unknown ? "Transfer timed out — outcome unknown (simulated SFTP)" : "Transmitted over simulated encrypted SFTP" }],
  };
  if (!v.ok) throw new DomainError(422, "invalid_payload", `The batch failed internal validation: ${v.errors.join(" ")}`);
  s.batches.push(batch);
  for (const t of queued) {
    t.batchId = batchId;
    t.sentAt = sentAt;
    t.delivery = unknown ? "receipt_unknown" : "sent";
    t.attempts.push({ id: batch.attempts[0].id, at: sentAt, outcome: batch.attempts[0].outcome });
  }
  const cases = [...new Set(queued.map((t) => t.caseId))];
  for (const cid of cases) {
    audit(ctx, { caseId: cid, type: "carrier.batch_sent", summary: `Included in ${batchId} (control ${control}, ${queued.length} records, hash ${batch.payloadHash.slice(0, 12)}…)${unknown ? " — transport outcome unknown" : ""}.`, employeeSummary: unknown ? null : "Sent to the insurance provider in the nightly update.", actor: auto ? "system" : ctx.actor.id });
    metric(ctx, "carrier_delivery", cid);
    const c = s.cases.find((x) => x.id === cid)!;
    if (!unknown) notify(ctx, { key: `sent:${cid}:${batchId}`, userId: EMPLOYEE_ID, subject: `${c.caseNumber}: sent to your insurance provider`, preview: "Your approved change was sent in the nightly update. We will tell you when the provider confirms it.", caseId: cid, eventType: "submitted_to_provider" });
  }
  if (unknown) {
    s.preset = "none";
    addTask(ctx, {
      caseId: cases[0],
      kind: "delivery_investigation",
      title: `Transport outcome unknown for ${batchId}`,
      reason: "The transfer timed out. We do not know whether the carrier received the file.",
      nextAction: "Run a status inquiry with the carrier before any resend or route switch. A blind resend could duplicate changes.",
      ownerId: HR_ID,
      backupOwnerId: "u_partner_ops",
      dueAt: hoursFrom(now(ctx), 12),
      blocking: true,
      internalOnly: true,
    });
  }
  return batch;
}

// ---------- carrier responses ----------

export function onRecordRejected(ctx: Ctx, txn: CarrierTxn) {
  const s = ctx.s;
  const c = s.cases.find((x) => x.id === txn.caseId)!;
  const line = c.lines.find((l) => l.id === txn.lineId);
  if (!line || line.currentTxnId !== txn.id) return;
  addTask(ctx, {
    caseId: c.id,
    kind: "record_rejected",
    title: `Carrier rejected ${txn.order.memberName} (${txn.order.benefit})`,
    reason: txn.memberReason ?? "Record rejected by the carrier.",
    nextAction: "Send a corrected record for this line only, or assign it to the broker. Other people and benefits stay as they are.",
    ownerId: HR_ID,
    backupOwnerId: "u_priya",
    dueAt: addBusinessDays(now(ctx), 1),
    blocking: true,
    internalOnly: false,
    lineId: line.id,
    txnId: txn.id,
  });
  audit(ctx, { caseId: c.id, type: "carrier.record_rejected", summary: `Carrier rejected ${txnSummaryLine(txn)}: ${txn.memberReason}`, employeeSummary: "We are correcting a provider response. No action is needed from you right now." });
  notify(ctx, { key: `issue:${c.id}:${txn.id}`, userId: EMPLOYEE_ID, subject: `${c.caseNumber}: we are correcting a provider response`, preview: "The insurance provider needs a correction for part of your request. No action is needed from you right now.", caseId: c.id, eventType: "provider_issue" });
  notify(ctx, { key: `issue:${c.id}:${txn.id}`, userId: HR_ID, subject: `${c.caseNumber}: carrier rejected a record`, preview: `${txn.order.memberName}, ${txn.order.benefit}. Correct this line only.`, caseId: c.id, eventType: "provider_issue" });
}

export function ingestObservation(
  ctx: Ctx,
  o: { eventId: string; txnId: string; planId: string; tier: CarrierObservation["tier"]; startDate: string | null; endDate: string | null; sourceRef: string },
): CarrierObservation {
  const s = ctx.s;
  const dup = s.observations.find((x) => x.eventId === o.eventId);
  if (dup) return dup; // duplicate callbacks are ingested once
  const txn = s.txns.find((t) => t.id === o.txnId);
  if (!txn) throw new DomainError(404, "unknown_transaction", "That transaction reference is unknown.");
  if (txn.delivery === "queued") throw new DomainError(422, "not_sent", "This change has not been sent to the carrier. An unsent change cannot be confirmed.");
  if (txn.memberResult !== "accepted" && txn.route !== "manual") throw new DomainError(422, "not_accepted", "Accept the member record before publishing a coverage observation.");
  const c = s.cases.find((x) => x.id === txn.caseId)!;
  const line = c.lines.find((l) => l.id === txn.lineId)!;
  const stale = txn.superseded || line.currentTxnId !== txn.id;
  const obs: CarrierObservation = {
    id: nextId(s, "obs"),
    eventId: o.eventId,
    txnId: txn.id,
    caseId: c.id,
    lineId: line.id,
    personId: txn.order.personId,
    benefit: txn.order.benefit,
    planId: o.planId,
    tier: o.tier,
    startDate: o.startDate,
    endDate: o.endDate,
    sourceRef: o.sourceRef,
    observedAt: now(ctx),
    ingestedAt: ctx.real,
    stale,
    outcome: "stale_ignored",
  };
  s.observations.push(obs);
  applyToRoster(ctx, txn, obs);
  if (stale) {
    audit(ctx, { caseId: c.id, type: "carrier.stale_observation", summary: `Stale carrier response for superseded transaction ${txn.id} kept in history. It does not overwrite the newer approved correction.` });
    return obs;
  }
  reconcileLine(ctx, c, line, obs);
  return obs;
}

function applyToRoster(ctx: Ctx, txn: CarrierTxn, obs: CarrierObservation) {
  // The carrier roster is the carrier's own record. It changes only from published
  // observations, never from our approved intent. Stale responses never touch it.
  if (obs.stale) return;
  const s = ctx.s;
  const active = s.roster.find((r) => r.personId === obs.personId && r.benefit === obs.benefit && r.endDate === null);
  const base = { carrierId: txn.carrierId, personId: obs.personId, benefit: obs.benefit, planId: obs.planId, tier: obs.tier, sourceRef: obs.sourceRef, observedAt: obs.observedAt };
  if (txn.order.action === "terminate") {
    if (active) Object.assign(active, { endDate: obs.endDate, sourceRef: obs.sourceRef, observedAt: obs.observedAt });
    return;
  }
  if (txn.order.action === "tier_change" && active && obs.startDate && obs.startDate > active.startDate) {
    // The coverage level is the household's: every active member on this benefit moves with it.
    const start = obs.startDate;
    const leaving = new Set(s.txns.filter((t) => t.caseId === txn.caseId && t.order.action === "terminate").map((t) => t.order.personId));
    const household = s.roster.filter((r) => r.benefit === obs.benefit && r.carrierId === txn.carrierId && r.endDate === null && r.id !== active.id && r.startDate < start && !leaving.has(r.personId));
    for (const r of [active, ...household]) {
      r.endDate = addDays(start, -1);
      s.roster.push({ ...r, id: nextId(s, "cov"), tier: obs.tier, startDate: start, endDate: null, sourceRef: obs.sourceRef, observedAt: obs.observedAt, planId: r.personId === active.personId ? obs.planId : r.planId });
    }
    return;
  }
  if (active) {
    Object.assign(active, { ...base, startDate: obs.startDate ?? active.startDate, endDate: obs.endDate });
    return;
  }
  s.roster.push({ id: nextId(s, "cov"), ...base, startDate: obs.startDate ?? "2026-01-01", endDate: obs.endDate });
}

function coverageStateFor(ctx: Ctx, line: ExecutionLine) {
  if (line.action === "terminate") return "end_confirmed" as const;
  return line.startDate && line.startDate > today(ctx.s) ? ("confirmed_future" as const) : ("confirmed_current" as const);
}

export function reconcileLine(ctx: Ctx, c: QleCase, line: ExecutionLine, obs: CarrierObservation) {
  const who = personName(ctx.s, line.personId, c);
  const diffs: NonNullable<ExecutionLine["mismatch"]>[] = [];
  if (obs.planId !== line.planId) diffs.push({ field: "plan", expected: plan(line.planId).shortName, observed: plan(obs.planId).shortName, message: `${who}'s approved plan is ${plan(line.planId).shortName}. The carrier record shows ${plan(obs.planId).shortName}.` });
  if (obs.tier !== line.tierAfter) diffs.push({ field: "tier", expected: TIER_LABEL[line.tierAfter], observed: TIER_LABEL[obs.tier], message: `${who}'s approved coverage level is ${TIER_LABEL[line.tierAfter]}. The carrier record shows ${TIER_LABEL[obs.tier]}.` });
  if (line.action !== "terminate" && obs.startDate !== line.startDate)
    diffs.push({ field: "start", expected: line.startDate ?? "", observed: obs.startDate ?? "", message: `${who}'s requested start is ${fmtDateLong(line.startDate)}. The carrier record shows ${fmtDateLong(obs.startDate)}.` });
  if (line.action === "terminate" && obs.endDate !== line.endDate)
    diffs.push({ field: "end", expected: line.endDate ?? "", observed: obs.endDate ?? "", message: `${who}'s approved end date is ${fmtDateLong(line.endDate)}. The carrier record shows ${fmtDateLong(obs.endDate)}.` });
  const wasConfirmed = ["confirmed_current", "confirmed_future", "end_confirmed"].includes(line.coverageState);
  line.observationId = obs.id;
  aiLog(ctx, { caseId: c.id, kind: "reconciliation_check", label: "Reconciliation check", detail: diffs.length ? diffs.map((d) => d.message).join(" ") : `${who} ${line.benefit}: carrier record matches the approved plan, level and date.`, model: null, actor: "system" });
  if (diffs.length) {
    obs.outcome = "mismatch";
    line.coverageState = "mismatch";
    line.mismatch = diffs[0];
    if (wasConfirmed) {
      c.reopenedAt = now(ctx);
      c.completedAt = undefined;
      metric(ctx, "case_reopened", c.id);
    }
    addTask(ctx, {
      caseId: c.id,
      kind: "coverage_mismatch",
      title: `Coverage mismatch: ${who}, ${line.benefit}`,
      reason: diffs.map((d) => d.message).join(" "),
      nextAction: "Send a versioned correction for this line only, or assign it to the broker. The approved intent and original receipt are kept.",
      ownerId: HR_ID,
      backupOwnerId: "u_priya",
      dueAt: addBusinessDays(now(ctx), 1),
      blocking: true,
      internalOnly: false,
      lineId: line.id,
      txnId: obs.txnId,
    });
    // Pause the affected payroll instruction.
    for (const i of ctx.s.instructions) {
      if (i.caseId === c.id && i.benefit === line.benefit && ["approval_needed", "scheduled"].includes(i.state)) i.state = "blocked";
    }
    audit(ctx, { caseId: c.id, type: "reconciliation.mismatch", summary: diffs.map((d) => d.message).join(" "), employeeSummary: "We are correcting a provider response. No action is needed from you right now.", data: { field: diffs[0].field, expected: diffs[0].expected, observed: diffs[0].observed } });
    metric(ctx, "mismatch_detected", c.id);
    notify(ctx, { key: `mismatch:${c.id}:${obs.id}`, userId: EMPLOYEE_ID, subject: `${c.caseNumber}: we are correcting a provider response`, preview: "The insurance provider's record does not match your approved change yet. No action is needed from you right now.", caseId: c.id, eventType: "provider_issue" });
    notify(ctx, { key: `mismatch:${c.id}:${obs.id}`, userId: HR_ID, subject: `${c.caseNumber}: coverage mismatch`, preview: diffs[0].message, caseId: c.id, eventType: "provider_issue" });
    return;
  }
  obs.outcome = "matched";
  line.coverageState = coverageStateFor(ctx, line);
  line.mismatch = null;
  closeTasks(ctx, (t) => t.caseId === c.id && t.lineId === line.id && ["coverage_mismatch", "record_rejected", "broker_correction", "carrier_silence"].includes(t.kind), "Resolved: carrier record matches the approved change.");
  if (ctx.s.tasks.some((t) => t.caseId === c.id && t.lineId === line.id && t.kind === "coverage_mismatch")) metric(ctx, "mismatch_resolved", c.id);
  audit(ctx, {
    caseId: c.id,
    type: "reconciliation.matched",
    summary: `Carrier record matches for ${who} (${line.benefit}): ${line.action === "terminate" ? `ends ${fmtDateLong(line.endDate, true)}` : `${TIER_LABEL[line.tierAfter]} from ${fmtDateLong(line.startDate, true)}`}. Source ${obs.sourceRef}.`,
    employeeSummary:
      line.action === "terminate"
        ? `End date confirmed for ${who} (${line.benefit}): ${fmtDateLong(line.endDate, true)}.`
        : line.coverageState === "confirmed_future"
          ? `${who} ${line.benefit}: confirmed from ${fmtDateLong(line.startDate, true)}.`
          : `${who} ${line.benefit}: coverage confirmed from ${fmtDateLong(line.startDate, true)}.`,
  });
  afterLineConfirmed(ctx, c, line.benefit);
}

/** When every line of a benefit is verified, update the host election and prepare payroll. */
export function afterLineConfirmed(ctx: Ctx, c: QleCase, benefit: Benefit) {
  const s = ctx.s;
  const lines = c.lines.filter((l) => l.benefit === benefit);
  const allOk = lines.every((l) => ["confirmed_current", "confirmed_future", "end_confirmed"].includes(l.coverageState));
  if (!allOk) {
    refreshCompletion(ctx, c);
    return;
  }
  const approval = c.approvals.find((a) => !a.supersededAt && lines.some((l) => l.approvalId === a.id)) ?? c.approvals[c.approvals.length - 1];
  const rev = c.revisions.find((r) => r.revisionNo === approval.revisionNo)!;
  const cost = rev.evaluation.costs.find((x) => x.benefit === benefit);
  const cur = electionOn(s, benefit, today(s));
  const changeDate = cost?.effectiveDate ?? lines.map((l) => (l.action === "terminate" ? addDays(l.endDate!, 1) : l.startDate!)).sort()[0];
  // Host election update (dated). Confirmed coverage only.
  if (cur && cost && !s.elections.some((e) => e.caseId === c.id && e.benefit === benefit && e.effectiveFrom === changeDate)) {
    const covered = [...new Set([...cur.coveredPersonIds.filter((id) => !lines.some((l) => l.personId === id && l.action === "terminate")), ...lines.filter((l) => l.action === "add").map((l) => l.personId)])];
    cur.effectiveTo = addDays(changeDate, -1);
    s.elections.push({ id: nextId(s, "el"), personId: c.employeeId, benefit, planId: cost.planAfter, tier: cost.tierAfter, coveredPersonIds: covered, effectiveFrom: changeDate, effectiveTo: null, source: "case", caseId: c.id });
    // Newly added children become household members at the host.
    for (const l of lines.filter((x) => x.action === "add")) {
      if (!s.people.some((p) => p.id === l.personId)) {
        const kid = c.facts.children?.find((k) => k.personId === l.personId);
        if (kid) s.people.push({ id: kid.personId, employerId: c.employerId, firstName: kid.firstName, lastName: kid.lastName, dob: kid.dob, relationship: "child", residenceState: "NY", ssnStatus: kid.ssnStatus, addedByCaseId: c.id });
      }
    }
    for (const l of lines.filter((x) => x.action === "terminate")) {
      const p = s.people.find((x) => x.id === l.personId);
      if (p && c.eventCode === "divorce") p.relationship = "former_spouse";
    }
    audit(ctx, { caseId: c.id, type: "host.election_updated", summary: `Host election for ${benefit} updated: ${plan(cost.planAfter).shortName}, ${TIER_LABEL[cost.tierAfter]} from ${fmtDateLong(changeDate, true)}. Host acknowledgment recorded (simulated).` });
  }
  if (!cost) return refreshCompletion(ctx, c);
  if (s.instructions.some((i) => i.caseId === c.id && i.benefit === benefit && !["mismatch"].includes(i.state) && !i.rejectedReason)) {
    const blocked = s.instructions.filter((i) => i.caseId === c.id && i.benefit === benefit && i.state === "blocked");
    for (const b of blocked) b.state = b.adjustmentCents !== 0 && !b.authorizedAt ? "approval_needed" : "scheduled";
    return refreshCompletion(ctx, c);
  }
  createInstruction(ctx, c, benefit, cost.beforeCents, cost.afterCents, changeDate);
  refreshCompletion(ctx, c);
}

export function createInstruction(ctx: Ctx, c: QleCase, benefit: Benefit, oldCents: number, newCents: number, changeDate: string, correctionOf?: string): PayrollInstruction {
  const s = ctx.s;
  const run = targetRunFor(s.payRuns, now(ctx), changeDate);
  if (!run) throw new DomainError(422, "no_run", "No open pay run is available for this change.");
  const setup = s.payrollSetup.find((p) => p.benefit === benefit)!;
  const calc = computeAdjustment({ runs: s.payRuns, ledger: s.ledger, benefit, changeDate, oldCents, newCents, targetRun: run, scheduledOldCents: setup.recurringCents, priorAdjustmentsCents: priorAdjustments(s, c.id, benefit) });
  const noChange = oldCents === newCents && calc.adjustmentCents === 0;
  const inst: PayrollInstruction = {
    id: nextId(s, "pi"),
    caseId: c.id,
    benefit,
    state: noChange ? "verified_no_change" : calc.adjustmentCents !== 0 || calc.needsReview ? "approval_needed" : "scheduled",
    targetRunId: run.id,
    previousRecurringCents: oldCents,
    newRecurringCents: newCents,
    adjustmentCents: calc.adjustmentCents,
    adjustmentBasis: calc.basis,
    calcLines: calc.lines,
    effectiveFrom: changeDate,
    createdAt: now(ctx),
    operationKey: `pay:${c.id}:${benefit}:${changeDate}${correctionOf ? `:corr:${correctionOf}` : ""}`,
    correctionOf,
  };
  if (s.instructions.some((i) => i.operationKey === inst.operationKey)) return s.instructions.find((i) => i.operationKey === inst.operationKey)!;
  if (Math.abs(inst.adjustmentCents) > 50000) {
    inst.adjustmentBasis += " Large adjustment: payroll reviews an installment or alternate collection arrangement. A negative net paycheck is never forced.";
  }
  s.instructions.push(inst);
  if (inst.state === "approval_needed") {
    addTask(ctx, {
      caseId: c.id,
      kind: "payroll_authorization",
      title: `Authorize ${inst.adjustmentCents > 0 ? "catch-up" : "refund proposal"} for ${benefit}`,
      reason: calc.basis,
      nextAction: `Review and authorize ${fmtMoney(Math.abs(inst.adjustmentCents))} on the ${fmtDateLong(run.payday, true)} run. It is recalculated from the posted ledger when you authorize.`,
      ownerId: HR_ID,
      backupOwnerId: HR_BACKUP,
      dueAt: run.cutoffAt,
      blocking: true,
      internalOnly: true,
      instructionId: inst.id,
    });
  }
  audit(ctx, {
    caseId: c.id,
    type: "payroll.instruction_created",
    summary: noChange
      ? `Payroll verified unchanged for ${benefit}: ${fmtMoney(newCents)} per paycheck, no adjustment.`
      : `Payroll instruction for ${benefit}: ${fmtMoney(oldCents)} → ${fmtMoney(newCents)} per paycheck from the ${fmtDateLong(run.payday, true)} run; adjustment ${fmtMoney(calc.adjustmentCents, "USD", { sign: true })}. ${calc.basis}`,
    employeeSummary: noChange ? `No change to your regular ${benefit} deduction.` : `Pay update prepared for your ${fmtDateLong(run.payday, true)} paycheck.`,
  });
  if (inst.state === "scheduled") notifyPayScheduled(ctx, c, inst);
  return inst;
}

export function notifyPayScheduled(ctx: Ctx, c: QleCase, inst: PayrollInstruction) {
  const run = ctx.s.payRuns.find((r) => r.id === inst.targetRunId)!;
  notify(ctx, {
    key: `payscheduled:${c.id}:${run.id}`,
    userId: EMPLOYEE_ID,
    subject: `${c.caseNumber}: pay update scheduled`,
    preview: `Your benefit deduction change is scheduled for your ${fmtDateLong(run.payday, true)} paycheck. Open Pay to see the before and after.`,
    caseId: c.id,
    eventType: "payroll_scheduled",
    link: "/employee/pay",
  });
}

export function recalcBeforeAuthorize(ctx: Ctx, inst: PayrollInstruction) {
  const s = ctx.s;
  const run = s.payRuns.find((r) => r.id === inst.targetRunId)!;
  if (run.status === "posted" || run.cutoffAt <= now(ctx)) {
    const next = targetRunFor(s.payRuns, now(ctx), inst.effectiveFrom);
    if (!next) throw new DomainError(422, "no_run", "No open pay run is available.");
    inst.targetRunId = next.id;
  }
  const target = s.payRuns.find((r) => r.id === inst.targetRunId)!;
  const setup = s.payrollSetup.find((p) => p.benefit === inst.benefit)!;
  const calc = computeAdjustment({ runs: s.payRuns, ledger: s.ledger, benefit: inst.benefit, changeDate: inst.effectiveFrom, oldCents: inst.previousRecurringCents, newCents: inst.newRecurringCents, targetRun: target, scheduledOldCents: setup.recurringCents, priorAdjustmentsCents: priorAdjustments(s, inst.caseId, inst.benefit, inst.id) });
  const changed = calc.adjustmentCents !== inst.adjustmentCents;
  inst.adjustmentCents = calc.adjustmentCents;
  inst.adjustmentBasis = calc.basis;
  inst.calcLines = calc.lines;
  return changed;
}

// ---------- payroll simulator ----------

export function postRun(ctx: Ctx, runId: string, override?: { benefit: Benefit; amountCents: number }) {
  const s = ctx.s;
  const run = s.payRuns.find((r) => r.id === runId);
  if (!run) throw new DomainError(404, "run_not_found", "Pay run not found.");
  if (run.status === "posted") throw new DomainError(409, "already_posted", "This pay run is already posted. Posted payslips are immutable.");
  const earlier = s.payRuns.find((r) => r.status === "scheduled" && r.payday < run.payday);
  if (earlier) throw new DomainError(422, "earlier_run_open", `Post the ${fmtDateLong(earlier.payday, true)} run first.`);
  const differentPreset = s.preset === "payroll_different_amount";
  for (const setup of s.payrollSetup) {
    if (setup.pending && s.payRuns.find((r) => r.id === setup.pending!.fromRunId)!.payday <= run.payday) {
      setup.recurringCents = setup.pending.recurringCents;
      setup.fromRunId = setup.pending.fromRunId;
      setup.pending = null;
    }
    let recurring = setup.recurringCents;
    let oneTime = setup.oneTime.filter((o) => o.runId === run.id);
    if (override?.benefit === setup.benefit || (differentPreset && setup.benefit === "medical" && s.instructions.some((i) => i.targetRunId === run.id && i.benefit === "medical"))) {
      recurring = override?.benefit === setup.benefit ? override.amountCents : Math.max(0, recurring - 5000);
      oneTime = [];
    }
    s.ledger.push({ id: nextId(s, "pd"), runId: run.id, benefit: setup.benefit, kind: "recurring", amountCents: recurring, allocatedMonth: run.periodStart.slice(0, 7) });
    for (const o of oneTime) s.ledger.push({ id: nextId(s, "pd"), runId: run.id, benefit: setup.benefit, kind: "adjustment", amountCents: o.amountCents, allocatedMonth: run.periodStart.slice(0, 7), instructionId: o.instructionId });
  }
  if (differentPreset) s.preset = "none";
  run.status = "posted";
  run.postedAt = now(ctx);
  audit(ctx, { caseId: null, type: "payroll.run_posted", summary: `Payroll simulator posted the ${fmtDateLong(run.payday, true)} run${override ? ` with an operator-entered ${override.benefit} amount of ${fmtMoney(override.amountCents)}` : ""}.` });
  // Compare posted results with authorized instructions.
  for (const inst of s.instructions.filter((i) => i.targetRunId === run.id && ["instruction_accepted", "scheduled"].includes(i.state))) {
    const posted = s.ledger.filter((d) => d.runId === run.id && d.benefit === inst.benefit);
    const rec = posted.filter((d) => d.kind === "recurring").reduce((a, d) => a + d.amountCents, 0);
    const adj = posted.filter((d) => d.kind === "adjustment" && d.instructionId === inst.id).reduce((a, d) => a + d.amountCents, 0);
    inst.postedCents = rec;
    inst.postedAdjustmentCents = adj;
    const c = s.cases.find((x) => x.id === inst.caseId)!;
    if (inst.state === "scheduled") {
      // Instruction never accepted by the payroll system: the run posted without it.
      inst.state = "mismatch";
    } else inst.state = rec === inst.newRecurringCents && adj === inst.adjustmentCents ? "posted" : "mismatch";
    if (inst.state === "posted") {
      audit(ctx, { caseId: c.id, type: "payroll.posted", summary: `Posted ${inst.benefit} ${fmtMoney(rec)} recurring + ${fmtMoney(adj)} adjustment matches the instruction.`, employeeSummary: `Pay updated on your ${fmtDateLong(run.payday, true)} paycheck.` });
      metric(ctx, "payroll_posted_reconciled", c.id);
      notify(ctx, { key: `payposted:${c.id}:${run.id}`, userId: EMPLOYEE_ID, subject: `${c.caseNumber}: pay updated`, preview: `Your ${fmtDateLong(run.payday, true)} payslip shows the new benefit deduction. Open Pay for details.`, caseId: c.id, eventType: "payroll_posted", link: "/employee/pay" });
      closeTasks(ctx, (t) => t.instructionId === inst.id && t.kind === "payroll_mismatch", "Payroll result matches.");
    } else {
      addTask(ctx, {
        caseId: c.id,
        kind: "payroll_mismatch",
        title: `Payroll result differs for ${inst.benefit}`,
        reason: `Expected ${fmtMoney(inst.newRecurringCents)} recurring + ${fmtMoney(inst.adjustmentCents)} adjustment; posted ${fmtMoney(rec)} + ${fmtMoney(adj)}. Coverage stays confirmed.`,
        nextAction: "Request a payroll correction on the next permitted run. Do not rewrite the posted payslip.",
        ownerId: HR_ID,
        backupOwnerId: HR_BACKUP,
        dueAt: addBusinessDays(now(ctx), 1),
        blocking: true,
        internalOnly: true,
        instructionId: inst.id,
      });
      audit(ctx, { caseId: c.id, type: "payroll.mismatch", summary: `Posted ${inst.benefit} result ${fmtMoney(rec + adj)} differs from the instruction ${fmtMoney(inst.newRecurringCents + inst.adjustmentCents)}.`, employeeSummary: "We are checking a payroll result. Your coverage is not affected." });
    }
    refreshCompletion(ctx, c);
  }
}

// ---------- COBRA ----------

export function openCobraReferral(ctx: Ctx, c: QleCase) {
  const s = ctx.s;
  const sp = c.facts.formerSpousePersonId;
  if (!sp || s.cobra.some((r) => r.caseId === c.id)) return;
  const p = s.people.find((x) => x.id === sp)!;
  const end = c.evaluation?.proposedLines.find((l) => l.action === "terminate")?.endDate ?? null;
  const ref: CobraReferral = {
    id: nextId(s, "cobra"),
    caseId: c.id,
    state: "review_needed",
    beneficiaryPersonId: sp,
    beneficiaryName: `${p.firstName} ${p.lastName}`,
    qualifyingEvent: "Divorce",
    eventDate: c.facts.eventDate ?? null,
    coverageLossDate: end ? addDays(end, 1) : null,
    plans: (c.evaluation?.proposedLines ?? []).filter((l) => l.action === "terminate").map((l) => ({ benefit: l.benefit, planId: l.planId })),
    contactRoute: c.facts.formerSpouseContactKnown === false ? "contact_verification_needed" : null,
    createdAt: now(ctx),
    history: [{ at: now(ctx), actor: "system", state: "review_needed", note: "Potential COBRA qualifying event identified at submission." }],
    private: { mailingAddress: "18 Hudson Row, Apt 4B, Albany, NY 12207 (synthetic)", email: "arjun.private@example.invalid" },
  };
  s.cobra.push(ref);
  addTask(ctx, {
    caseId: c.id,
    kind: "cobra_referral",
    title: "Confirm and send the COBRA referral",
    reason: "Divorce ends a covered spouse's Nexa coverage. The administrator owns notices, elections and premiums.",
    nextAction: "Confirm the beneficiary, event, coverage-loss date, plans and a verified contact route, then send the minimal referral.",
    ownerId: HR_ID,
    backupOwnerId: HR_BACKUP,
    dueAt: addBusinessDays(now(ctx), 1),
    blocking: true,
    internalOnly: true,
    referralId: ref.id,
  });
  if (c.facts.formerSpouseContactKnown === false) {
    addTask(ctx, {
      caseId: c.id,
      kind: "contact_verification",
      title: "Verify the former spouse's contact route (restricted)",
      reason: "Address unknown. Maya is not the delivery channel for private notices.",
      nextAction: "Verify a contact route through the approved protected process.",
      ownerId: HR_ID,
      backupOwnerId: HR_BACKUP,
      dueAt: addBusinessDays(now(ctx), 2),
      blocking: false,
      internalOnly: true,
      referralId: ref.id,
    });
  }
  audit(ctx, { caseId: c.id, type: "cobra.review_needed", summary: `Potential COBRA referral opened for ${ref.beneficiaryName}. Deadline needs verification until the administrator confirms receipt and notice triggers.`, employeeSummary: "Continuation information will be referred to the plan's administrator. Your former spouse's choices and payments stay private." });
}

// ---------- completion ----------

export function executionSummary(s: ScenarioState, c: QleCase) {
  const lines = c.lines;
  const benefits = [...new Set(lines.map((l) => l.benefit))];
  const linesOk = lines.length > 0 && lines.every((l) => ["confirmed_current", "confirmed_future", "end_confirmed"].includes(l.coverageState));
  const payroll = benefits.map((b) => {
    const insts = s.instructions.filter((i) => i.caseId === c.id && i.benefit === b);
    const latest = insts[insts.length - 1];
    return { benefit: b, state: latest?.state ?? null };
  });
  const payrollDone = payroll.every((p) => p.state === "posted" || p.state === "verified_no_change");
  const payrollScheduled = payroll.every((p) => p.state && ["posted", "verified_no_change", "scheduled", "instruction_accepted", "approval_needed"].includes(p.state));
  const cobra = s.cobra.find((r) => r.caseId === c.id);
  const cobraOk = !cobra || ["received", "notice_tracked"].includes(cobra.state);
  const openBlocking = s.tasks.filter((t) => t.caseId === c.id && t.status === "open" && t.blocking);
  const issues = lines.filter((l) => l.coverageState === "mismatch" || (l.currentTxnId && s.txns.find((t) => t.id === l.currentTxnId)?.memberResult === "rejected"));
  return { linesOk, payroll, payrollDone, payrollScheduled, cobra, cobraOk, openBlocking, issues, complete: c.status === "approved" && linesOk && payrollDone && cobraOk && openBlocking.length === 0 };
}

export function refreshCompletion(ctx: Ctx, c: QleCase) {
  const sum = executionSummary(ctx.s, c);
  if (sum.complete && !c.completedAt) {
    c.completedAt = now(ctx);
    audit(ctx, { caseId: c.id, type: "case.completed", summary: "Case complete: every affected line has a verified carrier outcome, payroll posted or verified unchanged, and required handoffs acknowledged.", employeeSummary: "Complete. Your coverage and pay match the approved change." });
    metric(ctx, "case_completed", c.id);
    notify(ctx, { key: `complete:${c.id}`, userId: EMPLOYEE_ID, subject: `${c.caseNumber}: complete`, preview: `Your ${EVENT_LABEL[c.eventCode].toLowerCase()} request is complete. Coverage and pay match the approved change.`, caseId: c.id, eventType: "case_completed" });
    notify(ctx, { key: `complete:${c.id}`, userId: HR_ID, subject: `${c.caseNumber}: complete`, preview: "Carrier, payroll and handoffs verified.", caseId: c.id, eventType: "case_completed" });
  } else if (!sum.complete && c.completedAt) {
    c.completedAt = undefined;
    c.reopenedAt = now(ctx);
    audit(ctx, { caseId: c.id, type: "case.reopened", summary: "Case reopened: a later record no longer matches.", employeeSummary: "We reopened your request to correct a record. No action is needed from you right now." });
  }
}

export function batchSendTime(dateLocal: string) {
  return zonedToUtc(dateLocal, BATCH_SEND);
}
export function nextBatchAt(s: ScenarioState): string {
  const d = localDate(s.clock.businessNow);
  const t = batchSendTime(d);
  return t > s.clock.businessNow ? t : batchSendTime(addDays(d, 1));
}
export { hoursFrom };
