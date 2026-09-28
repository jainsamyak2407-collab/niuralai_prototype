import type { Command } from "@/lib/contracts/commands";
import type { CommandResult, DemoUser, QleCase, Role, ScenarioState } from "@/lib/contracts/domain";
import { addDays, firstOfNextMonth, fmtDateLong, localDate, zonedToUtc } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { EVENT_LABEL } from "@/server/config/rules";
import { NEXA, PARTNER_ID } from "@/server/config/identities";
import { addBusinessDays, addTask, aiLog, audit, closeTasks, type Ctx, DomainError, EMPLOYEE_ID, findCase, HR_BACKUP, HR_ID, metric, nextId, notify, now, today, touch } from "./ctx";
import { sha256 } from "./edi";
import { blockingOpen, defaultElections, evaluateCase, personName } from "./evaluate";
import {
  afterLineConfirmed,
  approveExecution,
  executionSummary,
  ingestObservation,
  notifyPayScheduled,
  onRecordRejected,
  openCobraReferral,
  postRun,
  queueTxn,
  recalcBeforeAuthorize,
  refreshCompletion,
  runBatch,
} from "./execution";
import { advanceClock, runDueJobs } from "./jobs";
import { RULES_ACTOR, runAutopilot } from "./autopilot";

const ROLE_FOR: Record<string, Role[]> = {
  case: ["employee"],
  hr: ["hr_admin"],
  broker: ["broker"],
};
const OPS_ROLES: Record<string, Role[]> = {
  "ops.runBatch": ["demo_operator", "carrier_operator"],
  "ops.batchTransport": ["demo_operator", "carrier_operator"],
  "ops.batchValidation": ["demo_operator", "carrier_operator"],
  "ops.memberResult": ["demo_operator", "carrier_operator"],
  "ops.publishObservation": ["demo_operator", "carrier_operator"],
  "ops.publishAccepted": ["demo_operator", "carrier_operator"],
  "ops.payrollInstruction": ["demo_operator"],
  "ops.payrollPost": ["demo_operator"],
  "ops.cobra": ["demo_operator", "cobra_admin"],
  "ops.clock": ["demo_operator"],
  "ops.preset": ["demo_operator"],
  "ops.bounce": ["demo_operator"],
  "ops.rateChange": ["demo_operator"],
  "ops.autopilot": ["demo_operator"],
  "ops.reset": ["demo_operator"],
};

export function authorize(actor: DemoUser, cmd: Command) {
  const prefix = cmd.type.split(".")[0];
  const allowed = prefix === "ops" ? OPS_ROLES[cmd.type] : ROLE_FOR[prefix];
  if (!allowed?.includes(actor.role)) throw new DomainError(403, "forbidden", "Your role cannot perform this action.");
}

function ownCase(ctx: Ctx, id: string): QleCase {
  const c = findCase(ctx.s, id);
  if (ctx.actor.role === "employee" && c.employeeId !== ctx.actor.personId) throw new DomainError(404, "case_not_found", "We could not find that case.");
  if (ctx.actor.role === "hr_admin" && c.employerId !== ctx.actor.employerId) throw new DomainError(404, "case_not_found", "We could not find that case.");
  return c;
}

function expectVersion(c: QleCase, v: number) {
  if (c.version !== v) {
    throw new DomainError(409, "version_conflict", "This case changed since you opened it. Review the latest version before saving.", "Reload the case to see the latest changes.", undefined, {
      version: c.version,
      status: c.status,
      updatedAt: c.updatedAt,
    });
  }
}

function reevaluate(ctx: Ctx, c: QleCase) {
  c.evaluation = evaluateCase(ctx.s, c);
  return c.evaluation;
}

function snapshotHash(c: QleCase) {
  return sha256(JSON.stringify({ e: c.eventCode, f: c.facts, el: c.elections })).slice(0, 16);
}

function addRevision(ctx: Ctx, c: QleCase, reason: string, material: boolean) {
  const ev = reevaluate(ctx, c);
  const rev = { revisionNo: c.revisions.length + 1, createdAt: now(ctx), createdBy: ctx.actor.id, reason, eventCode: c.eventCode, facts: structuredClone(c.facts), elections: structuredClone(c.elections), evaluation: structuredClone(ev), hash: snapshotHash(c), material };
  c.revisions.push(rev);
  return rev;
}

function requireEmployeeOpen(c: QleCase) {
  if (!["draft", "needs_information"].includes(c.status)) {
    throw new DomainError(409, "not_editable", "This request is with HR. Reply to a specific request from HR to change it.", "Open the case tracker.");
  }
}

/** Material facts (person, plan, date, amount) changed after an approval invalidates it. */
function invalidateApprovalIfMaterial(ctx: Ctx, c: QleCase, before: string) {
  if (!c.approvals.some((a) => !a.supersededAt)) return;
  const after = snapshotHash(c);
  if (before === after) return;
  for (const a of c.approvals) {
    if (!a.supersededAt) {
      a.supersededAt = now(ctx);
      a.supersededReason = "A material fact changed after approval. A new version needs approval.";
    }
  }
  c.status = "under_review";
  c.checkResolutions = {};
  audit(ctx, { caseId: c.id, type: "approval.invalidated", summary: "Material change after approval: the earlier approval no longer authorizes execution. Reapproval required." });
}

export function execute(ctx: Ctx, cmd: Command): CommandResult {
  const result = executeOne(ctx, cmd);
  if (!ctx.nested) runAutopilot(ctx);
  return result;
}

