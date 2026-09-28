import type { Benefit, Cents, Tier } from "@/lib/contracts/domain";

// One source of truth for plans, rates and plan terms. Cards, comparisons, documents,
// calculations and Emma's knowledge are all generated from this file.
// Every figure is illustrative Nexa demo configuration — not verified Aetna pricing.

export const RATE_VERSION = "nexa-rates-2026.1";
export const RATE_EFFECTIVE = { from: "2026-01-01", to: "2026-12-31" };
export const DEDUCTIONS_PER_YEAR = 24;

export const TIER_LABEL: Record<Tier, string> = {
  EE: "Employee only",
  ES: "Employee + Spouse",
  EC: "Employee + Children",
  FAM: "Family",
};

export interface PlanTerm {
  label: string;
  value: string;
}

export interface Plan {
  id: string;
  benefit: Benefit;
  carrierId: string;
  name: string;
  shortName: string;
  network: string;
  employeeCents: Record<Tier, Cents>; // per semi-monthly paycheck
  premiumCents: Record<Tier, Cents>; // total illustrative premium per paycheck
  terms: PlanTerm[];
  limitations: string[];
  docId: string;
}

const t = (ee: number, es: number, ec: number, fam: number): Record<Tier, Cents> => ({
  EE: ee * 100,
  ES: es * 100,
  EC: ec * 100,
  FAM: fam * 100,
});

export const PLANS: Plan[] = [
  {
    id: "aetna_standard",
    benefit: "medical",
    carrierId: "aetna_demo",
    name: "Aetna Standard Medical — illustrative",
    shortName: "Aetna Standard",
    network: "Illustrative national PPO-style network. Verify any provider with the carrier.",
    employeeCents: t(150, 300, 250, 400),
    premiumCents: t(450, 800, 750, 1100),
    terms: [
      { label: "Deductible", value: "$1,500 individual / $3,000 family" },
      { label: "Out-of-pocket maximum", value: "$5,000 individual / $10,000 family" },
      { label: "Primary care copay", value: "$25" },
      { label: "Specialist copay", value: "$50" },
      { label: "In-network preventive care", value: "$0 (illustrative)" },
      { label: "Coinsurance", value: "20% after applicable deductible (modeled services)" },
    ],
    limitations: [
      "Invented demonstration terms, not a verified Aetna product.",
      "No provider-network, prescription-price, accumulator-transfer or claim-payment guarantee.",
    ],
    docId: "doc_medical_standard",
  },
  {
    id: "aetna_plus",
    benefit: "medical",
    carrierId: "aetna_demo",
    name: "Aetna Plus Medical — illustrative",
    shortName: "Aetna Plus",
    network: "Illustrative national PPO-style network. Verify any provider with the carrier.",
    employeeCents: t(200, 375, 325, 475),
    premiumCents: t(600, 1000, 900, 1350),
    terms: [
      { label: "Deductible", value: "$750 individual / $1,500 family" },
      { label: "Out-of-pocket maximum", value: "$3,500 individual / $7,000 family" },
      { label: "Primary care copay", value: "$20" },
      { label: "Specialist copay", value: "$40" },
      { label: "In-network preventive care", value: "$0 (illustrative)" },
      { label: "Coinsurance", value: "10% after applicable deductible (modeled services)" },
    ],
    limitations: [
      "Invented demonstration terms, not a verified Aetna product.",
      "No provider-network, prescription-price, accumulator-transfer or claim-payment guarantee.",
    ],
    docId: "doc_medical_plus",
  },
  {
    id: "nexa_dental",
    benefit: "dental",
    carrierId: "clearview_dv",
    name: "Nexa Dental — illustrative",
    shortName: "Nexa Dental",
    network: "Fictional Clearview dental network.",
    employeeCents: t(12, 24, 26, 38),
    premiumCents: t(30, 60, 65, 95),
    terms: [
      { label: "Deductible", value: "$50 individual / $150 family" },
      { label: "Annual covered-service maximum", value: "$1,500 per person" },
      { label: "Preventive services", value: "100%" },
      { label: "Basic services", value: "80% after deductible" },
      { label: "Major services", value: "50% after deductible" },
      { label: "Orthodontia", value: "Not included in this sample" },
    ],
    limitations: ["A dental benefit maximum is not a medical out-of-pocket maximum."],
    docId: "doc_dental_vision",
  },
  {
    id: "nexa_vision",
    benefit: "vision",
    carrierId: "clearview_dv",
    name: "Nexa Vision — illustrative",
    shortName: "Nexa Vision",
    network: "Fictional Clearview vision network.",
    employeeCents: t(4, 8, 8, 12),
    premiumCents: t(10, 20, 20, 30),
    terms: [
      { label: "Exam copay", value: "$10 once per 12 months" },
      { label: "Frame allowance", value: "$150 once per 24 months" },
      { label: "Contact lenses", value: "$150 allowance instead of frames, once per 12 months" },
    ],
    limitations: ["Illustrative in-network terms, not provider promises."],
    docId: "doc_dental_vision",
  },
];

export const PLAN_BY_ID = new Map(PLANS.map((p) => [p.id, p]));
export function plan(id: string): Plan {
  const p = PLAN_BY_ID.get(id);
  if (!p) throw new Error(`Unknown plan ${id}`);
  return p;
}
export function plansFor(benefit: Benefit): Plan[] {
  return PLANS.filter((p) => p.benefit === benefit);
}
export function employeeCost(planId: string, tier: Tier): Cents {
  return plan(planId).employeeCents[tier];
}
export function employerCost(planId: string, tier: Tier): Cents {
  const p = plan(planId);
  return p.premiumCents[tier] - p.employeeCents[tier];
}

export const CARRIERS = [
  { id: "aetna_demo", name: "Aetna-labeled medical carrier (simulated)", groupNumber: "NX-AET-2026", benefits: ["medical"] as Benefit[], route: "edi_834" as const },
  { id: "clearview_dv", name: "Clearview Dental & Vision (fictional, simulated)", groupNumber: "CVW-NEXA-01", benefits: ["dental", "vision"] as Benefit[], route: "api" as const },
];

export const OPEN_ENROLLMENT = {
  window: { from: "2026-11-01", to: "2026-11-15" },
  coverageStarts: "2027-01-01",
};
