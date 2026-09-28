import type { EventCode } from "@/lib/contracts/domain";

// Versioned rule configuration. Every rule carries an id, version, source, dates,
// benefit, conditions, outcome, owner and approval status. A decision stores the
// snapshot of the rules it used. Nexa settings are synthetic demo assumptions.

export interface Rule {
  id: string;
  version: string;
  title: string;
  source: string;
  sourceKind: "federal" | "nexa_policy" | "carrier_demo_config" | "payroll_policy";
  effectiveFrom: string;
  effectiveTo: string | null;
  benefits: string;
  conditions: string;
  outcome: string;
  owner: string;
  approvalStatus: "approved_for_demo";
}

export const RULES: Rule[] = [
  {
    id: "R-SE-30",
    version: "2026.1",
    title: "Standard special-enrollment request window",
    source: "Nexa Section 125 & Benefits Plan (synthetic) §4.2; federal floor 29 CFR 2590.701-6",
    sourceKind: "nexa_policy",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical; dental and vision mirror by Nexa demo rule",
    conditions: "Birth, adoption, placement for adoption, marriage, ordinary qualifying loss of other coverage",
    outcome: "Request by event date + 30 calendar days, through the end of that local date (America/New_York). Later requests go to HR timing review, never automatic denial.",
    owner: "Nexa plan administrator",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-SE-60",
    version: "2026.1",
    title: "Medicaid/CHIP loss and premium-assistance window",
    source: "29 CFR 2590.701-6(d); DOL HIPAA FAQs",
    sourceKind: "federal",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical",
    conditions: "Loss of Medicaid/CHIP eligibility, or eligibility for premium assistance",
    outcome: "Request by event date + 60 calendar days. Does not apply to other loss events.",
    owner: "Nexa plan administrator",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-EFF-BIRTH",
    version: "2026.1",
    title: "Birth, adoption and placement effective date",
    source: "29 CFR 2590.701-6(c)(4)",
    sourceKind: "federal",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical; dental and vision mirror by Nexa demo rule",
    conditions: "Timely birth, adoption or placement request",
    outcome: "Coverage starts on the date of birth, adoption or placement — per child. Not the approval date and not the next month.",
    owner: "Nexa plan administrator",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-EFF-LOSS",
    version: "2026.1",
    title: "Ordinary loss effective date",
    source: "Nexa Plan (synthetic) §4.4; federal floor 29 CFR 2590.701-6(c)(3)",
    sourceKind: "nexa_policy",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical; dental and vision mirror by Nexa demo rule",
    conditions: "Qualifying loss of other coverage",
    outcome: "First day of the month after the complete request is received.",
    owner: "Nexa plan administrator",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-ADV-LOSS",
    version: "2026.1",
    title: "Documented advance loss request (Nexa policy)",
    source: "Nexa Plan (synthetic) §4.5 — not a universal federal requirement",
    sourceKind: "nexa_policy",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical, dental, vision",
    conditions: "Request received on or before the documented outside coverage-end date, within 30 days before it",
    outcome: "Nexa coverage starts the day after the outside coverage ends.",
    owner: "Nexa plan administrator",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-DIV-END",
    version: "2026.1",
    title: "Former-spouse coverage end date",
    source: "Nexa Plan (synthetic) §5.1 — demo plan term, not federal law",
    sourceKind: "nexa_policy",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical, dental, vision",
    conditions: "Final divorce; former spouse currently covered under Nexa",
    outcome: "Coverage ends on the last day of the month in which the divorce became final. Remaining family tier applies from the first of the next month. Report within 30 days (reporting target, not a HIPAA addition deadline).",
    owner: "Nexa plan administrator",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-LOSS-QUAL",
    version: "2026.1",
    title: "Qualifying loss of other coverage",
    source: "29 CFR 2590.701-6(b); DOL HIPAA FAQs",
    sourceKind: "federal",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical",
    conditions: "Loss of eligibility (job end, hours, divorce, death, dependent status, service area), employer contribution ending, or COBRA exhaustion",
    outcome: "Nonpayment, voluntary cancellation, early COBRA cancellation and plan-coverage termination for fraud are not ordinary qualifying loss — route to review. A job dismissal for cause is not the plan-fraud exclusion.",
    owner: "Nexa plan administrator",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-EVID",
    version: "2026.1",
    title: "Evidence and correction target",
    source: "Nexa Plan (synthetic) §6 — administrative target, not a legal cure period",
    sourceKind: "nexa_policy",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "All",
    conditions: "Request meets minimum intake; evidence missing or needs correction",
    outcome: "Evidence may follow. Correction target: 5 calendar days. Missing it creates an HR decision task, not an automatic denial.",
    owner: "Nexa HR",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-JUR",
    version: "2026.1",
    title: "Jurisdiction suitability",
    source: "Nexa configuration — federal baseline only; no state pack implemented",
    sourceKind: "nexa_policy",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "All",
    conditions: "Demo profile: private sponsor, fully insured, policy state NY, work state NY, residence NY",
    outcome: "Jurisdiction suitability assumed for synthetic demonstration. A new or conflicting state creates State rule review required and blocks automated execution until an authorized review is recorded.",
    owner: "Benefits counsel (synthetic)",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-S125",
    version: "2026.1",
    title: "Section 125 consistency",
    source: "Nexa Section 125 Plan (synthetic) §3; 26 CFR 1.125-4",
    sourceKind: "nexa_policy",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical, dental, vision",
    conditions: "Mid-year pretax election change",
    outcome: "Change must be consistent with the event. A removal does not permit unrelated cancellation or plan changes.",
    owner: "Nexa plan administrator",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-PAY",
    version: "2026.1",
    title: "Payroll adjustment policy",
    source: "Nexa Payroll Policy (synthetic) §2",
    sourceKind: "payroll_policy",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "All",
    conditions: "Approved change with matching carrier evidence",
    outcome: "Monthly obligation = per-paycheck contribution × 2, prorated daily over actual days for mid-month changes, rounded once per month. Catch-up = obligation − posted deductions. Adjustments and refunds need payroll authorization.",
    owner: "Nexa payroll",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-COBRA",
    version: "2026.1",
    title: "Continuation handoff",
    source: "DOL COBRA employer guide; Nexa TPA agreement (synthetic)",
    sourceKind: "nexa_policy",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical, dental, vision",
    conditions: "Divorce or legal separation ends a covered spouse's Nexa coverage",
    outcome: "Create a referral task immediately. The TPA owns notices, elections and premiums. Missing trigger facts show 'Deadline needs verification'.",
    owner: "Nexa HR",
    approvalStatus: "approved_for_demo",
  },
  {
    id: "R-834",
    version: "2026.1",
    title: "Carrier delivery schedule",
    source: "Carrier demo configuration — fictional, not Aetna's schedule",
    sourceKind: "carrier_demo_config",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    benefits: "Medical (EDI 834); dental/vision (simulated API)",
    conditions: "Approved change order",
    outcome: "Nightly batch: cutoff 9:45 p.m., send 10:00 p.m. America/New_York.",
    owner: "Nexa HR operations",
    approvalStatus: "approved_for_demo",
  },
];

