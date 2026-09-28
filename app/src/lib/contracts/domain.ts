// Shared domain contract. Every role reads and writes these records; delegates import
// from here and never redefine them. Money is integer cents. Calendar dates are
// 'YYYY-MM-DD' (date-only). Timestamps are ISO-8601 UTC strings.

export type ISODate = string; // YYYY-MM-DD
export type ISOTime = string; // UTC timestamp
export type Cents = number;

export type ScenarioId = "birth" | "divorce" | "loss";
export const SCENARIO_IDS: ScenarioId[] = ["birth", "divorce", "loss"];

export type Role = "employee" | "hr_admin" | "broker" | "carrier_operator" | "cobra_admin" | "demo_operator";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  partnerId: string;
  employerId: string | null; // null for external parties
  personId?: string; // employee's person record
}

export type Benefit = "medical" | "dental" | "vision";
export const BENEFITS: Benefit[] = ["medical", "dental", "vision"];
export type Tier = "EE" | "ES" | "EC" | "FAM"; // Employee only / + Spouse / + Children / Family
export const TIERS: Tier[] = ["EE", "ES", "EC", "FAM"];

export type Relationship = "self" | "spouse" | "former_spouse" | "child";

export interface Person {
  id: string;
  employerId: string;
  subscriberId?: string; // only the employee (subscriber) has one
  firstName: string;
  lastName: string;
  dob: ISODate | null;
  relationship: Relationship;
  residenceState: string | null;
  ssnStatus: "on_file" | "pending" | "not_required";
  ssnLast4?: string; // masked; never full SSN
  addedByCaseId?: string;
  sensitiveContact?: boolean; // private former-spouse contact (restricted)
}

// Host platform's current elections (source: host). Confirmed coverage only.
export interface Election {
  id: string;
  personId: string; // subscriber
  benefit: Benefit;
  planId: string;
  tier: Tier;
  coveredPersonIds: string[];
  effectiveFrom: ISODate;
  effectiveTo: ISODate | null;
  source: "host_seed" | "case";
  caseId?: string;
}

// ---- Events ----
export type EventCode =
  | "birth"
  | "adoption"
  | "placement_for_adoption"
  | "marriage"
  | "divorce"
  | "legal_separation"
  | "dependent_death"
  | "loss_of_other_coverage"
  | "medicaid_chip_loss"
  | "premium_assistance"
  | "employment_change"
  | "leave"
  | "dependent_age_off"
  | "disability_extension_review"
  | "court_order"
  | "guardianship_foster"
  | "cost_or_coverage_change"
  | "other_employer_oe"
  | "marketplace_transition"
  | "medicare_medicaid_entitlement"
  | "not_sure";

export type LossReason =
  | "employment_ended"
  | "hours_reduced"
  | "divorce_separation"
  | "policyholder_died"
  | "dependent_eligibility_ended"
  | "employer_contribution_ended"
  | "cobra_exhausted"
  | "cobra_cancelled_early"
  | "nonpayment"
  | "voluntary_cancellation"
  | "fraud_termination"
  | "other_involuntary";

export type DivorceDirection = "remove_from_nexa" | "lost_outside_coverage" | "both" | "not_sure";

export interface ChildFacts {
  personId: string; // stable id assigned when added
  firstName: string;
  lastName: string;
  dob: ISODate | null;
  ssnStatus: "pending" | "on_file";
}

export interface EventFacts {
  eventDate?: ISODate | null; // birth/adoption/placement date, divorce final date, etc.
  children?: ChildFacts[];
  adoptionKind?: "adoption" | "placement";
  priorPlacementCaseId?: string | null;
  // divorce
  direction?: DivorceDirection;
  divorceFinal?: boolean;
  formerSpousePersonId?: string;
  childCoverageOrder?: "none" | "order_exists" | "not_sure";
  formerSpouseContactKnown?: boolean;
  // loss
  lostCoveragePersonIds?: string[];
  lossReason?: LossReason;
  priorEmployer?: string;
  priorCarrier?: string;
  lastWorkday?: ISODate | null;
  coverageEndDate?: ISODate | null;
  coverageEndUnknown?: boolean;
  otherCoverageRemains?: boolean;
  priorCoverageConfirmed?: boolean;
  cobraOffered?: boolean;
  // shared
  residenceStateChanged?: string | null; // new state if the employee reports a move
  explanation?: string; // employee note, e.g. why a request is late
}

