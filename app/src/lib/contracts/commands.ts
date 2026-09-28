import { z } from "zod";

// Every mutation goes through one validated command. The server derives the actor,
// partner and employer from the signed session, never from the payload.

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const optDate = date.nullable().optional();
const key = z.string().min(8).max(120);
const benefit = z.enum(["medical", "dental", "vision"]);
const tier = z.enum(["EE", "ES", "EC", "FAM"]);

const child = z.object({
  personId: z.string().min(1),
  firstName: z.string().trim().max(60),
  lastName: z.string().trim().max(60),
  dob: date.nullable(),
  ssnStatus: z.enum(["pending", "on_file"]),
});

export const factsPatch = z
  .object({
    eventDate: optDate,
    children: z.array(child).max(6).optional(),
    adoptionKind: z.enum(["adoption", "placement"]).optional(),
    direction: z.enum(["remove_from_nexa", "lost_outside_coverage", "both", "not_sure"]).optional(),
    divorceFinal: z.boolean().optional(),
    formerSpousePersonId: z.string().optional(),
    childCoverageOrder: z.enum(["none", "order_exists", "not_sure"]).optional(),
    formerSpouseContactKnown: z.boolean().optional(),
    lostCoveragePersonIds: z.array(z.string()).optional(),
    lossReason: z
      .enum([
        "employment_ended",
        "hours_reduced",
        "divorce_separation",
        "policyholder_died",
        "dependent_eligibility_ended",
        "employer_contribution_ended",
        "cobra_exhausted",
        "cobra_cancelled_early",
        "nonpayment",
        "voluntary_cancellation",
        "fraud_termination",
        "other_involuntary",
      ])
      .optional(),
    priorEmployer: z.string().max(120).optional(),
    priorCarrier: z.string().max(120).optional(),
    lastWorkday: optDate,
    coverageEndDate: optDate,
    coverageEndUnknown: z.boolean().optional(),
    otherCoverageRemains: z.boolean().optional(),
    priorCoverageConfirmed: z.boolean().optional(),
    cobraOffered: z.boolean().optional(),
    residenceStateChanged: z.string().max(2).nullable().optional(),
    explanation: z.string().max(2000).optional(),
  })
  .strict();

export const eventCode = z.enum([
  "birth",
  "adoption",
  "placement_for_adoption",
  "marriage",
  "divorce",
  "legal_separation",
  "dependent_death",
  "loss_of_other_coverage",
  "medicaid_chip_loss",
  "premium_assistance",
  "employment_change",
  "leave",
  "dependent_age_off",
  "disability_extension_review",
  "court_order",
  "guardianship_foster",
  "cost_or_coverage_change",
  "other_employer_oe",
  "marketplace_transition",
  "medicare_medicaid_entitlement",
  "not_sure",
]);

const electionChoice = z.object({
  benefit,
  planId: z.string(),
  addPersonIds: z.array(z.string()),
  removePersonIds: z.array(z.string()),
  enroll: z.boolean(),
});

const base = { idempotencyKey: key };
const caseRef = { caseId: z.string(), expectedVersion: z.number().int().nonnegative() };