export const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));
export const ruleRef = (id: string) => ({ id, version: RULE_BY_ID.get(id)?.version ?? "unknown" });

// ---- Event catalogue: employee language → canonical event code ----
export interface EventChoice {
  code: EventCode;
  label: string;
  hint?: string;
  handling: "deep" | "assisted";
  group?: string;
}
export interface EventTile {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
}

export const EVENT_TILES: EventTile[] = [
  {
    id: "family",
    title: "Family changes",
    description: "Marriage, a new child, separation, or the loss of a family member.",
    choices: [
      { code: "birth", label: "Birth", group: "Welcome a child", handling: "deep" },
      { code: "adoption", label: "Adoption", group: "Welcome a child", handling: "deep" },
      { code: "placement_for_adoption", label: "Placement for adoption", group: "Welcome a child", handling: "deep" },
      { code: "marriage", label: "Marriage", handling: "assisted" },
      { code: "divorce", label: "Divorce (final)", hint: "Remove a former spouse, or report lost coverage", handling: "deep" },
      { code: "legal_separation", label: "Legal separation", hint: "Assessed separately from divorce", handling: "assisted" },
      { code: "dependent_death", label: "A covered family member passed away", handling: "assisted" },
    ],
  },
  {
    id: "other_coverage",
    title: "Other health coverage",
    description: "Coverage for you or a family member has changed.",
    choices: [{ code: "loss_of_other_coverage", label: "Coverage from another plan ended", hint: "We'll ask who lost coverage and why", handling: "deep" }],
  },
  {
    id: "work",
    title: "Work and leave",
    description: "Employment, working hours, or leave affected benefits.",
    choices: [
      { code: "employment_change", label: "Status or hours changed", handling: "assisted" },
      { code: "leave", label: "Leave or return from leave", handling: "assisted" },
    ],
  },
  {
    id: "dependent",
    title: "Dependent eligibility",
    description: "Age, dependency, guardianship, or a legal order changed.",
    choices: [
      { code: "dependent_age_off", label: "A dependent is reaching the age limit", handling: "assisted" },
      { code: "disability_extension_review", label: "Continued coverage for a dependent with a disability", handling: "assisted" },
      { code: "court_order", label: "Custody or medical child-support order", handling: "assisted" },
      { code: "guardianship_foster", label: "Guardianship or foster placement", hint: "Not the same as placement for adoption", handling: "assisted" },
    ],
  },
  {
    id: "plan_cost",
    title: "Plan and cost changes",
    description: "Available benefits, contributions, or enrollment options changed.",
    choices: [
      { code: "cost_or_coverage_change", label: "Significant cost or coverage change", handling: "assisted" },
      { code: "other_employer_oe", label: "Another employer's different enrollment period", handling: "assisted" },
      { code: "marketplace_transition", label: "Permitted Marketplace transition", handling: "assisted" },
    ],
  },
  {
    id: "government",
    title: "Government coverage",
    description: "Medicaid, CHIP, Medicare, or related coverage changed.",
    choices: [
      { code: "medicaid_chip_loss", label: "Lost Medicaid or CHIP eligibility", hint: "Uses a separate 60-day window", handling: "assisted" },
      { code: "premium_assistance", label: "Became eligible for premium assistance", hint: "Uses a separate 60-day window", handling: "assisted" },
      { code: "medicare_medicaid_entitlement", label: "Medicare or Medicaid entitlement", handling: "assisted" },
    ],
  },
];