function executeOne(ctx: Ctx, cmd: Command): CommandResult {
  authorize(ctx.actor, cmd);
  const s = ctx.s;
  switch (cmd.type) {
    // ================= Employee =================
    case "case.createDraft": {
      const n = (s.counters.case = (s.counters.case ?? 0) + 1);
      const c: QleCase = {
        id: nextId(s, "case"),
        caseNumber: `QLE-2026-0${n}`,
        partnerId: PARTNER_ID,
        employerId: ctx.actor.employerId ?? NEXA.id,
        employeeId: ctx.actor.personId!,
        employeeName: ctx.actor.name,
        background: false,
        eventCode: cmd.eventCode,
        status: "draft",
        version: 1,
        createdAt: now(ctx),
        updatedAt: now(ctx),
        facts: cmd.eventCode === "divorce" ? { direction: undefined, formerSpousePersonId: s.people.find((p) => p.relationship === "spouse")?.id } : {},
        elections: [],
        preferences: {},
        evaluation: null,
        revisions: [],
        receipt: null,
        approvals: [],
        lines: [],
        ownerId: EMPLOYEE_ID,
        backupOwnerId: HR_ID,
        linkedCaseIds: [],
        sensitive: cmd.eventCode === "dependent_death",
        checkResolutions: {},
      };
      s.cases.push(c);
      reevaluate(ctx, c);
      audit(ctx, { caseId: c.id, type: "case.draft_created", summary: `Draft started: ${EVENT_LABEL[cmd.eventCode]}.`, employeeSummary: "Draft saved." });
      metric(ctx, "journey_started", c.id);
      return ok(c, "Draft saved.");
    }
    case "case.updateDraft": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      requireEmployeeOpen(c);
      const before = snapshotHash(c);
      if (cmd.eventCode && cmd.eventCode !== c.eventCode) {
        c.eventCode = cmd.eventCode;
        c.elections = [];
      }
      c.facts = { ...c.facts, ...cmd.facts };
      if (cmd.facts.children) {
        c.elections = c.elections.map((e) => ({ ...e, addPersonIds: e.addPersonIds.filter((id) => !id.startsWith("p_child") || cmd.facts.children!.some((k) => k.personId === id)) }));
      }
      if (c.eventCode === "divorce" && cmd.facts.direction === "lost_outside_coverage") c.elections = [];
      touch(ctx, c);
      reevaluate(ctx, c);
      if (c.status === "needs_information") invalidateApprovalIfMaterial(ctx, c, before);
      return ok(c, "Saved.");
    }
    case "case.setElections": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      requireEmployeeOpen(c);
      const ev = evaluateCase(s, { ...c, elections: [] });
      for (const e of cmd.elections) {
        if (!ev.permittedPlanIds[e.benefit].includes(e.planId)) throw new DomainError(422, "plan_not_permitted", "That plan is not available for this event.", undefined, { [e.benefit]: "Choose one of the listed plans." });
        const bad = [...e.addPersonIds, ...e.removePersonIds].filter((id) => !ev.permittedPersonIds.includes(id));
        if (bad.length) throw new DomainError(422, "person_not_permitted", "That person cannot be changed through this request.", undefined, { [e.benefit]: "Only the listed people can be added or removed." });
      }
      c.elections = cmd.elections;
      c.preferences = { priority: cmd.priority ?? null };
      touch(ctx, c);
      reevaluate(ctx, c);
      return ok(c, "Benefit choices saved.");
    }
    case "case.confirmFact": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      const f = s.evidence.find((e) => e.id === cmd.fileId && e.caseId === c.id);
      if (!f) throw new DomainError(404, "file_not_found", "We could not find that document.");
      const fact = f.proposedFacts[cmd.factIndex];
      if (!fact) throw new DomainError(404, "fact_not_found", "That extracted fact no longer exists.");
      const value = cmd.choice === "document" ? fact.value : cmd.choice === "form" ? (fact.conflictWith?.formValue ?? fact.value) : (cmd.value ?? "").trim();
      if (!value) throw new DomainError(422, "value_required", "Enter the correct value.", undefined, { value: "Enter the correct value." });
      fact.confirmed = { choice: cmd.choice, value, by: ctx.actor.id, at: now(ctx) };
      // A confirmed value never gets silently overwritten; the form takes the confirmed value.
      if (fact.field === "eventDate" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (c.eventCode === "birth" && c.facts.children?.length === 1) c.facts.children[0].dob = value;
        else c.facts.eventDate = value;
      }
      if (fact.field === "coverageEndDate" && /^\d{4}-\d{2}-\d{2}$/.test(value)) c.facts.coverageEndDate = value;
      if (fact.field === "lastWorkday" && /^\d{4}-\d{2}-\d{2}$/.test(value)) c.facts.lastWorkday = value;
      if (f.proposedFacts.every((p) => p.confirmed || !p.conflictWith) && f.status === "needs_confirmation" && f.proposedFacts.filter((p) => ["eventDate", "coverageEndDate", "personName"].includes(p.field)).every((p) => p.confirmed)) {
        f.status = "accepted_for_review";
      }
      aiLog(ctx, { caseId: c.id, kind: "facts_confirmed", label: "Fact confirmed", detail: `${fact.label}: ${value} (${cmd.choice === "document" ? "document value" : cmd.choice === "form" ? "form value" : "entered value"}).`, model: null });
      touch(ctx, c);
      reevaluate(ctx, c);
      return ok(c, "Confirmed.");
    }
    case "case.markEvidencePending": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      c.evidencePendingNote = cmd.note || "Document not available yet.";
      touch(ctx, c);
      reevaluate(ctx, c);
      audit(ctx, { caseId: c.id, type: "evidence.pending", summary: `Employee reports evidence not yet available: ${c.evidencePendingNote}`, employeeSummary: "You told us a document is not available yet." });
      return ok(c, "Saved. You can submit now and add the document later.");
    }
    case "case.submit": {
      const c = ownCase(ctx, cmd.caseId);
      if (c.receipt && c.status !== "draft") return ok(c, `Already received as ${c.caseNumber}.`); // idempotent
      expectVersion(c, cmd.expectedVersion);
      if (c.status !== "draft") throw new DomainError(409, "not_draft", "This request was already submitted.");
      if (!c.elections.length) c.elections = defaultElections(s, c);
      const ev = reevaluate(ctx, c);
      const intake = ev.checks.find((k) => k.id === "intake")!;
      const timing = ev.timing;
      if (timing.status === "future_event") throw new DomainError(422, "future_event", timing.message, "Save a draft and submit after the event happens.");
      const asReview = !!cmd.asReviewRequest || ev.assistedReview;
      if (intake.result !== "passed" && !asReview) {
        throw new DomainError(422, "incomplete", `Some required information is missing: ${ev.missingFacts.join("; ")}.`, "Complete the missing items, or send the request to HR for review.");
      }
      if (asReview && !c.facts.explanation?.trim() && timing.status === "late") {
        throw new DomainError(422, "explanation_required", "Explain what happened so HR can review the timing.", undefined, { explanation: "Add a short explanation." });
      }
      const rev = addRevision(ctx, c, "Submitted by employee", true);
      const receivedAt = now(ctx);
      c.receipt = {
        caseNumber: c.caseNumber,
        receivedAt,
        ingestedAt: ctx.real,
        revisionNo: rev.revisionNo,
        hash: rev.hash,
        timingAtReceipt: timing.status,
        reportedAt: receivedAt,
        enrollmentRequestedAt: asReview && intake.result !== "passed" ? null : receivedAt,
        kind: asReview && intake.result !== "passed" ? "review_request" : "election_request",
      };
      c.status = "submitted";
      c.ownerId = HR_ID;
      c.backupOwnerId = HR_BACKUP;
      touch(ctx, c);
      const urgent = timing.status === "last_day" || timing.status === "late";
      addTask(ctx, {
        caseId: c.id,
        kind: "hr_review",
        title: `Review ${EVENT_LABEL[c.eventCode].toLowerCase()} request`,
        reason: urgent ? "Time-sensitive: timing needs attention." : "New request received.",
        nextAction: "Review the checks and evidence, then request information or approve this version.",
        ownerId: HR_ID,
        backupOwnerId: HR_BACKUP,
        dueAt: urgent ? addBusinessDays(receivedAt, 0) : addBusinessDays(receivedAt, 1),
        blocking: false,
        internalOnly: true,
      });
      for (const k of (c.facts.children ?? []).filter((x) => x.ssnStatus === "pending")) {
        addTask(ctx, {
          caseId: c.id,
          kind: "ssn_follow_up",
          title: `Add ${k.firstName || "your child"}'s Social Security number when it is issued`,
          reason: "The demo carrier procedure permits enrollment now and the SSN later. No value is invented.",
          nextAction: "Employee provides the SSN through the secure profile when issued.",
          ownerId: EMPLOYEE_ID,
          backupOwnerId: HR_ID,
          dueAt: addDays(localDate(receivedAt), 60) + "T21:00:00.000Z",
          blocking: false,
          internalOnly: false,
        });
      }
      if (c.eventCode === "divorce" && (c.facts.direction === "remove_from_nexa" || c.facts.direction === "both") && ev.checks.find((k) => k.id === "spouse_covered")?.result === "passed") openCobraReferral(ctx, c);
      if (c.eventCode === "divorce" && c.facts.direction === "both" && !c.linkedCaseIds.length) {
        // Linked, independent case for the coverage lost under the former spouse's plan.
        const n2 = (s.counters.case = (s.counters.case ?? 0) + 1);
        const linked: QleCase = {
          ...structuredClone(c),
          id: nextId(s, "case"),
          caseNumber: `QLE-2026-0${n2}`,
          eventCode: "loss_of_other_coverage",
          status: "draft",
          version: 1,
          facts: { lossReason: "divorce_separation", lostCoveragePersonIds: [], explanation: `Linked to ${c.caseNumber} (divorce).` },
          elections: [],
          evaluation: null,
          revisions: [],
          receipt: null,
          approvals: [],
          lines: [],
          ownerId: EMPLOYEE_ID,
          backupOwnerId: HR_ID,
          linkedCaseIds: [c.id],
          checkResolutions: {},
          createdAt: now(ctx),
          updatedAt: now(ctx),
        };
        s.cases.push(linked);
        c.linkedCaseIds.push(linked.id);
        reevaluate(ctx, linked);
        audit(ctx, { caseId: c.id, type: "case.linked", summary: `Linked loss-of-coverage draft ${linked.caseNumber} created for the coverage lost under the former spouse's plan.`, employeeSummary: `We started a linked request, ${linked.caseNumber}, for the coverage you lost. Complete it separately; it has its own dates.` });
      }
      const copy =
        c.eventCode === "birth"
          ? `Congratulations on your new arrival. Your request ${c.caseNumber} has been received. We will keep you updated as the coverage change is confirmed.`
          : c.eventCode === "adoption" || c.eventCode === "placement_for_adoption"
            ? "Your request to add your child has been received. We will guide you through the next steps."
            : c.eventCode === "divorce"
              ? `Your request ${c.caseNumber} has been received. We will help update your benefits and keep you informed.`
              : c.eventCode === "loss_of_other_coverage"
                ? `Your request ${c.caseNumber} has been received. We are checking the change and the requested start date.`
                : c.eventCode === "dependent_death"
                  ? "We are sorry for your loss. Your request has been received, and we will help with the benefits update."
                  : `Your request ${c.caseNumber} has been received. HR will review it and keep you informed.`;
      audit(ctx, { caseId: c.id, type: "case.submitted", summary: `Request received (revision ${rev.revisionNo}, ${c.receipt.kind.replace("_", " ")}). Timing at receipt: ${timing.status}.`, employeeSummary: `Request received. Receipt ${c.caseNumber}, revision ${rev.revisionNo}.` });
      metric(ctx, "request_received", c.id);
      notify(ctx, { key: `received:${c.id}`, userId: EMPLOYEE_ID, subject: `${c.caseNumber}: request received`, preview: copy, caseId: c.id, eventType: "request_received" });
      notify(ctx, { key: `received:${c.id}`, userId: HR_ID, subject: `${c.caseNumber}: new ${EVENT_LABEL[c.eventCode].toLowerCase()} request`, preview: `Received ${fmtDateLong(localDate(receivedAt), true)}. Review checks and evidence.`, caseId: c.id, eventType: "request_received" });
      return { ...ok(c, copy), status: c.status };
    }
    case "case.respond": {
      const c = ownCase(ctx, cmd.caseId);
      const t = s.tasks.find((x) => x.id === cmd.taskId && x.caseId === c.id && x.kind === "information_request");
      if (!t) throw new DomainError(404, "task_not_found", "We could not find that request.");
      if (t.status !== "open") return ok(c, "Reply already received.");
      expectVersion(c, cmd.expectedVersion);
      const before = snapshotHash(c);
      if (cmd.facts) c.facts = { ...c.facts, ...cmd.facts };
      const fileIds = s.evidence.filter((e) => e.taskId === t.id).map((e) => e.id);
      t.response = { at: now(ctx), message: cmd.message, fileIds };
      t.status = "done";
      t.resolvedAt = now(ctx);
      t.resolution = "Employee replied.";
      const material = before !== snapshotHash(c);
      addRevision(ctx, c, `Employee reply to: ${t.title}`, material);
      c.status = "under_review";
      c.ownerId = HR_ID;
      if (material) invalidateApprovalIfMaterial(ctx, c, before);
      touch(ctx, c);
      addTask(ctx, { caseId: c.id, kind: "hr_review", title: "Review employee reply", reason: `Reply to: ${t.title}`, nextAction: "Review the reply and any new document.", ownerId: HR_ID, backupOwnerId: HR_BACKUP, dueAt: addBusinessDays(now(ctx), 1), blocking: false, internalOnly: true });
      audit(ctx, { caseId: c.id, type: "case.employee_replied", summary: `Employee replied to "${t.title}"${fileIds.length ? ` with ${fileIds.length} document(s)` : ""}${material ? " (material facts changed — new revision)" : ""}.`, employeeSummary: "Your reply was sent to HR." });
      metric(ctx, "information_responded", c.id);
      notify(ctx, { key: `reply:${t.id}`, userId: HR_ID, subject: `${c.caseNumber}: employee replied`, preview: `Reply to "${t.title}".`, caseId: c.id, eventType: "employee_response" });
      return ok(c, "Reply sent to HR. Your original request and answers are kept.");
    }
    case "case.withdraw": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      if (["declined", "withdrawn"].includes(c.status)) return ok(c, "Already closed.");
      const sent = s.txns.some((t) => t.caseId === c.id && t.delivery !== "queued");
      c.status = "withdrawn";
      c.decision = { kind: "withdrawn", actor: ctx.actor.id, at: now(ctx), reason: cmd.reason, source: "Employee request", reviewRoute: sent ? "Correction required: a change was already sent to the carrier." : "None" };
      touch(ctx, c);
      closeTasks(ctx, (t) => t.caseId === c.id && ["hr_review", "information_request"].includes(t.kind), "Request withdrawn.");
      if (sent) {
        addTask(ctx, { caseId: c.id, kind: "specialist_review", title: "Withdrawal after transmission", reason: "The change was already sent. Do not delete the transmitted action.", nextAction: "Create a correction and check carrier, payroll and notice consequences.", ownerId: HR_ID, backupOwnerId: HR_BACKUP, dueAt: addBusinessDays(now(ctx), 1), blocking: true, internalOnly: true });
      }
      audit(ctx, { caseId: c.id, type: "case.withdrawn", summary: `Withdrawn by employee: ${cmd.reason}`, employeeSummary: "You withdrew this request." });
      notify(ctx, { key: `withdrawn:${c.id}`, userId: HR_ID, subject: `${c.caseNumber}: withdrawn`, preview: sent ? "Withdrawn after transmission — correction review needed." : "Withdrawn before HR decision.", caseId: c.id, eventType: "withdrawn" });
      return ok(c, "Request withdrawn.");
    }
    case "case.urgentSupport": {
      const c = ownCase(ctx, cmd.caseId);
      const t = addTask(ctx, { caseId: c.id, kind: "urgent_support", title: "Urgent care support requested", reason: cmd.message, nextAction: "Contact the employee today with the receipt and known dates. Seek carrier verification. Do not promise claim payment.", ownerId: HR_ID, backupOwnerId: HR_BACKUP, dueAt: new Date(new Date(now(ctx)).getTime() + 4 * 3600_000).toISOString(), blocking: false, internalOnly: false });
      audit(ctx, { caseId: c.id, type: "support.urgent", summary: "Employee requested urgent care support.", employeeSummary: "Urgent support request sent to HR. Keep your receipt handy." });
      notify(ctx, { key: `urgent:${t.id}`, userId: HR_ID, subject: `${c.caseNumber}: urgent support requested`, preview: "Respond within 4 hours.", caseId: c.id, eventType: "urgent_support" });
      return ok(c, "HR has been asked to contact you today.");
    }

    // ================= HR =================
    case "hr.reviewEvidence": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      const f = s.evidence.find((e) => e.id === cmd.fileId && e.caseId === c.id);
      if (!f) throw new DomainError(404, "file_not_found", "Document not found.");
      if (cmd.outcome === "accept") {
        if (f.status === "needs_confirmation" && f.proposedFacts.some((p) => p.conflictWith && !p.confirmed)) throw new DomainError(422, "conflict_open", "A document fact conflicts with the form. Resolve it before accepting.");
        f.status = "accepted_for_review";
        f.reviewedBy = ctx.actor.id;
        f.reviewedAt = now(ctx);
        audit(ctx, { caseId: c.id, type: "evidence.accepted", summary: `HR accepted ${f.fileName} as evidence. Accepting a document does not certify authenticity.`, employeeSummary: "HR reviewed your document." });
      } else {
        f.status = "rejected";
        f.rejectionReason = cmd.reason || "Not the document needed.";
        audit(ctx, { caseId: c.id, type: "evidence.rejected", summary: `HR did not accept ${f.fileName}: ${f.rejectionReason}` });
      }
      touch(ctx, c);
      reevaluate(ctx, c);
      return ok(c, cmd.outcome === "accept" ? "Evidence accepted." : "Document marked not accepted.");
    }
    case "hr.requestInformation": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      if (["approved", "declined", "withdrawn", "draft"].includes(c.status) && !c.lines.some((l) => l.coverageState === "mismatch")) {
        if (c.status === "draft") throw new DomainError(409, "not_submitted", "The employee has not submitted this request yet.");
      }
      const due = zonedToUtc(cmd.dueDate, "23:59");
      const t = addTask(ctx, { caseId: c.id, kind: "information_request", title: cmd.items.length === 1 ? cmd.items[0] : `${cmd.items.length} items requested`, reason: cmd.reason, nextAction: "Reply or upload the requested document.", ownerId: EMPLOYEE_ID, backupOwnerId: HR_ID, dueAt: due, blocking: true, internalOnly: false, items: cmd.items, employeeMessage: cmd.employeeMessage });
      if (!["approved"].includes(c.status)) c.status = "needs_information";
      c.ownerId = EMPLOYEE_ID;
      touch(ctx, c);
      closeTasks(ctx, (x) => x.caseId === c.id && x.kind === "hr_review", "Information requested.");
      audit(ctx, { caseId: c.id, type: "case.information_requested", summary: `HR requested: ${cmd.items.join("; ")}. Reason: ${cmd.reason}. Due ${fmtDateLong(cmd.dueDate, true)}.`, employeeSummary: `HR asked for: ${cmd.items.join("; ")}. Due ${fmtDateLong(cmd.dueDate, true)}.` });
      metric(ctx, "information_requested", c.id);
      notify(ctx, { key: `inforeq:${t.id}`, userId: EMPLOYEE_ID, subject: `${c.caseNumber}: HR needs one more thing`, preview: `${cmd.employeeMessage.slice(0, 140)} Due ${fmtDateLong(cmd.dueDate, true)}.`, caseId: c.id, eventType: "information_requested" });
      return { ...ok(c, "Information requested. Maya will see exactly what is needed and why."), taskIds: [t.id] };
    }
    case "hr.resolveCheck": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      const k = c.evaluation?.checks.find((x) => x.id === cmd.checkId);
      if (!k) throw new DomainError(404, "check_not_found", "Check not found.");
      if (["intake", "divorce_final", "birth_date", "evidence_conflict", "evidence_names"].includes(k.id)) {
        throw new DomainError(422, "not_overridable", "This check needs the missing fact itself. A generic override cannot resolve it.", "Request the information from the employee.");
      }
      c.checkResolutions[k.id] = { actor: ctx.actor.id, at: now(ctx), outcome: cmd.outcome, reason: cmd.reason, source: cmd.source, reviewer: cmd.reviewer };
      touch(ctx, c);
      reevaluate(ctx, c);
      audit(ctx, { caseId: c.id, type: "check.resolved", summary: `Review recorded for "${k.label}": ${cmd.outcome}. Reviewer ${cmd.reviewer}. Reason: ${cmd.reason}. Source: ${cmd.source}.` });
      return ok(c, "Review recorded.");
    }
    case "hr.approve": {
      const c = ownCase(ctx, cmd.caseId);
      const existing = c.approvals.find((a) => a.revisionNo === cmd.revisionNo && !a.supersededAt);
      if (existing && c.status === "approved") return ok(c, "This version is already approved.");
      expectVersion(c, cmd.expectedVersion);
      if (!["submitted", "under_review", "needs_information"].includes(c.status)) throw new DomainError(409, "not_reviewable", "This case is not waiting for a decision.");
      const latest = c.revisions[c.revisions.length - 1];
      if (!latest || latest.revisionNo !== cmd.revisionNo) throw new DomainError(409, "stale_revision", "A newer version exists. Review it before approving.", "Reload the case.");
      const ev = reevaluate(ctx, c);
      const open = blockingOpen(ev);
      if (open.length) throw new DomainError(422, "checks_open", `Approval needs every mandatory check complete: ${open.map((k) => k.label).join(", ")}.`, "Request information, record a review, or send for specialist review.");
      if (!ev.proposedLines.length) throw new DomainError(422, "nothing_to_approve", "There is no coverage change to approve. Record a decision instead.");
      if (s.tasks.some((t) => t.caseId === c.id && t.kind === "information_request" && t.status === "open")) throw new DomainError(422, "info_open", "An information request is still open.");
      // Freeze: the approval binds to this exact revision, its rules and its lines.
      latest.evaluation = structuredClone(ev);
      const approval = { id: nextId(s, "apr"), revisionNo: latest.revisionNo, hash: latest.hash, actor: ctx.actor.id, at: now(ctx), ruleSnapshot: ev.ruleSnapshot, lines: structuredClone(ev.proposedLines) };
      c.approvals.push(approval);
      c.status = "approved";
      c.ownerId = HR_ID;
      touch(ctx, c);
      closeTasks(ctx, (t) => t.caseId === c.id && ["hr_review", "specialist_review"].includes(t.kind), "Approved.");
      approveExecution(ctx, c, approval.id);
      const auto = ctx.actor.id === RULES_ACTOR.id;
      audit(ctx, { caseId: c.id, type: "case.approved", summary: `${auto ? "Approved automatically under Nexa's straight-through policy (every check passed, AI match 100%). " : ""}Approved revision ${latest.revisionNo} (hash ${latest.hash}). Rules: ${ev.ruleSnapshot.map((r) => `${r.id}@${r.version}`).join(", ")}. Approval is not carrier acceptance or coverage.`, employeeSummary: auto ? "Approved automatically: every check passed. Next, the change goes to the insurance provider." : "HR approved your request. Next, the change goes to the insurance provider." });
      metric(ctx, "approved", c.id);
      notify(ctx, { key: `approved:${c.id}:${approval.id}`, userId: EMPLOYEE_ID, subject: `${c.caseNumber}: approved`, preview: auto ? "Every check passed, so your request was approved automatically. We'll confirm the result with the insurance provider." : "HR approved your request. We'll send it to the insurance provider and confirm the result.", caseId: c.id, eventType: "decision" });
      if (auto) notify(ctx, { key: `autoapproved:${c.id}`, userId: HR_ID, subject: `${c.caseNumber}: approved automatically`, preview: "Straight-through: every check passed and the document matched 100%. Open the case to review or correct.", caseId: c.id, eventType: "decision" });
      return ok(c, "Approved. Carrier changes queued; coverage is not confirmed until the carrier record matches.");
    }
    case "hr.decide": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      if (c.status === "approved") throw new DomainError(409, "already_approved", "An approved case needs a versioned correction, not a decline.");
      c.status = "declined";
      c.decision = { kind: "declined", actor: ctx.actor.id, at: now(ctx), reason: cmd.reason, source: cmd.source, reviewRoute: cmd.reviewRoute };
      touch(ctx, c);
      closeTasks(ctx, (t) => t.caseId === c.id && t.status === "open", "Decision recorded.");
      audit(ctx, { caseId: c.id, type: "case.declined", summary: `Declined by ${ctx.actor.name}. Reason: ${cmd.reason}. Source: ${cmd.source}. Review route: ${cmd.reviewRoute}.`, employeeSummary: `HR recorded a decision: ${cmd.reason} You can ask for review: ${cmd.reviewRoute}` });
      notify(ctx, { key: `declined:${c.id}`, userId: EMPLOYEE_ID, subject: `${c.caseNumber}: decision recorded`, preview: "HR recorded a decision on your request. Open it to see the reason and how to ask for review.", caseId: c.id, eventType: "decision" });
      return ok(c, "Decision recorded with reason, source and review route.");
    }
    case "hr.escalate": {
      const c = ownCase(ctx, cmd.caseId);
      expectVersion(c, cmd.expectedVersion);
      c.specialistReview = { reason: cmd.reason, at: now(ctx), actor: ctx.actor.id };
      if (c.status === "submitted") c.status = "under_review";
      touch(ctx, c);
      addTask(ctx, { caseId: c.id, kind: "specialist_review", title: "Specialist review", reason: cmd.reason, nextAction: "Record the specialist's reviewed outcome on the relevant check.", ownerId: "u_specialist", backupOwnerId: HR_ID, dueAt: addBusinessDays(now(ctx), 2), blocking: true, internalOnly: true });
      audit(ctx, { caseId: c.id, type: "case.escalated", summary: `Sent for specialist review: ${cmd.reason}`, employeeSummary: "Your request is with a benefits specialist for review." });
      return ok(c, "Sent for specialist review.");
    }
    case "hr.addNote": {
      const c = ownCase(ctx, cmd.caseId);
      audit(ctx, { caseId: c.id, type: "note.internal", summary: `Internal note: ${cmd.note}` });
      return ok(c, "Internal note added. Employees never see internal notes.");
    }
    case "hr.sendCorrection":
    case "hr.assignBroker": {
      const c = ownCase(ctx, cmd.caseId);
      const line = c.lines.find((l) => l.id === cmd.lineId);
      if (!line) throw new DomainError(404, "line_not_found", "Line not found.");
      const txn = s.txns.find((t) => t.id === line.currentTxnId);
      const failed = line.coverageState === "mismatch" || txn?.memberResult === "rejected" || txn?.delivery === "file_rejected" || (txn?.delivery === "receipt_unknown" && s.batches.find((b) => b.id === txn.batchId)?.transport === "not_received");
      if (!failed) throw new DomainError(422, "line_not_failed", "Only a failed or mismatched line can be corrected. Successful lines are never resent.");
      if (txn?.delivery === "receipt_unknown" && s.batches.find((b) => b.id === txn.batchId)?.transport !== "not_received") throw new DomainError(422, "investigate_first", "Delivery is unknown. Record the status inquiry before any resend.");
      if (cmd.type === "hr.sendCorrection") {
        const nt = queueTxn(ctx, c, line, txn?.id ?? null);
        audit(ctx, { caseId: c.id, type: "carrier.correction_queued", summary: `Versioned correction ${nt.id} queued for ${personName(s, line.personId, c)} (${line.benefit}) only, linked to ${txn?.id}. Approved intent and original receipt unchanged.`, employeeSummary: "We sent a correction to the insurance provider. No action is needed from you right now." });
        return { ...ok(c, "Correction queued for this line only."), entityId: nt.id };
      }
      const nt = queueTxn(ctx, c, line, txn?.id ?? null);
      nt.route = "manual";
      nt.delivery = "queued";
      const who = personName(s, line.personId, c);
      addTask(ctx, {
        caseId: c.id,
        kind: "broker_correction",
        title: `Carrier correction: ${who}, ${line.benefit}`,
        reason: line.mismatch?.message ?? txn?.memberReason ?? "Carrier correction needed.",
        nextAction: "Submit through the carrier portal, record the reference, then record the verified carrier result.",
        ownerId: "u_priya",
        backupOwnerId: HR_ID,
        dueAt: addBusinessDays(now(ctx), 2),
        blocking: true,
        internalOnly: true,
        lineId: line.id,
        txnId: nt.id,
        broker: {
          packet: [
            { label: "Group", value: nt.order.groupNumber },
            { label: "Subscriber ID", value: nt.order.subscriberId },
            { label: "Member", value: who },
            { label: "Relationship", value: nt.order.relationship },
            { label: "Action", value: line.action === "add" ? "Add member" : line.action === "terminate" ? "End coverage" : "Change coverage level" },
            { label: "Plan", value: line.planId },
            { label: "Coverage level", value: line.tierAfter },
            { label: line.action === "terminate" ? "End date" : "Start date", value: (line.action === "terminate" ? line.endDate : line.startDate) ?? "" },
            { label: "Operation key", value: nt.order.operationKey },
          ],
          checklist: ["Sign in to the carrier portal with your own credentials (not automated)", "Enter only the fields above", "Record the portal submission reference", "Record the carrier's verified result with its source"],
        },
      });
      audit(ctx, { caseId: c.id, type: "broker.assigned", summary: `Assigned to Priya Patel via the manual route for ${who} (${line.benefit}).` });
      notify(ctx, { key: `broker:${nt.id}`, userId: "u_priya", subject: `${c.caseNumber}: carrier correction assigned`, preview: "One member correction. Open the task for the minimum packet.", caseId: null, eventType: "broker_task", link: "/broker/tasks" });
      return ok(c, "Assigned to Priya Patel.");
    }
    case "hr.recordDeliveryInquiry": {
      const b = s.batches.find((x) => x.id === cmd.batchId);
      if (!b) throw new DomainError(404, "batch_not_found", "Batch not found.");
      if (b.transport !== "unknown") throw new DomainError(409, "not_unknown", "This batch does not have an unknown delivery outcome.");
      b.transport = cmd.outcome === "received" ? "received" : "not_received";
      b.attempts.push({ id: nextId(s, "att"), at: now(ctx), outcome: `Status inquiry (${cmd.reference}): carrier ${cmd.outcome === "received" ? "confirms it received the file" : "did not receive the file"}` });
      for (const tid of b.txnIds) {
        const t = s.txns.find((x) => x.id === tid)!;
        if (cmd.outcome === "received") t.delivery = "sent";
        else if (!t.superseded) {
          // Same operation key, new attempt: requeue for the next batch.
          t.delivery = "queued";
          t.batchId = null;
        }
      }
      closeTasks(ctx, (t) => t.kind === "delivery_investigation" && t.title.includes(b.id), `Inquiry ${cmd.reference}: ${cmd.outcome}.`);
      audit(ctx, { caseId: s.txns.find((t) => t.id === b.txnIds[0])?.caseId ?? null, type: "carrier.inquiry", summary: `Status inquiry ${cmd.reference} for ${b.id}: ${cmd.outcome === "received" ? "received — no resend" : "not received — requeued with the same operation keys"}.` });
      return { ok: true, message: cmd.outcome === "received" ? "Recorded. The carrier has the file; nothing is resent." : "Recorded. The same changes will go in the next batch with the same operation keys." };
    }
    case "hr.authorizePayroll": {
      const inst = s.instructions.find((i) => i.id === cmd.instructionId);
      if (!inst) throw new DomainError(404, "instruction_not_found", "Instruction not found.");
      if (inst.state !== "approval_needed") return { ok: true, message: "Already authorized." };
      const changed = recalcBeforeAuthorize(ctx, inst);
      inst.authorizedBy = ctx.actor.id;
      inst.authorizedAt = now(ctx);
      inst.state = "scheduled";
      closeTasks(ctx, (t) => t.instructionId === inst.id && t.kind === "payroll_authorization", "Authorized.");
      const c = findCase(s, inst.caseId);
      audit(ctx, { caseId: c.id, type: "payroll.authorized", summary: `Payroll adjustment authorized: ${fmtMoney(inst.adjustmentCents, "USD", { sign: true })} for ${inst.benefit}${changed ? " (recalculated from the posted ledger)" : ""}.`, employeeSummary: null });
      notifyPayScheduled(ctx, c, inst);
      refreshCompletion(ctx, c);
      return { ok: true, message: `Authorized ${fmtMoney(inst.adjustmentCents, "USD", { sign: true })}${changed ? " after recalculating from posted payroll" : ""}.` };
    }
    case "hr.requestPayrollCorrection": {
      const inst = s.instructions.find((i) => i.id === cmd.instructionId);
      if (!inst || inst.state !== "mismatch") throw new DomainError(422, "not_mismatch", "Only a mismatched payroll result can be corrected.");
      const c = findCase(s, inst.caseId);
      const expected = inst.newRecurringCents + inst.adjustmentCents;
      const posted = (inst.postedCents ?? 0) + (inst.postedAdjustmentCents ?? 0);
      const run = s.payRuns.filter((r) => r.status === "scheduled" && r.cutoffAt > now(ctx)).sort((a, b) => a.payday.localeCompare(b.payday))[0];
      if (!run) throw new DomainError(422, "no_run", "No open pay run.");
      const corr = {
        ...inst,
        id: nextId(s, "pi"),
        state: "scheduled" as const,
        targetRunId: run.id,
        previousRecurringCents: inst.newRecurringCents,
        adjustmentCents: expected - posted,
        adjustmentBasis: `Correction of ${inst.id}: expected ${fmtMoney(expected)}, posted ${fmtMoney(posted)}.`,
        calcLines: [],
        createdAt: now(ctx),
        operationKey: `${inst.operationKey}:corr:${run.id}`,
        correctionOf: inst.id,
        postedCents: undefined,
        postedAdjustmentCents: undefined,
        acceptedAt: undefined,
        authorizedBy: ctx.actor.id,
        authorizedAt: now(ctx),
      };
      if (s.instructions.some((i) => i.operationKey === corr.operationKey)) return { ok: true, message: "Correction already scheduled." };
      inst.state = "verified_no_change";
      inst.adjustmentBasis += ` Superseded by correction ${corr.id}.`;
      s.instructions.push(corr);
      closeTasks(ctx, (t) => t.instructionId === inst.id && t.kind === "payroll_mismatch", `Correction ${corr.id} scheduled.`);
      audit(ctx, { caseId: c.id, type: "payroll.correction", summary: `Payroll correction ${corr.id} scheduled for ${fmtDateLong(run.payday, true)}: ${fmtMoney(corr.adjustmentCents, "USD", { sign: true })}. Posted payslip unchanged.`, employeeSummary: `A payroll correction is scheduled for your ${fmtDateLong(run.payday, true)} paycheck.` });
      refreshCompletion(ctx, c);
      return { ok: true, message: "Correction scheduled on the next permitted run." };
    }
    case "hr.sendCobraReferral": {
      const r = s.cobra.find((x) => x.id === cmd.referralId);
      if (!r) throw new DomainError(404, "referral_not_found", "Referral not found.");
      if (["sent", "received", "notice_tracked"].includes(r.state)) return { ok: true, message: "Referral already sent." };
      const c = findCase(s, r.caseId);
      if (c.status !== "approved") throw new DomainError(422, "not_confirmed", "Confirm the event first: approve the removal, then send the referral. The task stays open and owned.");
      r.contactRoute = cmd.contactRoute;
      r.state = "sent";
      r.sentAt = now(ctx);
      r.history.push({ at: now(ctx), actor: ctx.actor.id, state: "sent", note: "Minimal referral sent to the administrator (simulated secure channel)." });
      closeTasks(ctx, (t) => t.referralId === r.id && t.kind === "cobra_referral", "Referral sent.");
      addTask(ctx, { caseId: c.id, kind: "cobra_silence", title: "Waiting for administrator receipt", reason: "Sending is not completion. The administrator must acknowledge the referral.", nextAction: "If no receipt within 2 business days, escalate to the backup and the administrator.", ownerId: HR_ID, backupOwnerId: HR_BACKUP, dueAt: addBusinessDays(now(ctx), 2), blocking: true, internalOnly: true, referralId: r.id });
      audit(ctx, { caseId: c.id, type: "cobra.sent", summary: `COBRA referral sent for ${r.beneficiaryName}: event ${r.qualifyingEvent} ${r.eventDate}, coverage loss ${r.coverageLossDate}, ${r.plans.length} plans, contact route ${cmd.contactRoute.replaceAll("_", " ")}.`, employeeSummary: "Continuation information referred to the administrator." });
      notify(ctx, { key: `cobra_sent:${r.id}`, userId: "u_cobra", subject: `New referral ${c.caseNumber}`, preview: "One continuation referral. Acknowledge receipt.", caseId: null, eventType: "cobra_referral", link: "/demo/integrations?tab=cobra" });
      return { ok: true, message: "Referral sent. It is not complete until the administrator acknowledges it." };
    }
    case "hr.resolveTask": {
      const t = s.tasks.find((x) => x.id === cmd.taskId);
      if (!t) throw new DomainError(404, "task_not_found", "Task not found.");
      const allowed = ["contact_verification", "urgent_support", "alternate_contact", "specialist_review", "evidence_follow_up", "carrier_silence"];
      if (!allowed.includes(t.kind)) throw new DomainError(422, "not_manual", "This task closes automatically when its underlying record is resolved.");
      t.status = "done";
      t.resolvedAt = now(ctx);
      t.resolution = cmd.resolution;
      audit(ctx, { caseId: t.caseId, type: "task.resolved", summary: `${t.title}: ${cmd.resolution}` });
      const c = s.cases.find((x) => x.id === t.caseId);
      if (c) refreshCompletion(ctx, c);
      return { ok: true, message: "Task resolved." };
    }

    // ================= Broker =================
    case "broker.recordSubmission":
    case "broker.recordResult": {
      const t = s.tasks.find((x) => x.id === cmd.taskId && x.ownerId === ctx.actor.id && x.kind === "broker_correction");
      if (!t || !t.broker) throw new DomainError(404, "task_not_found", "We could not find that assigned task.");
      const txn = s.txns.find((x) => x.id === t.txnId)!;
      const c = findCase(s, t.caseId);
      if (cmd.type === "broker.recordSubmission") {
        t.broker.submissionRef = cmd.reference;
        t.broker.submittedAt = now(ctx);
        txn.delivery = "sent";
        txn.sentAt = now(ctx);
        txn.attempts.push({ id: nextId(s, "att"), at: now(ctx), outcome: `Portal submission recorded by broker: ${cmd.reference}` });
        audit(ctx, { caseId: c.id, type: "broker.submitted", summary: `Priya recorded portal submission ${cmd.reference}. Submitted is not verified coverage.` });
        return { ok: true, message: "Submission recorded. Coverage stays unconfirmed until you record the verified carrier result." };
      }
      if (!t.broker.submissionRef) throw new DomainError(422, "submit_first", "Record the portal submission reference first.");
      t.broker.result = { sourceRef: cmd.sourceRef, verifier: cmd.verifier, at: now(ctx), startDate: cmd.startDate, endDate: cmd.endDate, tier: cmd.tier, planId: cmd.planId };
      txn.memberResult = "accepted";
      ingestObservation(ctx, { eventId: `broker:${t.id}:${cmd.sourceRef}`, txnId: txn.id, planId: cmd.planId, tier: cmd.tier, startDate: cmd.startDate, endDate: cmd.endDate, sourceRef: `Broker-verified: ${cmd.sourceRef} (verifier ${cmd.verifier})` });
      return { ok: true, message: "Carrier result recorded and reconciled." };
    }

    // ================= External simulators =================
    case "ops.runBatch": {
      const b = runBatch(ctx);
      return { ok: true, entityId: b?.id, message: `Batch ${b?.id} sent with ${b?.recordCount} record(s).` };
    }
    case "ops.batchTransport": {
      const b = s.batches.find((x) => x.id === cmd.batchId);
      if (!b) throw new DomainError(404, "batch_not_found", "Batch not found.");
      if (b.transport === "received") return { ok: true, message: "Transport already acknowledged." };
      if (b.transport === "unknown" && cmd.outcome === "received") throw new DomainError(422, "inquiry_required", "Delivery is unknown. HR records a status inquiry first.");
      b.transport = cmd.outcome;
      for (const tid of b.txnIds) {
        const t = s.txns.find((x) => x.id === tid)!;
        // Only a real transport receipt acknowledges delivery; a timeout makes it unknown.
        if (t.delivery === "sent") t.delivery = cmd.outcome === "received" ? "acknowledged" : "receipt_unknown";
      }
      if (cmd.outcome === "unknown") {
        addTask(ctx, { caseId: s.txns.find((t) => t.id === b.txnIds[0])!.caseId, kind: "delivery_investigation", title: `Transport outcome unknown for ${b.id}`, reason: "The carrier transfer timed out. We do not know whether the file arrived.", nextAction: "Run a status inquiry with the carrier before any resend or route switch.", ownerId: HR_ID, backupOwnerId: "u_partner_ops", dueAt: addBusinessDays(now(ctx), 1), blocking: true, internalOnly: true });
      }
      audit(ctx, { caseId: s.txns.find((t) => t.id === b.txnIds[0])?.caseId ?? null, type: "carrier.transport_ack", summary: cmd.outcome === "received" ? `Transport receipt for ${b.id}. A transport receipt is not a coverage result.` : `Transport for ${b.id} timed out; outcome unknown. Status inquiry required before any resend.` });
      return { ok: true, message: "Transport receipt recorded. Coverage is not confirmed." };
    }
    case "ops.batchValidation": {
      const b = s.batches.find((x) => x.id === cmd.batchId);
      if (!b) throw new DomainError(404, "batch_not_found", "Batch not found.");
      if (b.transport !== "received") throw new DomainError(422, "transport_first", "Acknowledge transport before validating the file.");
      b.fileValidation = cmd.outcome;
      b.fileReason = cmd.reason;
      if (cmd.outcome === "rejected") {
        for (const tid of b.txnIds) {
          const t = s.txns.find((x) => x.id === tid)!;
          t.delivery = "file_rejected";
          t.memberReason = `Whole file rejected: ${cmd.reason ?? "no reason given"}`;
        }
        const cases = [...new Set(b.txnIds.map((id) => s.txns.find((t) => t.id === id)!.caseId))];
        for (const cid of cases) {
          addTask(ctx, { caseId: cid, kind: "record_rejected", title: `Whole file ${b.id} rejected`, reason: cmd.reason ?? "File rejected.", nextAction: "Fix the shared cause and resend the affected records in a new versioned batch.", ownerId: HR_ID, backupOwnerId: "u_partner_ops", dueAt: addBusinessDays(now(ctx), 1), blocking: true, internalOnly: true });
          for (const l of findCase(s, cid).lines.filter((l) => b.txnIds.includes(l.currentTxnId ?? ""))) l.mismatch = { field: "file", expected: "accepted", observed: "rejected", message: `The carrier rejected the whole file: ${cmd.reason ?? ""}` };
        }
      }
      audit(ctx, { caseId: s.txns.find((t) => t.id === b.txnIds[0])?.caseId ?? null, type: "carrier.file_validation", summary: `File validation for ${b.id}: ${cmd.outcome}${cmd.reason ? ` — ${cmd.reason}` : ""}. A 999-style acknowledgment is not active coverage.` });
      return { ok: true, message: cmd.outcome === "accepted" ? "File accepted. Member records still need their own result." : "File rejected. Every record in it needs a resend." };
    }
    case "ops.memberResult": {
      const t = s.txns.find((x) => x.id === cmd.txnId);
      if (!t) throw new DomainError(404, "txn_not_found", "Transaction not found.");
      if (t.route === "edi_834") {
        const b = s.batches.find((x) => x.id === t.batchId);
        if (!b || b.fileValidation !== "accepted") throw new DomainError(422, "file_first", "Accept the file validation before processing member records.");
      }
      if (t.memberResult !== "pending" && t.memberResult !== "info_requested") return { ok: true, message: "Member result already recorded." };
      t.memberResult = cmd.outcome;
      t.memberReason = cmd.reason;
      if (cmd.outcome === "rejected") {
        t.delivery = "record_rejected";
        onRecordRejected(ctx, t);
      } else if (cmd.outcome === "info_requested") {
        addTask(ctx, { caseId: t.caseId, kind: "record_rejected", title: `Carrier requests information: ${t.order.memberName}`, reason: cmd.reason ?? "Carrier asked for information.", nextAction: "Decide whether the employee must provide anything. Ask only for what is missing.", ownerId: HR_ID, backupOwnerId: "u_priya", dueAt: addBusinessDays(now(ctx), 1), blocking: true, internalOnly: true, txnId: t.id, lineId: t.lineId });
      } else {
        audit(ctx, { caseId: t.caseId, type: "carrier.member_accepted", summary: `Carrier accepted the member record for processing: ${t.order.memberName} (${t.order.benefit}). Acceptance is not a coverage record.` });
      }
      return { ok: true, message: `Member result recorded: ${cmd.outcome.replace("_", " ")}.` };
    }
    case "ops.publishObservation": {
      const obs = ingestObservation(ctx, { eventId: cmd.eventId, txnId: cmd.txnId, planId: cmd.planId, tier: cmd.tier, startDate: cmd.startDate, endDate: cmd.endDate, sourceRef: cmd.sourceRef });
      return { ok: true, entityId: obs.id, message: obs.outcome === "matched" ? "Published. Reconciliation matched." : obs.outcome === "mismatch" ? "Published. Reconciliation found a mismatch." : "Published. Stale response kept in history only." };
    }
    case "ops.publishAccepted": {
      const b = s.batches.find((x) => x.id === cmd.batchId);
      const txns = b ? b.txnIds.map((id) => s.txns.find((t) => t.id === id)!) : s.txns.filter((t) => t.route === "api" && t.id === cmd.batchId);
      if (!txns.length) throw new DomainError(404, "batch_not_found", "Batch not found.");
      if (b && b.fileValidation !== "accepted") throw new DomainError(422, "file_first", "Accept the file validation first.");
      let published = 0;
      let rejected = false;
      const wrongDate = s.preset === "carrier_wrong_start_date";
      const rejectOne = s.preset === "carrier_reject_one_record";
      const children = txns.filter((t) => t.order.action === "add" && t.order.relationship === "child");
      for (const t of txns) {
        if (t.superseded || t.delivery === "record_rejected") continue;
        if (t.memberResult === "pending") {
          if (rejectOne && !rejected && children.length && t.id === children[children.length - 1].id) {
            t.memberResult = "rejected";
            t.memberReason = "Carrier eligibility system rejected this member (simulated preset): identity not found in the carrier file.";
            t.delivery = "record_rejected";
            onRecordRejected(ctx, t);
            rejected = true;
            continue;
          }
          t.memberResult = "accepted";
        }
        if (t.memberResult !== "accepted") continue;
        if (s.observations.some((o) => o.txnId === t.id)) continue;
        // Preset: the carrier applies next-month coverage instead of the requested date.
        const start = wrongDate && t.order.action === "add" && t.order.startDate ? firstOfNextMonth(t.order.startDate) : t.order.startDate;
        ingestObservation(ctx, { eventId: `pub:${t.id}`, txnId: t.id, planId: t.order.planId, tier: t.order.tier, startDate: t.order.action === "terminate" ? null : start, endDate: t.order.action === "terminate" ? t.order.endDate : null, sourceRef: `${b ? `834 result for ${b.id}` : `API status ${t.apiReference}`} (simulated carrier)` });
        published += 1;
      }
      if (wrongDate || rejectOne) s.preset = "none";
      return { ok: true, message: `Published ${published} coverage observation(s) from the carrier's processed records.` };
    }
    case "ops.payrollInstruction": {
      const inst = s.instructions.find((i) => i.id === cmd.instructionId);
      if (!inst) throw new DomainError(404, "instruction_not_found", "Instruction not found.");
      if (inst.state !== "scheduled") throw new DomainError(422, "not_scheduled", inst.state === "approval_needed" ? "HR must authorize this adjustment first." : "Only a scheduled instruction can be applied.");
      const setup = s.payrollSetup.find((p) => p.benefit === inst.benefit)!;
      if (cmd.outcome === "reject") {
        inst.state = "blocked";
        inst.rejectedReason = cmd.reason || "Rejected by payroll.";
        addTask(ctx, { caseId: inst.caseId, kind: "payroll_mismatch", title: `Payroll rejected the ${inst.benefit} instruction`, reason: inst.rejectedReason, nextAction: "Review the rejection and request a correction.", ownerId: HR_ID, backupOwnerId: HR_BACKUP, dueAt: addBusinessDays(now(ctx), 1), blocking: true, internalOnly: true, instructionId: inst.id });
        inst.state = "mismatch";
        audit(ctx, { caseId: inst.caseId, type: "payroll.instruction_rejected", summary: `Payroll simulator rejected ${inst.id}: ${inst.rejectedReason}. Coverage confirmation is unaffected.` });
        return { ok: true, message: "Instruction rejected. HR has a task." };
      }
      if (inst.newRecurringCents !== inst.previousRecurringCents || inst.correctionOf === undefined) {
        if (inst.newRecurringCents !== setup.recurringCents) setup.pending = { fromRunId: inst.targetRunId, recurringCents: inst.newRecurringCents, instructionId: inst.id };
      }
      if (inst.adjustmentCents !== 0) setup.oneTime.push({ runId: inst.targetRunId, amountCents: inst.adjustmentCents, instructionId: inst.id });
      inst.state = "instruction_accepted";
      inst.acceptedAt = now(ctx);
      audit(ctx, { caseId: inst.caseId, type: "payroll.instruction_accepted", summary: `Payroll simulator accepted ${inst.id}. Accepted is not posted.` });
      return { ok: true, message: "Instruction accepted. It posts when the target run posts." };
    }
    case "ops.payrollPost": {
      const run = s.payRuns.find((r) => r.id === cmd.runId);
      const at = run ? zonedToUtc(run.payday, "09:00") : null;
      if (run && at && run.status === "scheduled" && s.clock.businessNow < at) {
        // A run posts on its payday: move the business clock there first, running any
        // batches, earlier pay runs and reminders that fall due on the way.
        const justBefore = new Date(new Date(at).getTime() - 60_000).toISOString();
        const jobs = runDueJobs(ctx, s.clock.businessNow, justBefore);
        s.clock.businessNow = justBefore;
        postRun(ctx, cmd.runId, cmd.override);
        s.clock.businessNow = at;
        audit(ctx, { caseId: null, type: "demo.clock", summary: `Demo clock moved to the ${fmtDateLong(run.payday, true)} payday to post the run. ${jobs.length ? `Jobs on the way: ${jobs.join(" ")}` : ""}` });
        return { ok: true, message: `Clock moved to ${fmtDateLong(run.payday, true)} and the pay run posted.${jobs.length ? ` Also ran: ${jobs.join(" ")}` : ""}` };
      }
      postRun(ctx, cmd.runId, cmd.override);
      return { ok: true, message: "Pay run posted." };
    }
    case "ops.cobra": {
      const r = s.cobra.find((x) => x.id === cmd.referralId);
      if (!r) throw new DomainError(404, "referral_not_found", "Referral not found.");
      if (r.state === "review_needed" || r.state === "referral_ready") throw new DomainError(422, "not_sent", "This referral has not been sent yet.");
      const c = findCase(s, r.caseId);
      if (cmd.action === "acknowledge") {
        if (r.state === "received" || r.state === "notice_tracked") return { ok: true, message: "Already acknowledged." };
        r.state = "received";
        r.receivedAt = now(ctx);
        r.history.push({ at: now(ctx), actor: ctx.actor.id, state: "received", note: "Administrator acknowledged receipt." });
        closeTasks(ctx, (t) => t.referralId === r.id && ["cobra_silence", "cobra_referral"].includes(t.kind), "Administrator acknowledged receipt.");
        audit(ctx, { caseId: c.id, type: "cobra.received", summary: "COBRA administrator acknowledged the referral. Receipt is not a notice, an election or a payment.", employeeSummary: "The administrator confirmed it received the continuation referral." });
        metric(ctx, "handoff_acknowledged", c.id);
        notify(ctx, { key: `cobra_rcv:${r.id}`, userId: HR_ID, subject: `${c.caseNumber}: referral acknowledged`, preview: "The continuation workflow stays open with the administrator.", caseId: c.id, eventType: "handoff" });
      } else if (cmd.action === "request_info") {
        r.state = "exception";
        r.infoRequested = cmd.note || "Administrator needs more information.";
        r.history.push({ at: now(ctx), actor: ctx.actor.id, state: "exception", note: r.infoRequested });
        addTask(ctx, { caseId: c.id, kind: "cobra_referral", title: "Administrator needs referral information", reason: r.infoRequested, nextAction: "Provide the missing referral field and resend.", ownerId: HR_ID, backupOwnerId: HR_BACKUP, dueAt: addBusinessDays(now(ctx), 1), blocking: true, internalOnly: true, referralId: r.id });
        r.state = "referral_ready";
      } else {
        if (!["received", "notice_tracked"].includes(r.state)) throw new DomainError(422, "receive_first", "Acknowledge receipt before recording notice status.");
        r.state = "notice_tracked";
        r.noticeRef = cmd.note || `NTC-${r.id.toUpperCase()}`;
        r.noticeStatus = "Election notice issued by the administrator (simulated). Beneficiary election and payment are tracked by the administrator.";
        r.history.push({ at: now(ctx), actor: ctx.actor.id, state: "notice_tracked", note: `Notice reference ${r.noticeRef}.` });
        audit(ctx, { caseId: c.id, type: "cobra.notice", summary: `Administrator recorded notice ${r.noticeRef}. Election and payment remain with the administrator.`, employeeSummary: null });
      }
      refreshCompletion(ctx, c);
      return { ok: true, message: "Continuation handoff updated." };
    }
    case "ops.clock": {
      const res = advanceClock(ctx, cmd.advance);
      return { ok: true, message: res };
    }
    case "ops.preset": {
      s.preset = cmd.preset;
      audit(ctx, { caseId: null, type: "demo.preset", summary: `Failure preset set: ${cmd.preset}. It changes how the next simulated response behaves; it never completes a case.` });
      return { ok: true, message: cmd.preset === "none" ? "Presets cleared." : "Preset armed for the next matching simulated response." };
    }
    case "ops.bounce": {
      const n = s.outbox.find((x) => x.id === cmd.notificationId);
      if (!n) throw new DomainError(404, "notification_not_found", "Message not found.");
      if (n.deliveryState === "simulated_bounced") return { ok: true, message: "Already bounced." };
      n.deliveryState = "simulated_bounced";
      if (n.caseId) {
        addTask(ctx, { caseId: n.caseId, kind: "alternate_contact", title: "Message bounced: use an alternate contact", reason: `Simulated bounce for ${n.recipientRole} message "${n.subject}".`, nextAction: "Reach the recipient through another verified channel. Do not include sensitive details.", ownerId: HR_ID, backupOwnerId: HR_BACKUP, dueAt: addBusinessDays(now(ctx), 1), blocking: false, internalOnly: true });
      }
      audit(ctx, { caseId: n.caseId, type: "notification.bounced", summary: `Simulated bounce: ${n.subject}` });
      return { ok: true, message: "Bounce simulated. An alternate-contact task was created." };
    }
    case "ops.autopilot": {
      s.autopilot = cmd.on;
      audit(ctx, { caseId: null, type: "demo.autopilot", summary: cmd.on ? "Autopilot on: clean cases are approved by policy; simulated carrier, payroll and COBRA respond at once." : "Autopilot off: every step waits for a person or a simulator click." });
      return { ok: true, message: cmd.on ? "Autopilot on. Clean cases run straight through; problems still stop for a person." : "Autopilot off. Every step is manual." };
    }
    case "ops.rateChange": {
      // A published rule or rate change flags affected cases for review. It never
      // rewrites an approved decision; the frozen approval keeps its rule snapshot.
      const affected = s.cases.filter((c) => !c.background && !c.completedAt && ["submitted", "under_review", "needs_information", "approved"].includes(c.status));
      for (const c of affected) {
        addTask(ctx, {
          caseId: c.id,
          kind: "specialist_review",
          title: "Rule or rate version changed",
          reason: `New configuration published: ${cmd.note}. This case was evaluated under ${c.evaluation?.ruleSnapshot.map((r) => `${r.id}@${r.version}`).join(", ") ?? "earlier rules"}.`,
          nextAction: c.status === "approved" ? "Review the impact. The approved decision stays as approved unless a new version is reapproved." : "Recalculate and review before approving.",
          ownerId: HR_ID,
          backupOwnerId: HR_BACKUP,
          dueAt: addBusinessDays(now(ctx), 1),
          blocking: c.status !== "approved",
          internalOnly: true,
        });
        audit(ctx, { caseId: c.id, type: "config.changed", summary: `Configuration change flagged for review: ${cmd.note}. Approved decisions are not silently rewritten.` });
      }
      audit(ctx, { caseId: null, type: "config.published", summary: `Simulated rule/rate publication: ${cmd.note}. ${affected.length} open case(s) flagged for review.` });
      return { ok: true, message: `${affected.length} open case(s) flagged for review. Approved decisions keep their frozen rule snapshot.` };
    }
    case "ops.reset":
      throw new DomainError(400, "reset_handled_by_store", "Reset is handled by the store.");
  }
}

function ok(c: QleCase, message: string): CommandResult {
  return { ok: true, entityId: c.id, version: c.version, status: c.status, message };
}

export { executionSummary, afterLineConfirmed, today, localDate };
export type { ScenarioState };
