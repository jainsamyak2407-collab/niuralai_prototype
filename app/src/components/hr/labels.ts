import type {
  CheckResult,
  CobraState,
  CoverageState,
  DeliveryState,
  EvidenceFile,
  PayrollState,
  ProposedLine,
  Relationship,
  TaskKind,
} from "@/lib/contracts/domain";
import type { Tone } from "@/components/ui/primitives";

// Plain-language labels and pill tones for HR and broker screens. One place, so the
// same state reads the same way on every page.

export const CHECK_RESULT: Record<CheckResult, { label: string; tone: Tone }> =
  {
    passed: { label: "Passed", tone: "green" },
    needs_information: { label: "Needs information", tone: "amber" },
    needs_review: { label: "Needs review", tone: "blue" },
    not_applicable: { label: "Not applicable", tone: "gray" },
  };

export const DELIVERY: Record<DeliveryState, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "gray" },
  sent: { label: "Sent", tone: "blue" },
  receipt_unknown: { label: "Delivery unknown", tone: "amber" },
  acknowledged: { label: "Receipt acknowledged", tone: "green" },
  file_rejected: { label: "File rejected", tone: "red" },
  record_rejected: { label: "Record rejected", tone: "red" },
};

export const MEMBER_RESULT: Record<
  "pending" | "accepted" | "rejected" | "info_requested",
  { label: string; tone: Tone }
> = {
  pending: { label: "Pending", tone: "gray" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  info_requested: { label: "Carrier asked for info", tone: "amber" },
};

export const COVERAGE: Record<CoverageState, { label: string; tone: Tone }> = {
  awaiting_confirmation: { label: "Awaiting carrier", tone: "gray" },
  confirmed_future: { label: "Confirmed (future)", tone: "green" },
  confirmed_current: { label: "Confirmed", tone: "green" },
  end_confirmed: { label: "End confirmed", tone: "green" },
  mismatch: { label: "Mismatch", tone: "red" },
};

export const PAYROLL: Record<PayrollState, { label: string; tone: Tone }> = {
  preview: { label: "Preview", tone: "gray" },
  blocked: { label: "Blocked", tone: "red" },
  approval_needed: { label: "Needs authorization", tone: "amber" },
  scheduled: { label: "Scheduled", tone: "blue" },
  instruction_accepted: { label: "Accepted by payroll", tone: "blue" },
  posted: { label: "Posted", tone: "green" },
  mismatch: { label: "Posted amount differs", tone: "red" },
  verified_no_change: { label: "Verified, no change", tone: "green" },
};

export const COBRA: Record<CobraState, { label: string; tone: Tone }> = {
  not_applicable: { label: "Not applicable", tone: "gray" },
  review_needed: { label: "Review needed", tone: "amber" },
  referral_ready: { label: "Ready to send", tone: "amber" },
  sent: { label: "Sent, awaiting receipt", tone: "blue" },
  received: { label: "Receipt confirmed", tone: "green" },
  notice_tracked: { label: "Notice tracked", tone: "green" },
  exception: { label: "Exception", tone: "red" },
};

export const EVIDENCE_STATUS: Record<
  EvidenceFile["status"],
  { label: string; tone: Tone }
> = {
  uploading: { label: "Uploading", tone: "gray" },
  reading: { label: "Reading", tone: "gray" },
  needs_confirmation: { label: "Needs employee confirmation", tone: "amber" },
  accepted_for_review: { label: "Ready for HR review", tone: "blue" },
  unreadable: { label: "Unreadable", tone: "amber" },
  rejected: { label: "Not accepted", tone: "red" },
};

export const READ_MODE: Record<
  NonNullable<EvidenceFile["readMode"]>,
  string
> = {
  model: "Read by AI model (proposed facts only)",
  fixture_hash: "Matched a known synthetic fixture",
  manual: "Manual review",
};

export const ACTION: Record<ProposedLine["action"], string> = {
  add: "Add coverage",
  terminate: "End coverage",
  tier_change: "Change coverage level",
};

export const RELATIONSHIP: Record<Relationship, string> = {
  self: "Employee",
  spouse: "Spouse",
  former_spouse: "Former spouse",
  child: "Child",
};

export const TASK_KIND: Record<TaskKind, string> = {
  hr_review: "HR review",
  information_request: "Information request",
  evidence_follow_up: "Evidence follow-up",
  specialist_review: "Specialist review",
  coverage_mismatch: "Coverage mismatch",
  record_rejected: "Record rejected",
  delivery_investigation: "Delivery investigation",
  carrier_silence: "Carrier silence",
  broker_correction: "Broker correction",
  payroll_authorization: "Payroll authorization",
  payroll_mismatch: "Payroll mismatch",
  cobra_referral: "COBRA referral",
  cobra_silence: "COBRA receipt",
  contact_verification: "Contact verification",
  ssn_follow_up: "SSN follow-up",
  urgent_support: "Urgent support",
  alternate_contact: "Alternate contact",
};

/** Task kinds HR may close by hand. Every other kind closes when its record resolves. */
export const MANUAL_TASK_KINDS: TaskKind[] = [
  "contact_verification",
  "urgent_support",
  "alternate_contact",
  "specialist_review",
  "evidence_follow_up",
  "carrier_silence",
];

export const BENEFIT: Record<"medical" | "dental" | "vision", string> = {
  medical: "Medical",
  dental: "Dental",
  vision: "Vision",
};

export const ROUTE: Record<"edi_834" | "api" | "manual", string> = {
  edi_834: "834 file",
  api: "Carrier API",
  manual: "Broker portal",
};

export function humanize(s: string): string {
  const t = s.replaceAll("_", " ").replaceAll(".", " · ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Owner names for display; seeded background owners without a directory entry read as a role. */
export function displayOwner(name: string): string {
  return /^u_bg_|^u_orbit/.test(name)
    ? name.includes("employee")
      ? "Employee (background case)"
      : "Other employer HR"
    : name;
}