export const EVENT_LABEL: Record<EventCode, string> = {
  birth: "Birth of a child",
  adoption: "Adoption",
  placement_for_adoption: "Placement for adoption",
  marriage: "Marriage",
  divorce: "Divorce",
  legal_separation: "Legal separation",
  dependent_death: "Covered family member passed away",
  loss_of_other_coverage: "Loss of other coverage",
  medicaid_chip_loss: "Medicaid or CHIP loss",
  premium_assistance: "Premium assistance eligibility",
  employment_change: "Employment or hours change",
  leave: "Leave or return",
  dependent_age_off: "Dependent age limit",
  disability_extension_review: "Disability extension review",
  court_order: "Court or support order",
  guardianship_foster: "Guardianship or foster placement",
  cost_or_coverage_change: "Cost or coverage change",
  other_employer_oe: "Other employer enrollment period",
  marketplace_transition: "Marketplace transition",
  medicare_medicaid_entitlement: "Medicare or Medicaid entitlement",
  not_sure: "Not sure — HR help requested",
};

export const DEEP_EVENTS: EventCode[] = ["birth", "adoption", "placement_for_adoption", "divorce", "loss_of_other_coverage"];

export const LOSS_REASON_LABEL: Record<string, string> = {
  employment_ended: "Employment ended",
  hours_reduced: "Hours were reduced",
  divorce_separation: "Divorce or separation ended the coverage",
  policyholder_died: "The person whose plan covered us passed away",
  dependent_eligibility_ended: "Dependent eligibility ended",
  employer_contribution_ended: "The other employer stopped contributing",
  cobra_exhausted: "COBRA coverage was exhausted",
  cobra_cancelled_early: "COBRA was cancelled early",
  nonpayment: "Coverage ended for nonpayment",
  voluntary_cancellation: "Coverage was cancelled voluntarily",
  fraud_termination: "The plan ended coverage for fraud or misrepresentation",
  other_involuntary: "Other involuntary loss",
};