export const command = z.discriminatedUnion("type", [
  // Employee
  z.object({ type: z.literal("case.createDraft"), ...base, eventCode }),
  z.object({ type: z.literal("case.updateDraft"), ...base, ...caseRef, eventCode: eventCode.optional(), facts: factsPatch }),
  z.object({
    type: z.literal("case.setElections"),
    ...base,
    ...caseRef,
    elections: z.array(electionChoice),
    priority: z.enum(["lower_paycheck", "lower_care_cost", "provider_access"]).nullable().optional(),
  }),
  z.object({
    type: z.literal("case.confirmFact"),
    ...base,
    ...caseRef,
    fileId: z.string(),
    factIndex: z.number().int().nonnegative(),
    choice: z.enum(["document", "form", "custom"]),
    value: z.string().max(200).optional(),
  }),
  z.object({ type: z.literal("case.markEvidencePending"), ...base, ...caseRef, note: z.string().max(500) }),
  z.object({
    type: z.literal("case.submit"),
    ...base,
    ...caseRef,
    attestation: z.literal(true, { message: "Confirm the attestation to submit." }),
    asReviewRequest: z.boolean().optional(),
  }),
  z.object({ type: z.literal("case.respond"), ...base, ...caseRef, taskId: z.string(), message: z.string().trim().min(1, "Add a short reply.").max(2000), facts: factsPatch.optional() }),
  z.object({ type: z.literal("case.withdraw"), ...base, ...caseRef, reason: z.string().trim().min(3).max(500) }),
  z.object({ type: z.literal("case.urgentSupport"), ...base, caseId: z.string(), message: z.string().trim().min(3).max(1000) }),

  // HR
  z.object({ type: z.literal("hr.reviewEvidence"), ...base, ...caseRef, fileId: z.string(), outcome: z.enum(["accept", "reject"]), reason: z.string().max(500).optional() }),
  z.object({
    type: z.literal("hr.requestInformation"),
    ...base,
    ...caseRef,
    reason: z.string().trim().min(5, "Say why the information is needed.").max(500),
    items: z.array(z.string().trim().min(2)).min(1, "List at least one item."),
    dueDate: date,
    employeeMessage: z.string().trim().min(10, "Write the message Maya will see.").max(1000),
  }),
  z.object({
    type: z.literal("hr.resolveCheck"),
    ...base,
    ...caseRef,
    checkId: z.string(),
    outcome: z.enum(["passed", "not_applicable"]),
    reason: z.string().trim().min(5).max(500),
    source: z.string().trim().min(3).max(200),
    reviewer: z.string().trim().min(3).max(120),
  }),
  z.object({ type: z.literal("hr.approve"), ...base, ...caseRef, revisionNo: z.number().int().positive() }),
  z.object({ type: z.literal("hr.bulkApprove"), ...base, caseIds: z.array(z.string()).min(1).max(50) }),
  z.object({
    type: z.literal("hr.decide"),
    ...base,
    ...caseRef,
    outcome: z.literal("declined"),
    reason: z.string().trim().min(10).max(1000),
    source: z.string().trim().min(3).max(200),
    reviewRoute: z.string().trim().min(3).max(300),
  }),
  z.object({ type: z.literal("hr.escalate"), ...base, ...caseRef, reason: z.string().trim().min(5).max(500) }),
  z.object({ type: z.literal("hr.addNote"), ...base, caseId: z.string(), note: z.string().trim().min(2).max(1000) }),
  z.object({ type: z.literal("hr.sendCorrection"), ...base, caseId: z.string(), lineId: z.string() }),
  z.object({ type: z.literal("hr.assignBroker"), ...base, caseId: z.string(), lineId: z.string() }),
  z.object({ type: z.literal("hr.recordDeliveryInquiry"), ...base, batchId: z.string(), outcome: z.enum(["received", "not_received"]), reference: z.string().trim().min(3).max(120) }),
  z.object({ type: z.literal("hr.authorizePayroll"), ...base, instructionId: z.string() }),
  z.object({ type: z.literal("hr.requestPayrollCorrection"), ...base, instructionId: z.string() }),
  z.object({ type: z.literal("hr.sendCobraReferral"), ...base, referralId: z.string(), contactRoute: z.enum(["verified_address_on_file", "contact_verification_needed"]) }),
  z.object({ type: z.literal("hr.resolveTask"), ...base, taskId: z.string(), resolution: z.string().trim().min(3).max(500) }),

  // Broker
  z.object({ type: z.literal("broker.recordSubmission"), ...base, taskId: z.string(), reference: z.string().trim().min(3).max(80) }),
  z.object({
    type: z.literal("broker.recordResult"),
    ...base,
    taskId: z.string(),
    sourceRef: z.string().trim().min(3).max(120),
    verifier: z.string().trim().min(3).max(120),
    planId: z.string(),
    tier,
    startDate: date.nullable(),
    endDate: date.nullable(),
  }),

  // External simulators (demo operator, carrier operator, COBRA administrator)
  z.object({ type: z.literal("ops.runBatch"), ...base }),
  z.object({ type: z.literal("ops.batchTransport"), ...base, batchId: z.string(), outcome: z.enum(["received", "unknown"]) }),
  z.object({ type: z.literal("ops.batchValidation"), ...base, batchId: z.string(), outcome: z.enum(["accepted", "rejected"]), reason: z.string().max(300).optional() }),
  z.object({ type: z.literal("ops.memberResult"), ...base, txnId: z.string(), outcome: z.enum(["accepted", "rejected", "info_requested"]), reason: z.string().max(300).optional() }),
  z.object({
    type: z.literal("ops.publishObservation"),
    ...base,
    eventId: z.string().min(4),
    txnId: z.string(),
    planId: z.string(),
    tier,
    startDate: date.nullable(),
    endDate: date.nullable(),
    sourceRef: z.string().trim().min(3).max(120),
  }),
  z.object({ type: z.literal("ops.publishAccepted"), ...base, batchId: z.string() }),
  z.object({ type: z.literal("ops.payrollInstruction"), ...base, instructionId: z.string(), outcome: z.enum(["accept", "reject"]), reason: z.string().max(300).optional() }),
  z.object({ type: z.literal("ops.payrollPost"), ...base, runId: z.string(), override: z.object({ benefit, amountCents: z.number().int() }).optional() }),
  z.object({ type: z.literal("ops.cobra"), ...base, referralId: z.string(), action: z.enum(["acknowledge", "request_info", "notice"]), note: z.string().max(300).optional() }),
  z.object({ type: z.literal("ops.clock"), ...base, advance: z.enum(["plus_hour", "next_batch", "plus_day", "next_payday"]) }),
  z.object({
    type: z.literal("ops.preset"),
    ...base,
    preset: z.enum(["none", "carrier_wrong_start_date", "carrier_reject_one_record", "transport_unknown", "payroll_different_amount", "dental_failure"]),
  }),
  z.object({ type: z.literal("ops.bounce"), ...base, notificationId: z.string() }),
  z.object({ type: z.literal("ops.autopilot"), ...base, on: z.boolean() }),
  z.object({ type: z.literal("ops.rateChange"), ...base, note: z.string().trim().min(5).max(300) }),
  z.object({ type: z.literal("ops.reset"), ...base, confirmScenario: z.enum(["birth", "divorce", "loss"]) }),
]);

export type Command = z.infer<typeof command>;
export type CommandType = Command["type"];