export type RequestStatus = "draft" | "submitted" | "needs_information" | "under_review" | "approved" | "declined" | "withdrawn";

export interface ElectionChoice {
  benefit: Benefit;
  planId: string; // plan after the change
  addPersonIds: string[];
  removePersonIds: string[];
  enroll: boolean; // false = no change to this benefit
}

export interface Preferences {
  priority?: "lower_paycheck" | "lower_care_cost" | "provider_access" | null;
  priorities?: ("lower_paycheck" | "lower_care_cost" | "provider_access")[]; // several can apply; latest last
}

export type CheckResult = "passed" | "needs_information" | "needs_review" | "not_applicable";
export interface RuleCheck {
  id: string;
  label: string;
  result: CheckResult;
  reason: string;
  source: string; // document / rule reference
  ruleId: string;
  ruleVersion: string;
  inputs: Record<string, string | number | boolean | null>;
  blocking: boolean; // blocks ordinary approval when not passed / n/a
  resolvedBy?: { actor: string; at: ISOTime; outcome: CheckResult; reason: string; source: string; reviewer: string };
}

export type TimingStatus = "within_window" | "last_day" | "late" | "future_event" | "advance_request" | "unknown";
export interface TimingResult {
  status: TimingStatus;
  windowDays: number;
  eventDate: ISODate | null;
  deadline: ISODate | null;
  ruleId: string;
  ruleVersion: string;
  label: string; // "Nexa standard request window", "Nexa reporting target"
  message: string; // exact employee copy
}

export interface ProposedLine {
  personId: string;
  benefit: Benefit;
  action: "add" | "terminate" | "tier_change";
  planId: string;
  tierAfter: Tier;
  startDate: ISODate | null; // coverage start (add / tier change)
  endDate: ISODate | null; // coverage end (terminate)
}

export interface CostLine {
  benefit: Benefit;
  planBefore: string;
  tierBefore: Tier;
  planAfter: string;
  tierAfter: Tier;
  beforeCents: Cents;
  afterCents: Cents;
  effectiveDate: ISODate | null;
}

export interface Evaluation {
  evaluatedAt: ISOTime;
  timing: TimingResult;
  checks: RuleCheck[];
  permittedPersonIds: string[];
  permittedPlanIds: Record<Benefit, string[]>;
  proposedLines: ProposedLine[];
  costs: CostLine[];
  totalBeforeCents: Cents;
  totalAfterCents: Cents;
  adjustmentForecast: PayrollForecast | null;
  missingFacts: string[];
  assistedReview: boolean; // event handled through assisted review only
  ruleSnapshot: { id: string; version: string }[];
}

export interface CaseRevision {
  revisionNo: number;
  createdAt: ISOTime; // business time
  createdBy: string;
  reason: string;
  eventCode: EventCode;
  facts: EventFacts;
  elections: ElectionChoice[];
  evaluation: Evaluation;
  hash: string;
  material: boolean;
}

export interface Receipt {
  caseNumber: string;
  receivedAt: ISOTime; // server business time — the controlling timestamp
  ingestedAt: ISOTime; // real wall-clock time
  revisionNo: number;
  hash: string;
  timingAtReceipt: TimingStatus;
  reportedAt: ISOTime;
  enrollmentRequestedAt: ISOTime | null; // null when submitted as a review request only
  kind: "election_request" | "review_request";
}

export interface Approval {
  id: string;
  revisionNo: number;
  hash: string;
  actor: string;
  at: ISOTime;
  ruleSnapshot: { id: string; version: string }[];
  lines: ProposedLine[];
  supersededAt?: ISOTime;
  supersededReason?: string;
}

export type CoverageState = "awaiting_confirmation" | "confirmed_future" | "confirmed_current" | "end_confirmed" | "mismatch";
export type DeliveryState = "queued" | "sent" | "receipt_unknown" | "acknowledged" | "file_rejected" | "record_rejected";

