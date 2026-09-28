import type { Benefit, CoverageState, EvidenceStatus, PayrollState, TimingStatus } from "@/lib/contracts/domain";
import type { Tone } from "@/components/ui/primitives";

// Employee-facing labels. Plain language only; no EDI or internal terms.

export const BENEFIT_LABEL: Record<Benefit, string> = { medical: "Medical", dental: "Dental", vision: "Vision" };

export const EVIDENCE_STATUS: Record<EvidenceStatus, { label: string; tone: Tone }> = {
  uploading: { label: "Uploading", tone: "blue" },
  reading: { label: "Reading", tone: "blue" },
  needs_confirmation: { label: "Needs confirmation", tone: "amber" },
  accepted_for_review: { label: "Accepted for review", tone: "green" },
  unreadable: { label: "Unreadable", tone: "red" },
  rejected: { label: "File rejected", tone: "red" },
};

export const READ_MODE: Record<"model" | "fixture_hash" | "manual", string> = {
  model: "Read by AI model — check each value",
  fixture_hash: "Synthetic fixture parsing (hash match)",
  manual: "Manual review — HR will read this document",
};

export const COVERAGE_STATE: Record<CoverageState, { label: string; tone: Tone }> = {
  awaiting_confirmation: { label: "Waiting for provider", tone: "blue" },
  confirmed_future: { label: "Confirmed", tone: "green" },
  confirmed_current: { label: "Confirmed", tone: "green" },
  end_confirmed: { label: "End date confirmed", tone: "green" },
  mismatch: { label: "Being corrected", tone: "amber" },
};

export const PAYROLL_STATE: Record<PayrollState, { label: string; tone: Tone }> = {
  preview: { label: "Estimate", tone: "gray" },
  blocked: { label: "On hold", tone: "amber" },
  approval_needed: { label: "Waiting for payroll approval", tone: "amber" },
  scheduled: { label: "Approved scheduled change", tone: "blue" },
  instruction_accepted: { label: "Approved scheduled change", tone: "blue" },
  posted: { label: "Posted", tone: "green" },
  mismatch: { label: "Being checked", tone: "amber" },
  verified_no_change: { label: "No change needed", tone: "green" },
};

export const LINE_ACTION: Record<"add" | "terminate" | "tier_change", string> = {
  add: "Add coverage",
  terminate: "End coverage",
  tier_change: "Coverage level change",
};

export const TIER_LABEL: Record<"EE" | "ES" | "EC" | "FAM", string> = {
  EE: "Employee only",
  ES: "Employee + Spouse",
  EC: "Employee + Children",
  FAM: "Family",
};

export function timingTone(status: TimingStatus): "info" | "warning" {
  return status === "within_window" || status === "advance_request" || status === "unknown" ? "info" : "warning";
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const WIZARD_STEPS = (id: string) => [
  { label: "What happened", href: `/employee/life-events/${id}/details` },
  { label: "Documents", href: `/employee/life-events/${id}/evidence` },
  { label: "Benefit changes", href: `/employee/life-events/${id}/options` },
  { label: "Review", href: `/employee/life-events/${id}/review` },
  { label: "Track", href: `/employee/cases/${id}` },
];

/** Events handled by the full rules engine; everything else goes to assisted HR review. */
export const ADDITION_EVENTS = ["birth", "adoption", "placement_for_adoption"] as const;
export const isAddition = (code: string) => (ADDITION_EVENTS as readonly string[]).includes(code);
