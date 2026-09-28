import type { CarrierBatch, CarrierTxn, CobraState, FailurePreset, PayrollState } from "@/lib/contracts/domain";
import type { Tone } from "@/components/ui/primitives";

// Plain-language labels and tones for simulator states. Pure data, safe on server and client.

export const TRANSPORT: Record<CarrierBatch["transport"], { label: string; tone: Tone }> = {
  pending: { label: "Awaiting receipt", tone: "amber" },
  received: { label: "Received", tone: "green" },
  unknown: { label: "Outcome unknown", tone: "red" },
  not_received: { label: "Not received", tone: "red" },
};

export const FILE_VALIDATION: Record<CarrierBatch["fileValidation"], { label: string; tone: Tone }> = {
  pending: { label: "Not validated", tone: "gray" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

export const MEMBER_RESULT: Record<CarrierTxn["memberResult"], { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "gray" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  info_requested: { label: "Information requested", tone: "amber" },
};

export const DELIVERY: Record<CarrierTxn["delivery"], { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "gray" },
  sent: { label: "Sent", tone: "blue" },
  receipt_unknown: { label: "Delivery unknown", tone: "red" },
  acknowledged: { label: "Received", tone: "blue" },
  file_rejected: { label: "File rejected", tone: "red" },
  record_rejected: { label: "Record rejected", tone: "red" },
};

export const INSTRUCTION: Record<PayrollState, { label: string; tone: Tone }> = {
  preview: { label: "Preview", tone: "gray" },
  blocked: { label: "Blocked", tone: "red" },
  approval_needed: { label: "Waiting for HR authorization", tone: "amber" },
  scheduled: { label: "Authorized, not applied", tone: "blue" },
  instruction_accepted: { label: "Applied, not posted", tone: "blue" },
  posted: { label: "Posted", tone: "green" },
  mismatch: { label: "Mismatch", tone: "red" },
  verified_no_change: { label: "Verified, no change", tone: "green" },
};

export const COBRA: Record<CobraState, { label: string; tone: Tone }> = {
  not_applicable: { label: "Not applicable", tone: "gray" },
  review_needed: { label: "HR review needed", tone: "amber" },
  referral_ready: { label: "Not sent by HR yet", tone: "amber" },
  sent: { label: "Sent, not acknowledged", tone: "blue" },
  received: { label: "Receipt acknowledged", tone: "green" },
  notice_tracked: { label: "Notice recorded", tone: "green" },
  exception: { label: "Information requested", tone: "red" },
};

export const PRESETS: { id: FailurePreset; title: string; description: string }[] = [
  { id: "none", title: "No failure", description: "Simulated systems respond normally, using the values in each file or request." },
  {
    id: "carrier_wrong_start_date",
    title: "Carrier applies the wrong start date",
    description: "The next published carrier result starts coverage on the first of the following month instead of the requested date. Reconciliation should flag the mismatch.",
  },
  {
    id: "carrier_reject_one_record",
    title: "Carrier rejects one child record",
    description: "When accepted records are next published, the last added child is rejected. Other records still succeed and must not roll back.",
  },
  { id: "transport_unknown", title: "Transport outcome unknown", description: "The next batch times out. HR must run a status inquiry before anything is resent." },
  {
    id: "payroll_different_amount",
    title: "Payroll posts a different amount",
    description: "The next pay run posts a deduction that differs from the accepted instruction. Payroll stays unresolved while coverage stays confirmed.",
  },
  { id: "dental_failure", title: "Dental API rejects the record", description: "The next dental request through the simulated API is rejected. Medical keeps its own result." },
];

export const presetTitle = (p: FailurePreset) => PRESETS.find((x) => x.id === p)?.title ?? p;

export const RELATIONSHIP: Record<string, string> = { self: "Subscriber", spouse: "Spouse", former_spouse: "Former spouse", child: "Child" };

export const ROLE_LABEL: Record<string, string> = {
  employee: "Employee",
  hr_admin: "HR admin",
  broker: "Broker",
  carrier_operator: "Carrier operator",
  cobra_admin: "COBRA administrator",
  demo_operator: "Demo operator",
};