export interface ExecutionLine extends ProposedLine {
  id: string;
  caseId: string;
  approvalId: string;
  coverageState: CoverageState;
  currentTxnId: string | null;
  txnIds: string[];
  observationId: string | null;
  mismatch: { field: string; expected: string; observed: string; message: string } | null;
  route: "edi_834" | "api" | "manual";
}

export type CobraState = "not_applicable" | "review_needed" | "referral_ready" | "sent" | "received" | "notice_tracked" | "exception";
export type PayrollState = "preview" | "blocked" | "approval_needed" | "scheduled" | "instruction_accepted" | "posted" | "mismatch" | "verified_no_change";

export interface QleCase {
  id: string;
  caseNumber: string;
  partnerId: string;
  employerId: string;
  employeeId: string; // person id of the employee
  employeeName: string;
  background: boolean; // seeded queue context, separate from the live scenario
  sampleAiMatch?: number | null; // background sample cases only: seeded AI match for the queue
  eventCode: EventCode;
  status: RequestStatus;
  version: number; // concurrency token, bumps on every change
  createdAt: ISOTime;
  updatedAt: ISOTime;
  facts: EventFacts;
  elections: ElectionChoice[];
  preferences: Preferences;
  evaluation: Evaluation | null;
  revisions: CaseRevision[];
  receipt: Receipt | null;
  approvals: Approval[];
  lines: ExecutionLine[];
  ownerId: string; // current accountable owner (user id)
  backupOwnerId: string;
  linkedCaseIds: string[];
  sensitive: boolean;
  evidencePendingNote?: string;
  decision?: { kind: "declined" | "withdrawn"; actor: string; at: ISOTime; reason: string; source: string; reviewRoute: string };
  completedAt?: ISOTime;
  reopenedAt?: ISOTime;
  specialistReview?: { reason: string; at: ISOTime; actor: string };
  // HR / specialist resolutions of review checks; cleared by a material revision.
  checkResolutions: Record<string, NonNullable<RuleCheck["resolvedBy"]>>;
}

// ---- Evidence ----
export type EvidenceStatus = "uploading" | "reading" | "needs_confirmation" | "accepted_for_review" | "unreadable" | "rejected";
export interface ProposedFact {
  field: "documentType" | "eventDate" | "coverageEndDate" | "lastWorkday" | "personName" | "otherFact";
  label: string;
  value: string;
  page: number | null;
  quote: string | null; // short source span
  confirmed: null | { choice: "document" | "form" | "custom"; value: string; by: string; at: ISOTime };
  conflictWith?: { formValue: string };
}
export interface EvidenceFile {
  id: string;
  caseId: string;
  taskId?: string; // answers an information request
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  uploadedBy: string;
  uploadedAt: ISOTime;
  status: EvidenceStatus;
  readMode: "model" | "fixture_hash" | "manual" | null;
  documentType: string | null;
  proposedFacts: ProposedFact[];
  readNote: string | null;
  reviewedBy?: string; // "ai_auto" when verified automatically at 100% match
  reviewedAt?: ISOTime;
  confidence?: number | null; // prototype match-confidence rule, not a model number
  confidenceAtRead?: number | null; // score when first read, before any fact was confirmed
  confidenceSummary?: string;
  rejectionReason?: string;
}

// ---- Tasks and issues ----
export type TaskKind =
  | "hr_review"
  | "information_request"
  | "evidence_follow_up"
  | "specialist_review"
  | "coverage_mismatch"
  | "record_rejected"
  | "delivery_investigation"
  | "carrier_silence"
  | "broker_correction"
  | "payroll_authorization"
  | "payroll_mismatch"
  | "cobra_referral"
  | "cobra_silence"
  | "contact_verification"
  | "ssn_follow_up"
  | "urgent_support"
  | "alternate_contact";

export interface Task {
  id: string;
  caseId: string;
  kind: TaskKind;
  title: string;
  reason: string;
  nextAction: string;
  ownerId: string;
  backupOwnerId: string;
  dueAt: ISOTime | null;
  createdAt: ISOTime;
  status: "open" | "done" | "cancelled";
  resolvedAt?: ISOTime;
  resolution?: string;
  escalatedAt?: ISOTime;
  remindedAt?: ISOTime;
  // information requests
  items?: string[];
  employeeMessage?: string;
  response?: { at: ISOTime; message: string; fileIds: string[] };
  lineId?: string;
  txnId?: string;
  instructionId?: string;
  referralId?: string;
  blocking: boolean;
  internalOnly: boolean; // hidden from the employee
  broker?: {
    packet: { label: string; value: string }[];
    checklist: string[];
    submissionRef?: string;
    submittedAt?: ISOTime;
    result?: { sourceRef: string; verifier: string; at: ISOTime; startDate: ISODate | null; endDate: ISODate | null; tier: Tier; planId: string };
  };
}

