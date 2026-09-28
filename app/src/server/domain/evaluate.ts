import type {
  Benefit,
  CostLine,
  Election,
  ElectionChoice,
  EventCode,
  EventFacts,
  Evaluation,
  Person,
  ProposedLine,
  QleCase,
  RuleCheck,
  ScenarioState,
  Tier,
  TimingResult,
} from "@/lib/contracts/domain";
import { BENEFITS } from "@/lib/contracts/domain";
import { addDays, diffDays, firstOfNextMonth, fmtDateLong, isValidDate, lastOfMonth, localDate } from "@/lib/dates";
import { employeeCost, plansFor, RATE_VERSION } from "@/server/config/plans";
import { DEEP_EVENTS, RULE_BY_ID, ruleRef } from "@/server/config/rules";
import { forecastFor } from "./payroll";
import { LOSS_WAIVER_CONTEXT } from "./seed";

// Deterministic rule evaluation. Code decides dates, eligibility routing and money;
// AI never changes these results.

export const ADDITION_EVENTS: EventCode[] = ["birth", "adoption", "placement_for_adoption"];

export function electionOn(s: ScenarioState, benefit: Benefit, date: string): Election | undefined {
  const list = s.elections.filter((e) => e.benefit === benefit);
  return (
    list.find((e) => e.effectiveFrom <= date && (e.effectiveTo === null || e.effectiveTo >= date)) ??
    list.filter((e) => e.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
  );
}

export function tierFor(covered: string[], people: Person[]): Tier {
  const rels = covered.map((id) => people.find((p) => p.id === id)?.relationship);
  const spouse = rels.includes("spouse");
  const child = rels.includes("child");
  if (spouse && child) return "FAM";
  if (spouse) return "ES";
  if (child) return "EC";
  return "EE";
}

export function personName(s: ScenarioState, id: string, c?: QleCase): string {
  const p = s.people.find((x) => x.id === id);
  if (p) return `${p.firstName} ${p.lastName}`.trim();
  const ch = (c ? [c] : s.cases).flatMap((x) => x.facts.children ?? []).find((x) => x.personId === id);
  if (ch) return `${ch.firstName || "New child"} ${ch.lastName}`.trim();
  return "Unknown person";
}

/** The date the event happened, for timing. For loss, the date coverage is lost. */
export function eventDateFor(code: EventCode, f: EventFacts): string | null {
  if (ADDITION_EVENTS.includes(code)) {
    const dobs = (f.children ?? []).map((c) => c.dob).filter(isValidDate).sort();
    if (code === "birth" && dobs.length) return dobs[0];
    return isValidDate(f.eventDate) ? f.eventDate : (dobs[0] ?? null);
  }
  if (code === "loss_of_other_coverage" || code === "medicaid_chip_loss") {
    return isValidDate(f.coverageEndDate) ? f.coverageEndDate : null;
  }
  return isValidDate(f.eventDate) ? f.eventDate : null;
}

export function timingFor(code: EventCode, f: EventFacts, asOf: string): TimingResult {
  const sixty = code === "medicaid_chip_loss" || code === "premium_assistance";
  const reporting = code === "divorce" || code === "legal_separation";
  const ruleId = sixty ? "R-SE-60" : reporting ? "R-DIV-END" : "R-SE-30";
  const windowDays = sixty ? 60 : 30;
  const label = reporting ? "Nexa's 30-day reporting target" : `Nexa's standard ${windowDays}-day request window`;
  const eventDate = eventDateFor(code, f);
  const base = { windowDays, eventDate, ruleId, ruleVersion: RULE_BY_ID.get(ruleId)!.version, label };
  if (!eventDate) {
    const message =
      code === "loss_of_other_coverage" || code === "medicaid_chip_loss"
        ? "Use the date health coverage ends, which may be different from the last day worked. If you do not know it, ask HR to help verify it."
        : "Enter the date of the event so we can show your deadline.";
    return { ...base, status: "unknown", deadline: null, message };
  }
  const deadline = addDays(eventDate, windowDays);
  if (eventDate > asOf) {
    if (code === "birth") return { ...base, status: "future_event", deadline, message: "You can prepare now, but submit the birth request after your child is born." };
    if (code === "loss_of_other_coverage" && diffDays(eventDate, asOf) <= 30)
      return {
        ...base,
        status: "advance_request",
        deadline,
        ruleId: "R-ADV-LOSS",
        message: `Nexa allows a documented advance request while the other coverage is still in force. If approved, Nexa coverage would start ${fmtDateLong(addDays(eventDate, 1), true)}. You can also submit up to ${fmtDateLong(deadline, true)}.`,
      };
    if (reporting) return { ...base, status: "future_event", deadline, message: "You can prepare now. A divorce that is not final does not change coverage. Submit after it becomes final." };
    return { ...base, status: "future_event", deadline, message: "This date is in the future. You can save a draft and submit after the event happens." };
  }
  if (asOf === deadline) {
    return {
      ...base,
      status: "last_day",
      deadline,
      message: reporting
        ? "Today is the last day of Nexa's 30-day reporting target. Submit your request today. Tell us if a document is still pending."
        : "Today is the last day in Nexa's standard request window. Submit your request today. Tell us if a document is still pending.",
    };
  }
  if (asOf < deadline) {
    return {
      ...base,
      status: "within_window",
      deadline,
      message: reporting
        ? `Please report this by ${fmtDateLong(deadline, true)}. We will review your documents and confirm the change.`
        : `You can submit this request by ${fmtDateLong(deadline, true)}. We will review your documents and confirm the available changes.`,
    };
  }
  return {
    ...base,
    status: "late",
    deadline,
    message: reporting
      ? `Nexa's 30-day reporting target ended on ${fmtDateLong(deadline, true)}. Your request needs HR review. You can explain what happened and submit it for review.`
      : `Nexa's standard ${windowDays}-day request window ended on ${fmtDateLong(deadline, true)}. Your request needs HR review. You can explain what happened and submit it for review.`,
  };
}

function check(
  id: string,
  label: string,
  result: RuleCheck["result"],
  reason: string,
  ruleId: string,
  inputs: RuleCheck["inputs"] = {},
  blocking = true,
): RuleCheck {
  const r = RULE_BY_ID.get(ruleId);
  return { id, label, result, reason, source: r?.source ?? ruleId, ruleId, ruleVersion: r?.version ?? "n/a", inputs, blocking };
}

/** People who may be added or removed for this event under the configured rules. */
export function permittedPeople(s: ScenarioState, c: QleCase): { add: string[]; remove: string[] } {
  const f = c.facts;
  const med = electionOn(s, "medical", localDate(s.clock.businessNow));
  const covered = new Set(s.elections.flatMap((e) => e.coveredPersonIds));
  if (ADDITION_EVENTS.includes(c.eventCode)) {
    const kids = (f.children ?? []).map((k) => k.personId);
    const spouse = s.people.filter((p) => p.relationship === "spouse" && !covered.has(p.id)).map((p) => p.id);
    const self = med ? [] : [c.employeeId];
    return { add: [...kids, ...spouse, ...self], remove: [] };
  }
  if (c.eventCode === "divorce" && (f.direction === "remove_from_nexa" || f.direction === "both") && f.formerSpousePersonId && covered.has(f.formerSpousePersonId)) {
    return { add: [], remove: [f.formerSpousePersonId] };
  }
  if (c.eventCode === "loss_of_other_coverage" || c.eventCode === "medicaid_chip_loss") {
    const eligible = (f.lostCoveragePersonIds ?? []).filter((id) => {
      const p = s.people.find((x) => x.id === id);
      return p && (p.relationship === "spouse" || p.relationship === "child" || p.relationship === "self") && !covered.has(id);
    });
    return { add: eligible, remove: [] };
  }
  return { add: [], remove: [] };
}

export function defaultElections(s: ScenarioState, c: QleCase): ElectionChoice[] {
  const today = localDate(s.clock.businessNow);
  const perm = permittedPeople(s, c);
  return BENEFITS.map((b) => {
    const cur = electionOn(s, b, today);
    const planId = cur?.planId ?? plansFor(b)[0].id;
    if (ADDITION_EVENTS.includes(c.eventCode)) {
      const kids = (c.facts.children ?? []).map((k) => k.personId);
      return { benefit: b, planId, addPersonIds: b === "medical" ? kids : [], removePersonIds: [], enroll: b === "medical" };
    }
    if (c.eventCode === "divorce") {
      const rm = perm.remove.filter((id) => cur?.coveredPersonIds.includes(id));
      return { benefit: b, planId, addPersonIds: [], removePersonIds: rm, enroll: rm.length > 0 };
    }
    if (c.eventCode === "loss_of_other_coverage") {
      return { benefit: b, planId, addPersonIds: perm.add, removePersonIds: [], enroll: perm.add.length > 0 };
    }
    return { benefit: b, planId, addPersonIds: [], removePersonIds: [], enroll: false };
  });
}

function asOfDate(s: ScenarioState, c: QleCase): string {
  return c.receipt ? localDate(c.receipt.receivedAt) : localDate(s.clock.businessNow);
}

/** Coverage start for an added person, per event rule. */
function startFor(c: QleCase, personId: string, asOf: string): string | null {
  const f = c.facts;
  if (ADDITION_EVENTS.includes(c.eventCode)) {
    const kid = f.children?.find((k) => k.personId === personId);
    if (kid) return isValidDate(kid.dob) ? kid.dob : null;
    return eventDateFor(c.eventCode, f);
  }
  if (c.eventCode === "loss_of_other_coverage" || c.eventCode === "medicaid_chip_loss") {
    const end = f.coverageEndDate;
    if (!isValidDate(end)) return null;
    if (c.eventCode === "loss_of_other_coverage" && asOf <= end && diffDays(end, asOf) <= 30) return addDays(end, 1); // R-ADV-LOSS
    return firstOfNextMonth(asOf); // R-EFF-LOSS
  }
  return null;
}

export function evaluateCase(s: ScenarioState, c: QleCase): Evaluation {
  const f = c.facts;
  const asOf = asOfDate(s, c);
  const today = localDate(s.clock.businessNow);
  const timing = timingFor(c.eventCode, f, asOf);
  const checks: RuleCheck[] = [];
  const missing: string[] = [];
  const deep = DEEP_EVENTS.includes(c.eventCode);
  const perm = permittedPeople(s, c);
  const elections = c.elections.length ? c.elections : defaultElections(s, c);
  const rules = new Set<string>(["R-JUR", "R-S125"]);
  rules.add(timing.ruleId);

  // --- minimum intake
  if (!timing.eventDate) missing.push(ADDITION_EVENTS.includes(c.eventCode) ? "Child's date of birth or placement date" : c.eventCode.includes("loss") ? "Date the other coverage ends" : "Event date");
  if (ADDITION_EVENTS.includes(c.eventCode)) {
    const kids = f.children ?? [];
    if (!kids.length) missing.push("At least one child");
    kids.forEach((k, i) => {
      if (!k.firstName.trim()) missing.push(`Child ${i + 1}: first name (a temporary name is fine)`);
      if (!isValidDate(k.dob)) missing.push(`Child ${i + 1}: date of birth`);
    });
  }
  if (c.eventCode === "divorce") {
    if (!f.direction) missing.push("Whether you are removing your former spouse or lost outside coverage");
    if ((f.direction === "remove_from_nexa" || f.direction === "both") && !f.formerSpousePersonId) missing.push("The former spouse to remove");
  }
  if (c.eventCode === "loss_of_other_coverage") {
    if (!f.lostCoveragePersonIds?.length) missing.push("Who lost coverage");
    if (!f.lossReason) missing.push("Why the coverage ended");
  }
  const requested = elections.some((e) => e.enroll);
  if (deep && !requested && !(c.eventCode === "divorce" && f.direction !== "remove_from_nexa" && f.direction !== "both")) missing.push("The benefit change you are requesting");
  checks.push(
    check(
      "intake",
      "Minimum request information",
      missing.length ? "needs_information" : "passed",
      missing.length ? `Missing: ${missing.join("; ")}.` : "Event, affected people, event facts and requested change are recorded. Attestation is confirmed at submission.",
      "R-SE-30",
      { missing: missing.length },
    ),
  );

  // --- timing
  const timingResult: RuleCheck["result"] =
    timing.status === "within_window" || timing.status === "last_day" || timing.status === "advance_request"
      ? "passed"
      : timing.status === "late"
        ? "needs_review"
        : "needs_information";
  checks.push(
    check(
      "timing",
      c.eventCode === "divorce" ? "Reporting target" : "Request timing",
      timingResult,
      timing.status === "late"
        ? `${timing.label} ended ${fmtDateLong(timing.deadline, true)}. A late report is not an invalid event: HR timing review required (plan extension, administrative error, or exception). No automatic denial.`
        : timing.status === "future_event"
          ? "The event date is in the future. A completed request cannot use a future event date."
          : timing.status === "unknown"
            ? timing.message
            : `Received ${fmtDateLong(asOf, true)}; deadline ${fmtDateLong(timing.deadline, true)} (${timing.label}).`,
      timing.ruleId,
      { eventDate: timing.eventDate, deadline: timing.deadline, received: asOf, status: timing.status },
    ),
  );

  // --- evidence
  const files = s.evidence.filter((e) => e.caseId === c.id && e.status !== "rejected");
  const reviewed = files.some((e) => e.reviewedBy && e.status === "accepted_for_review");
  const awaitingConfirm = files.some((e) => e.status === "needs_confirmation");
  const awaitingHr = files.some((e) => e.status === "accepted_for_review" && !e.reviewedBy);
  const unreadable = files.some((e) => e.status === "unreadable");
  const evidenceResult: RuleCheck["result"] = !deep ? "not_applicable" : reviewed ? "passed" : awaitingHr && !awaitingConfirm ? "needs_review" : "needs_information";
  checks.push(
    check(
      "evidence",
      "Supporting evidence",
      evidenceResult,
      !deep
        ? "Handled in assisted review."
        : reviewed
          ? "Evidence reviewed and accepted by HR. OCR or model reading does not certify authenticity."
          : awaitingConfirm
            ? "Extracted facts are waiting for the employee to confirm."
            : awaitingHr
              ? "Employee confirmed the document facts. HR review of the document is needed."
              : unreadable
                ? "The uploaded file could not be read. Ask for a clearer copy of the exact document needed."
                : c.evidencePendingNote
                  ? `Evidence pending under Nexa's approved process (5-day correction target, not a legal cure period). Note: ${c.evidencePendingNote}`
                  : "No evidence uploaded yet. Evidence may follow under Nexa's approved process.",
      "R-EVID",
      { files: files.length },
    ),
  );
  const conflicts = files.flatMap((e) => e.proposedFacts.filter((p) => p.conflictWith));
  if (conflicts.length) {
    const open = conflicts.filter((p) => !p.confirmed);
    checks.push(
      check(
        "evidence_conflict",
        "Document and form agree",
        open.length ? "needs_information" : "passed",
        open.length
          ? open.map((p) => `The document shows ${dv(p.value)}; the form shows ${dv(p.conflictWith!.formValue)}.`).join(" ")
          : conflicts.map((p) => `Confirmed ${dv(p.confirmed!.value)} (${p.confirmed!.choice === "document" ? "document value" : p.confirmed!.choice === "form" ? "form value" : "entered value"}); document showed ${dv(p.value)}, form showed ${dv(p.conflictWith!.formValue)}. Both kept.`).join(" "),
        "R-EVID",
        { conflicts: conflicts.length },
      ),
    );
  }

  // --- jurisdiction
  const newState = f.residenceStateChanged;
  checks.push(
    check(
      "jurisdiction",
      "Jurisdiction",
      newState && newState !== "NY" ? "needs_review" : "passed",
      newState && newState !== "NY"
        ? `State rule review required: employee reports a move to ${newState}. No state pack is implemented. The request is preserved; automated execution is blocked until an authorized review is recorded.`
        : "Jurisdiction suitability assumed for synthetic demonstration (private sponsor, fully insured, policy state NY, work NY, residence NY). Federal baseline only; not a nationwide compliance claim.",
      "R-JUR",
      { policyState: "NY", workState: "NY", residenceState: newState ?? "NY" },
    ),
  );

  // --- overlap with other open requests for the same employee
  const overlapping = s.cases.filter((x) => x.id !== c.id && x.employeeId === c.employeeId && !x.background && ["submitted", "needs_information", "under_review"].includes(x.status));
  if (overlapping.length) {
    checks.push(check("overlap", "Other open requests", "needs_review", `Another open request (${overlapping.map((x) => x.caseNumber).join(", ")}) affects the same household. Sequence them or review a combined version; no last-write-wins.`, "R-S125", {}));
  }

  // --- event-specific checks
  let assisted = !deep;
  if (ADDITION_EVENTS.includes(c.eventCode)) {
    rules.add("R-EFF-BIRTH");
    const kids = f.children ?? [];
    const future = kids.filter((k) => isValidDate(k.dob) && k.dob > today);
    if (c.eventCode === "birth") {
      checks.push(
        check(
          "birth_date",
          "Birth date",
          future.length ? "needs_information" : kids.length ? "passed" : "needs_information",
          future.length ? "A completed birth request cannot use a birth date after today. You can save a draft and compare plans." : "Each child's date of birth is on or before today.",
          "R-EFF-BIRTH",
          { children: kids.length },
        ),
      );
    }
    checks.push(
      check(
        "children_distinct",
        "Each child recorded separately",
        kids.length ? "passed" : "not_applicable",
        kids.length > 1 ? `${kids.length} distinct child records in one case. Children are never merged because surname and date of birth match.` : "One child record.",
        "R-EFF-BIRTH",
        { children: kids.length },
        false,
      ),
    );
    const pending = kids.filter((k) => k.ssnStatus === "pending");
    checks.push(
      check(
        "ssn",
        "Child identifiers",
        "passed",
        pending.length ? `SSN pending for ${pending.map((k) => k.firstName || "the child").join(", ")}. The demo carrier procedure permits later completion; a restricted follow-up task is created. No value is invented.` : "Identifiers on file or not required.",
        "R-EVID",
        { pending: pending.length },
        false,
      ),
    );
    if (c.eventCode === "adoption" && s.cases.some((x) => x.id !== c.id && x.eventCode === "placement_for_adoption" && x.status === "approved")) {
      checks.push(check("adoption_duplicate", "Placement already enrolled", "needs_review", "A placement-for-adoption case already enrolled a child. A later adoption decree must not create a duplicate enrollment.", "R-EFF-BIRTH", {}));
    }
  }

  if (c.eventCode === "divorce") {
    rules.add("R-DIV-END");
    rules.add("R-COBRA");
    const dir = f.direction;
    if (dir === "lost_outside_coverage") {
      checks.push(check("direction", "Direction of the change", "not_applicable", "You lost coverage under your former spouse's plan. This routes to the loss-of-coverage flow. No Nexa termination and no Nexa COBRA referral.", "R-DIV-END", { direction: dir }, false));
    } else if (dir === "not_sure") {
      checks.push(check("direction", "Direction of the change", "needs_review", "Not sure which applies: HR will help confirm whose plan is affected.", "R-DIV-END", { direction: dir }));
    } else if (dir === "remove_from_nexa" || dir === "both") {
      if (dir === "both") checks.push(check("direction", "Direction of the change", "passed", "Both apply. This case removes the former spouse from Nexa; a linked loss-of-coverage case with its own plan authority and dates is created at submission.", "R-DIV-END", { direction: dir }, false));
      checks.push(
        check(
          "divorce_final",
          "Divorce is final",
          f.divorceFinal && timing.eventDate && timing.eventDate <= today ? "passed" : "needs_information",
          f.divorceFinal && timing.eventDate && timing.eventDate <= today ? `Final on ${fmtDateLong(timing.eventDate, true)}.` : "A divorce that is not final does not change coverage. Save your draft and submit after it is final.",
          "R-DIV-END",
          { final: !!f.divorceFinal },
        ),
      );
      const sp = f.formerSpousePersonId;
      const coveredNow = !!sp && s.elections.some((e) => e.coveredPersonIds.includes(sp) && (e.effectiveTo === null || e.effectiveTo >= today));
      checks.push(
        check(
          "spouse_covered",
          "Former spouse covered under Nexa",
          sp ? (coveredNow ? "passed" : "not_applicable") : "needs_information",
          coveredNow
            ? `${personName(s, sp!)} is currently covered. Only this person is removed; everyone else stays covered.`
            : sp
              ? "This person is not covered under Nexa. No Nexa termination, no deduction change and no Nexa COBRA referral."
              : "Choose the former spouse.",
          "R-DIV-END",
          { covered: coveredNow },
        ),
      );
      checks.push(
        check(
          "child_order",
          "Court order about children",
          f.childCoverageOrder === "none" ? "passed" : f.childCoverageOrder ? "needs_review" : "needs_information",
          f.childCoverageOrder === "none" ? "No order affects child coverage. Children remain covered." : f.childCoverageOrder ? "An order may affect child coverage. Child coverage is protected; an authorized reviewer confirms before execution." : "Tell us whether a court order affects any child's coverage.",
          "R-S125",
          { order: f.childCoverageOrder ?? null },
        ),
      );
      if (coveredNow) {
        checks.push(check("cobra_trigger", "Continuation handoff", "passed", "Divorce ends a covered spouse's coverage: a COBRA referral task is created now, separate from carrier and payroll.", "R-COBRA", {}, false));
        if (f.formerSpouseContactKnown === false) {
          checks.push(check("contact", "Former spouse contact", "needs_review", "Address unknown: restricted contact-verification task. Maya is not the delivery channel for notices.", "R-COBRA", {}, false));
        }
      }
      if (timing.status === "late" && timing.eventDate && diffDays(asOf, timing.eventDate) > 120) {
        checks.push(check("late_divorce", "Late report consequences", "needs_review", "Reported months after the divorce. Specialist review: separate carrier premium credit, employee refund, claims and possible missed COBRA notices. No automatic backdate or refund.", "R-COBRA", { daysLate: diffDays(asOf, timing.deadline!) }));
      }
    } else {
      checks.push(check("direction", "Direction of the change", "needs_information", "Tell us whether you are removing your former spouse from Nexa's plan or lost coverage under their plan.", "R-DIV-END", {}));
    }
  }

  if (c.eventCode === "loss_of_other_coverage") {
    rules.add("R-LOSS-QUAL");
    rules.add("R-EFF-LOSS");
    const reason = f.lossReason;
    const bad = ["nonpayment", "voluntary_cancellation", "cobra_cancelled_early", "fraud_termination"];
    checks.push(
      check(
        "loss_reason",
        "Reason coverage ended",
        !reason ? "needs_information" : bad.includes(reason) ? "needs_review" : "passed",
        !reason
          ? "Tell us why the coverage ended."
          : bad.includes(reason)
            ? "This is not an ordinary qualifying loss (nonpayment, voluntary cancellation, early COBRA cancellation or plan-fraud termination). HR reviews whether another rule applies. No automatic denial."
            : reason === "employment_ended"
              ? "Employment ended. Loss of eligibility for job-based coverage. A job dismissal for cause is not the plan-coverage fraud exclusion."
              : reason === "cobra_exhausted"
                ? "COBRA exhaustion: confirm the exhaustion notice and date. Early cancellation or nonpayment would not qualify."
                : reason === "employer_contribution_ended"
                  ? "Employer contribution ended: qualifies under the contribution rule even if full-price coverage could continue."
                  : "Qualifying loss reason under the configured rule.",
        "R-LOSS-QUAL",
        { reason: reason ?? null },
      ),
    );
    checks.push(
      check(
        "coverage_end",
        "Coverage-end date used",
        isValidDate(f.coverageEndDate) ? "passed" : "needs_information",
        isValidDate(f.coverageEndDate)
          ? `Coverage ends ${fmtDateLong(f.coverageEndDate, true)}${isValidDate(f.lastWorkday) ? `; last workday ${fmtDateLong(f.lastWorkday, true)} is kept separately and not used` : ""}.`
          : "Use the date health coverage ends, which may be different from the last day worked. If you do not know it, ask HR to help verify it.",
        "R-EFF-LOSS",
        { coverageEnd: f.coverageEndDate ?? null, lastWorkday: f.lastWorkday ?? null },
      ),
    );
    const waiver = (f.lostCoveragePersonIds ?? []).includes(LOSS_WAIVER_CONTEXT.personId);
    checks.push(
      check(
        "prior_coverage",
        "Prior coverage and waiver",
        f.priorCoverageConfirmed === false ? "needs_review" : waiver ? "passed" : f.lostCoveragePersonIds?.length ? "needs_review" : "needs_information",
        f.priorCoverageConfirmed === false
          ? "The employee says the person did not have the stated prior coverage. Another eligibility path must be reviewed; no loss is created."
          : waiver
            ? `Prior coverage on record: ${LOSS_WAIVER_CONTEXT.statement}`
            : "No waiver statement on file for this person. HR checks whether one was validly required and disclosed.",
        "R-LOSS-QUAL",
        { waiverOnFile: waiver },
      ),
    );
    // The accepted proof must name each person who lost coverage (read by AI or fixture parsing).
    const readFiles = files.filter((e) => (e.readMode === "model" || e.readMode === "fixture_hash") && e.status !== "unreadable");
    const lostPeople = (f.lostCoveragePersonIds ?? []).map((id) => personName(s, id));
    if (readFiles.length && lostPeople.length) {
      const named = (who: string) => readFiles.some((e) => e.proposedFacts.some((p) => p.field === "personName" && p.value.toLowerCase().includes(who.toLowerCase())));
      const missingNames = lostPeople.filter((who) => !named(who));
      checks.push(
        check(
          "evidence_names",
          "Proof names the person who lost coverage",
          missingNames.length ? "needs_information" : "passed",
          missingNames.length
            ? `The notice does not name ${missingNames.join(" or ")}. Ask for a notice or letter that names the person who lost coverage and the date it ends. This is a missing fact, not a finding against the employee.`
            : `The uploaded proof names ${lostPeople.join(" and ")}.`,
          "R-LOSS-QUAL",
          { files: readFiles.length, missing: missingNames.length },
        ),
      );
    }
    if (f.otherCoverageRemains) {
      checks.push(check("other_coverage", "Other coverage remains", "needs_review", "Another coverage remains. HR evaluates the applicable rule; no automatic denial.", "R-LOSS-QUAL", {}));
    }
    const perm2 = f.lostCoveragePersonIds ?? [];
    const ineligible = perm2.filter((id) => !perm.add.includes(id));
    if (ineligible.length) {
      checks.push(check("partial_household", "Household eligibility", "needs_review", `${ineligible.map((id) => personName(s, id)).join(", ")} cannot be added through this request (already covered or not eligible). Eligible people continue; the rest is explained separately.`, "R-LOSS-QUAL", {}, false));
    }
  }

  if (c.eventCode === "legal_separation") {
    assisted = true;
    checks.push(check("separation", "Legal separation eligibility", "needs_review", "Legal separation is assessed separately from divorce. Current coverage is kept until an authorized decision.", "R-DIV-END", {}));
  } else if (!deep) {
    const why =
      c.eventCode === "medicaid_chip_loss" || c.eventCode === "premium_assistance"
        ? "Uses the dedicated 60-day rule (not the 30-day window). Handled through assisted review in this build."
        : c.eventCode === "guardianship_foster"
          ? "Guardianship and foster placement are not automatically placement for adoption. Assisted review."
          : c.eventCode === "dependent_death"
            ? "Sensitive removal handled through assisted review. Surviving family coverage is preserved."
            : "Handled through assisted review in this build. HR confirms eligibility, dates and changes.";
    checks.push(check("assisted", "Assisted review", "needs_review", why, "R-SE-30", {}));
  }

  // --- proposed lines, costs and payroll forecast
  const lines: ProposedLine[] = [];
  const costs: CostLine[] = [];
  const permittedPlanIds = Object.fromEntries(BENEFITS.map((b) => [b, plansFor(b).map((p) => p.id)])) as Record<Benefit, string[]>;
  const removal = c.eventCode === "divorce";
  const canPropose = !assisted && !(c.eventCode === "divorce" && f.direction !== "remove_from_nexa" && f.direction !== "both");
  let forecast: Evaluation["adjustmentForecast"] = null;
  if (canPropose) {
    for (const e of elections) {
      const cur = electionOn(s, e.benefit, today);
      const before = cur?.coveredPersonIds ?? [];
      if (removal) permittedPlanIds[e.benefit] = cur ? [cur.planId] : [];
      if (!e.enroll) {
        if (cur) costs.push({ benefit: e.benefit, planBefore: cur.planId, tierBefore: cur.tier, planAfter: cur.planId, tierAfter: cur.tier, beforeCents: employeeCost(cur.planId, cur.tier), afterCents: employeeCost(cur.planId, cur.tier), effectiveDate: null });
        continue;
      }
      const adds = e.addPersonIds.filter((id) => perm.add.includes(id));
      const removes = e.removePersonIds.filter((id) => perm.remove.includes(id) && before.includes(id));
      const planId = removal && cur ? cur.planId : e.planId;
      const selfAdd = !cur ? [c.employeeId] : [];
      const after = [...new Set([...before.filter((id) => !removes.includes(id)), ...adds, ...selfAdd])];
      const peopleWithKids: Person[] = [
        ...s.people,
        ...(f.children ?? []).map((k) => ({ id: k.personId, employerId: c.employerId, firstName: k.firstName, lastName: k.lastName, dob: k.dob, relationship: "child" as const, residenceState: null, ssnStatus: k.ssnStatus })),
      ];
      const tierBefore = cur?.tier ?? "EE";
      const tierAfter = tierFor(after, peopleWithKids);
      let changeDate: string | null = null;
      for (const id of [...selfAdd, ...adds]) {
        const st = startFor(c, id, asOf);
        lines.push({ personId: id, benefit: e.benefit, action: "add", planId, tierAfter, startDate: st, endDate: null });
        if (st && (!changeDate || st < changeDate)) changeDate = st;
      }
      for (const id of removes) {
        const end = timing.eventDate ? lastOfMonth(timing.eventDate) : null;
        lines.push({ personId: id, benefit: e.benefit, action: "terminate", planId, tierAfter, startDate: null, endDate: end });
        if (end) changeDate = addDays(end, 1);
      }
      if (cur && (tierAfter !== tierBefore || planId !== cur.planId)) {
        lines.push({ personId: c.employeeId, benefit: e.benefit, action: "tier_change", planId, tierAfter, startDate: changeDate, endDate: null });
      }
      const beforeCents = cur ? employeeCost(cur.planId, cur.tier) : 0;
      const afterCents = employeeCost(planId, tierAfter);
      costs.push({ benefit: e.benefit, planBefore: cur?.planId ?? "", tierBefore, planAfter: planId, tierAfter, beforeCents, afterCents, effectiveDate: changeDate });
      if (changeDate && beforeCents !== afterCents) {
        const fc = forecastFor(s, e.benefit, changeDate, beforeCents, afterCents, c.id);
        if (fc) {
          const prev = forecast as Evaluation["adjustmentForecast"];
          forecast = prev
            ? { ...prev, adjustmentCents: prev.adjustmentCents + fc.adjustmentCents, basis: `${prev.basis} ${fc.basis}`, forecastAssumesScheduled: prev.forecastAssumesScheduled || fc.forecastAssumesScheduled }
            : fc;
        }
      }
    }
  } else {
    for (const b of BENEFITS) {
      const cur = electionOn(s, b, today);
      if (cur) costs.push({ benefit: b, planBefore: cur.planId, tierBefore: cur.tier, planAfter: cur.planId, tierAfter: cur.tier, beforeCents: employeeCost(cur.planId, cur.tier), afterCents: employeeCost(cur.planId, cur.tier), effectiveDate: null });
    }
  }
  if (canPropose && lines.length) {
    checks.push(check("s125", "Section 125 consistency", "passed", removal ? "Only the former spouse is removed. No unrelated cancellation or plan change." : "The requested additions are consistent with the event.", "R-S125", { lines: lines.length }, true));
    checks.push(check("rates", "Rates and plan version", "passed", `Rates ${RATE_VERSION} apply to every requested date. Contributions come from the rate table, not the model.`, "R-PAY", {}, false));
  }
  if (lines.some((l) => l.startDate === null && l.action !== "terminate") || lines.some((l) => l.action === "terminate" && !l.endDate)) {
    missing.push("Coverage dates cannot be calculated until the event date is known");
  }
  const loss = c.eventCode === "loss_of_other_coverage" && isValidDate(f.coverageEndDate) ? lines.find((l) => l.action === "add")?.startDate : null;
  if (loss && f.coverageEndDate && loss > addDays(f.coverageEndDate, 1)) {
    checks.push(check("gap", "Possible gap in coverage", "needs_review", `Other coverage ends ${fmtDateLong(f.coverageEndDate, true)}; the base rule starts Nexa coverage ${fmtDateLong(loss, true)}. HR can review any approved earlier-start provision. No promise of continuous coverage.`, "R-EFF-LOSS", {}, false));
  }

  for (const k of checks) {
    const r = c.checkResolutions?.[k.id];
    if (r) k.resolvedBy = r;
  }
  const totalBefore = costs.reduce((a, x) => a + x.beforeCents, 0);
  const totalAfter = costs.reduce((a, x) => a + x.afterCents, 0);
  return {
    evaluatedAt: s.clock.businessNow,
    timing,
    checks,
    permittedPersonIds: [...perm.add, ...perm.remove],
    permittedPlanIds,
    proposedLines: lines,
    costs,
    totalBeforeCents: totalBefore,
    totalAfterCents: totalAfter,
    adjustmentForecast: forecast,
    missingFacts: missing,
    assistedReview: assisted,
    ruleSnapshot: [...rules].map(ruleRef),
  };
}

/** Human date for ISO values inside check text; other values pass through. */
function dv(v: string): string {
  return v.split(", ").map((x) => (isValidDate(x) ? fmtDateLong(x, true) : x)).join(" and ");
}

export function blockingOpen(ev: Evaluation): RuleCheck[] {
  return ev.checks.filter((k) => k.blocking && !(k.result === "passed" || k.result === "not_applicable" || k.resolvedBy));
}