// ---- Carrier ----
export interface Carrier {
  id: string;
  name: string;
  groupNumber: string;
  benefits: Benefit[];
  route: "edi_834" | "api";
}

export interface ChangeOrder {
  operationKey: string;
  employerId: string;
  groupNumber: string;
  subscriberId: string;
  personId: string;
  memberName: string;
  relationship: Relationship;
  dob: ISODate | null;
  benefit: Benefit;
  planId: string;
  action: ProposedLine["action"];
  tier: Tier;
  startDate: ISODate | null;
  endDate: ISODate | null;
  caseId: string;
  caseNumber: string;
  approvedRevision: number;
  ssnStatus: Person["ssnStatus"];
}

export interface CarrierTxn {
  id: string;
  carrierId: string;
  route: "edi_834" | "api" | "manual";
  lineId: string;
  caseId: string;
  order: ChangeOrder;
  correctionOf: string | null;
  batchId: string | null;
  delivery: DeliveryState;
  memberResult: "pending" | "accepted" | "rejected" | "info_requested";
  memberReason?: string;
  superseded: boolean;
  createdAt: ISOTime;
  sentAt?: ISOTime;
  attempts: { id: string; at: ISOTime; outcome: string }[];
  apiReference?: string;
}

export interface CarrierBatch {
  id: string;
  carrierId: string;
  controlNumber: string;
  txnIds: string[];
  recordCount: number;
  payloadHash: string;
  queuedAt: ISOTime;
  sentAt: ISOTime;
  transport: "pending" | "received" | "unknown" | "not_received";
  fileValidation: "pending" | "accepted" | "rejected";
  fileReason?: string;
  attempts: { id: string; at: ISOTime; outcome: string }[];
}

export interface CarrierCoverage {
  id: string;
  carrierId: string;
  personId: string;
  benefit: Benefit;
  planId: string;
  tier: Tier;
  startDate: ISODate;
  endDate: ISODate | null;
  sourceRef: string;
  observedAt: ISOTime;
}

export interface CarrierObservation {
  id: string;
  eventId: string; // idempotency for callbacks
  txnId: string;
  caseId: string;
  lineId: string;
  personId: string;
  benefit: Benefit;
  planId: string;
  tier: Tier;
  startDate: ISODate | null;
  endDate: ISODate | null;
  sourceRef: string;
  observedAt: ISOTime;
  ingestedAt: ISOTime;
  stale: boolean;
  outcome: "matched" | "mismatch" | "stale_ignored";
}

// ---- Payroll ----
export interface PayRun {
  id: string;
  payday: ISODate;
  periodStart: ISODate;
  periodEnd: ISODate;
  cutoffAt: ISOTime;
  status: "scheduled" | "posted";
  postedAt?: ISOTime;
}

export interface PostedDeduction {
  id: string;
  runId: string;
  benefit: Benefit;
  kind: "recurring" | "adjustment";
  amountCents: Cents;
  allocatedMonth: string; // YYYY-MM
  instructionId?: string;
}

export interface PayrollInstruction {
  id: string;
  caseId: string;
  benefit: Benefit;
  state: PayrollState;
  targetRunId: string;
  previousRecurringCents: Cents;
  newRecurringCents: Cents;
  adjustmentCents: Cents; // + arrears, - refund proposal
  adjustmentBasis: string; // human-readable calculation
  calcLines: { month: string; obligationCents: Cents; collectedCents: Cents; laterRecurringCents: Cents }[];
  effectiveFrom: ISODate;
  createdAt: ISOTime;
  authorizedBy?: string;
  authorizedAt?: ISOTime;
  acceptedAt?: ISOTime;
  rejectedReason?: string;
  postedCents?: Cents;
  postedAdjustmentCents?: Cents;
  operationKey: string;
  correctionOf?: string;
}

export interface PayrollSetup {
  benefit: Benefit;
  recurringCents: Cents;
  fromRunId: string | null;
  pending: { fromRunId: string; recurringCents: Cents; instructionId: string } | null;
  oneTime: { runId: string; amountCents: Cents; instructionId: string }[];
}

export interface PayrollForecast {
  targetRunId: string;
  targetPayday: ISODate;
  newRecurringCents: Cents;
  adjustmentCents: Cents;
  basis: string;
  forecastAssumesScheduled: boolean; // true while an older scheduled run is unposted
}

// ---- COBRA ----
export interface CobraReferral {
  id: string;
  caseId: string;
  state: CobraState;
  beneficiaryPersonId: string;
  beneficiaryName: string;
  qualifyingEvent: string;
  eventDate: ISODate | null;
  coverageLossDate: ISODate | null;
  plans: { benefit: Benefit; planId: string }[];
  contactRoute: "verified_address_on_file" | "contact_verification_needed" | null;
  createdAt: ISOTime;
  sentAt?: ISOTime;
  receivedAt?: ISOTime;
  noticeRef?: string;
  noticeStatus?: string;
  infoRequested?: string;
  noticeSent?: { at: ISOTime; by: string; to: string; subject: string }; // election notice emailed through the portal (simulated)
  history: { at: ISOTime; actor: string; state: CobraState; note: string }[];
  // restricted fields: never sent to the employee view
  private: { mailingAddress: string; email: string };
}

// ---- Notifications, audit, AI ----
export interface Notification {
  id: string;
  key: string; // dedupe key
  recipientUserId: string;
  recipientEmail: string;
  recipientRole: Role | "beneficiary";
  subject: string;
  preview: string;
  caseId: string | null;
  link: string;
  eventType: string;
  createdAt: ISOTime;
  deliveryState: "simulated_delivered" | "simulated_bounced";
  readAt?: ISOTime;
}

export interface AuditEvent {
  id: string;
  caseId: string | null;
  at: ISOTime; // business time
  ingestedAt: ISOTime; // real time
  actor: string; // user id or "system"
  type: string;
  summary: string; // internal wording
  employeeSummary: string | null; // null = internal only
  visibility: "employee" | "internal";
  data?: Record<string, string | number | boolean | null>;
}

export interface AiActivity {
  id: string;
  caseId: string | null;
  at: ISOTime;
  kind: "document_read" | "facts_proposed" | "facts_confirmed" | "summary_prepared" | "emma_answer" | "rule_check" | "reconciliation_check" | "model_unavailable";
  label: string;
  detail: string;
  actor: string;
  model: string | null; // null for deterministic work
}

export type FailurePreset =
  | "none"
  | "carrier_wrong_start_date"
  | "carrier_reject_one_record"
  | "transport_unknown"
  | "payroll_different_amount"
  | "dental_failure";

export interface ScenarioState {
  scenarioId: ScenarioId;
  schemaVersion: 1;
  rev: number;
  seededAt: ISOTime;
  clock: { businessNow: ISOTime };
  preset: FailurePreset;
  autopilot?: boolean; // undefined = on. Straight-through processing for clean cases (demo setting)
  counters: Record<string, number>;
  people: Person[];
  elections: Election[];
  cases: QleCase[];
  evidence: EvidenceFile[];
  tasks: Task[];
  carriers: Carrier[];
  txns: CarrierTxn[];
  batches: CarrierBatch[];
  roster: CarrierCoverage[];
  observations: CarrierObservation[];
  payRuns: PayRun[];
  ledger: PostedDeduction[];
  instructions: PayrollInstruction[];
  payrollSetup: PayrollSetup[];
  cobra: CobraReferral[];
  outbox: Notification[];
  audit: AuditEvent[];
  ai: AiActivity[];
  processed: Record<string, { at: ISOTime; result: CommandResult }>;
  metrics: { at: ISOTime; name: string; caseId: string | null }[];
}

export interface CommandResult {
  ok: boolean;
  entityId?: string;
  version?: number;
  status?: string;
  message: string;
  taskIds?: string[];
  eventIds?: string[];
  code?: string;
  fieldErrors?: Record<string, string>;
  nextAction?: string;
}
