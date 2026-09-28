import type { SourceRef } from "@/lib/contracts/ai";
import type { Benefit, Tier } from "@/lib/contracts/domain";
import { fmtDateLong } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { NEXA } from "@/server/config/identities";
import { PAYSLIP_FIXTURE, payCalendar } from "@/server/config/payroll";
import { DEDUCTIONS_PER_YEAR, OPEN_ENROLLMENT, PLANS, plan, RATE_EFFECTIVE, RATE_VERSION, TIER_LABEL } from "@/server/config/plans";
import { EVENT_TILES, RULES, type Rule } from "@/server/config/rules";

// Emma's knowledge pack: a small indexed collection generated from the same config the
// app uses (plans, rates, rules, calendar, event catalogue). No vector database; keyword
// retrieval is enough for this corpus. The benefits guide PDF renders GUIDE_SECTIONS, so
// Emma and the downloads never disagree.

export interface KnowledgeChunk extends SourceRef {
  id: string;
  employerId: string | null; // null = applies to every employer (federal guidance)
  effectiveTo: string | null;
  text: string;
}

const TIERS: Tier[] = ["EE", "ES", "EC", "FAM"];
const GUIDE_VERSION = "2026.1";
const tierList = (cents: Record<Tier, number>) => TIERS.map((t) => `${TIER_LABEL[t]} ${fmtMoney(cents[t])}`).join("; ");

const RULE_KIND: Record<Rule["sourceKind"], SourceRef["kind"]> = {
  federal: "federal_guidance",
  nexa_policy: "nexa_policy",
  carrier_demo_config: "carrier_demo_config",
  payroll_policy: "nexa_policy",
};

/** Plain-language guide sections. Rendered into the Nexa benefits guide PDF and indexed for Emma. */
export const GUIDE_SECTIONS: { section: string; text: string }[] = [
  {
    section: "When you can change benefits",
    text: `Nexa open enrollment runs ${fmtDateLong(OPEN_ENROLLMENT.window.from, true)} to ${fmtDateLong(OPEN_ENROLLMENT.window.to, true)}; open-enrollment elections start ${fmtDateLong(OPEN_ENROLLMENT.coverageStarts, true)}. Between open enrollments, a mid-year change needs a qualifying life event, and the change must be consistent with that event (rule R-S125). A removal does not permit unrelated cancellation or plan changes.`,
  },
  {
    section: "Life events you can report",
    text: `Report a life event from Benefits. Categories: ${EVENT_TILES.map((t) => `${t.title} (${t.choices.map((c) => c.label).join(", ")})`).join("; ")}. Birth, adoption, placement for adoption, divorce and loss of other coverage have a guided request. Other events go to assisted review with HR. These are intake categories, not promises that every answer grants a special-enrollment right. If you are not sure which applies, ask HR for help.`,
  },
  {
    section: "What is not automatically a qualifying event",
    text: "HR reviews these; they are not approved automatically: changing your mind; pregnancy before the birth (you can prepare a draft now, but submit the birth request after the child is born); illness alone; a preferred doctor leaving the network; voluntary cancellation of other coverage alone; other coverage ending for nonpayment alone. A late report is not an invalid life event; it becomes an HR timing review.",
  },
  {
    section: "Request windows",
    text: "Birth, adoption, placement, marriage and ordinary loss of other coverage: request within 30 calendar days of the event (rule R-SE-30). Loss of Medicaid or CHIP eligibility, or becoming eligible for premium assistance: 60 days (rule R-SE-60). Divorce: report within 30 days (a reporting target, rule R-DIV-END). Windows end at the end of the local date in America/New_York. Late requests go to HR review, never an automatic denial.",
  },
  {
    section: "Documents and evidence",
    text: "Upload a PDF, JPEG or PNG up to 10 MB. Evidence may follow the request; Nexa's correction target is 5 calendar days (rule R-EVID), an administrative target, not a legal cure period. AI or synthetic reading proposes values that you confirm; reading a document does not verify it. HR reviews every document. Malware scanning is not configured in this demo.",
  },
  {
    section: "After you submit",
    text: "HR reviews your request and may ask for information. After approval, the change goes to the insurance provider in the nightly update; the provider's record, not the approval, confirms coverage. Payroll changes your deduction only after coverage is confirmed and payroll is authorized. Your request is complete when coverage and pay both match the approved change.",
  },
  {
    section: "Continuation coverage (COBRA) boundary",
    text: "When a divorce or legal separation ends a covered spouse's Nexa coverage, HR sends a referral to the continuation administrator (rule R-COBRA). The administrator owns notices, elections and premiums. Nexa and Emma do not decide continuation elections or deadlines, and the former spouse's choices, payments and address stay private.",
  },
  {
    section: "Coverage history for reporting (ACA) boundary",
    text: "Nexa keeps coverage periods and contribution references as history for reporting. This demo does not prepare or file ACA forms and does not decide affordability.",
  },
  {
    section: "What Emma can and cannot do",
    text: "Emma explains Nexa's rules, plans and your own request from approved synthetic documents and cites them. Emma cannot approve or decline a request, decide eligibility, change coverage, post payroll, or promise coverage, claim payment, provider network availability or the cheapest annual cost. HR makes decisions.",
  },
];

function baseChunks(): KnowledgeChunk[] {
  const out: KnowledgeChunk[] = [];
  const nexa = NEXA.id;
  const rates = { version: RATE_VERSION, effectiveDate: RATE_EFFECTIVE.from, effectiveTo: RATE_EFFECTIVE.to, employerId: nexa };
  for (const p of PLANS) {
    const title = p.benefit === "medical" ? `${p.name} summary` : "Nexa Dental and Vision — illustrative summary";
    out.push({
      id: `${p.id}:rates`,
      docId: p.docId,
      title,
      section: `${p.shortName} contributions per paycheck`,
      kind: "nexa_policy",
      ...rates,
      text: `${p.name}. Employee contribution per semi-monthly paycheck: ${tierList(p.employeeCents)}. Total illustrative premium per paycheck: ${tierList(p.premiumCents)}. Nexa pays the difference. ${DEDUCTIONS_PER_YEAR} deductions per year. Illustrative Nexa demo rates, not verified carrier pricing.`,
    });
    out.push({
      id: `${p.id}:terms`,
      docId: p.docId,
      title,
      section: `${p.shortName} plan terms`,
      kind: "carrier_demo_config",
      ...rates,
      text: `${p.name} terms: ${p.terms.map((t) => `${t.label}: ${t.value}`).join("; ")}. Network: ${p.network} ${p.limitations.join(" ")}`,
    });
  }
  for (const r of RULES) {
    out.push({
      id: `rule:${r.id}`,
      docId: "doc_election_rules",
      title: "Nexa election rules",
      section: `${r.id} ${r.title}`,
      version: r.version,
      effectiveDate: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      kind: RULE_KIND[r.sourceKind],
      employerId: r.sourceKind === "federal" ? null : nexa,
      text: `${r.title}. Applies to: ${r.conditions}. Outcome: ${r.outcome} Benefits: ${r.benefits}. Source: ${r.source}.`,
    });
  }
  for (const g of GUIDE_SECTIONS) {
    out.push({ id: `guide:${g.section}`, docId: "doc_benefits_guide", title: "Nexa benefits guide", section: g.section, version: GUIDE_VERSION, effectiveDate: "2026-01-01", effectiveTo: "2026-12-31", kind: "nexa_policy", employerId: nexa, text: g.text });
  }
  const runs = payCalendar();
  out.push({
    id: "payroll:calendar",
    docId: "doc_payroll_policy",
    title: "Nexa payroll policy",
    section: "Paydays and cutoffs",
    version: "2026.1",
    effectiveDate: "2026-01-01",
    effectiveTo: "2026-12-31",
    kind: "nexa_policy",
    employerId: nexa,
    text: `Paydays are the 15th and the last business day of the month (the prior business day when that falls on a weekend). Payroll cutoff is 5:00 p.m. ET three calendar days before payday. Paydays: ${runs.map((r) => fmtDateLong(r.payday, true)).join("; ")}.`,
  });
  out.push({
    id: "payroll:deductions",
    docId: "doc_payroll_policy",
    title: "Nexa payroll policy",
    section: "Deductions and adjustments",
    version: "2026.1",
    effectiveDate: "2026-01-01",
    effectiveTo: "2026-12-31",
    kind: "nexa_policy",
    employerId: nexa,
    text: `Benefit contributions are taken from ${DEDUCTIONS_PER_YEAR} paychecks a year. A full month's employee obligation is the per-paycheck contribution times 2. A mid-month change is prorated daily over the actual days in that month and rounded once per month. Catch-up equals the obligation minus deductions already posted; a refund is a proposal that needs authorization. The demo changes actual deductions only after matching carrier evidence and authorized payroll instructions. ${PAYSLIP_FIXTURE.note}`,
  });
  return out;
}

let cached: KnowledgeChunk[] | null = null;
export function knowledgePack(): KnowledgeChunk[] {
  cached ??= baseChunks();
  return cached;
}

/** Deterministic contribution preview ("calculation service") for the signed-in employee's current elections. */
export function estimateChunks(current: { benefit: Benefit; planId: string; tier: Tier }[], today: string): KnowledgeChunk[] {
  const out: KnowledgeChunk[] = [];
  for (const e of current) {
    const p = plan(e.planId);
    const now = p.employeeCents[e.tier];
    const alternatives = PLANS.filter((x) => x.benefit === e.benefit);
    const lines: string[] = [];
    for (const alt of alternatives) {
      for (const t of TIERS) {
        if (alt.id === e.planId && t === e.tier) continue;
        const diff = alt.employeeCents[t] - now;
        lines.push(`${alt.shortName}, ${TIER_LABEL[t]}: ${fmtMoney(alt.employeeCents[t])} per paycheck (${diff === 0 ? "no change" : `${fmtMoney(Math.abs(diff))} ${diff > 0 ? "more" : "less"} per paycheck, ${fmtMoney(Math.abs(diff) * 2)} ${diff > 0 ? "more" : "less"} per full month`})`);
      }
    }
    out.push({
      id: `estimate:${e.benefit}`,
      docId: "calc_contribution_preview",
      title: "Contribution preview (calculation)",
      section: `${e.benefit[0].toUpperCase()}${e.benefit.slice(1)} from your current election`,
      version: RATE_VERSION,
      effectiveDate: today,
      effectiveTo: null,
      kind: "estimate",
      employerId: NEXA.id,
      text: `Estimate, not a payroll posting. Your current ${p.shortName} election is ${TIER_LABEL[e.tier]} at ${fmtMoney(now)} per paycheck. Adding a child moves you to Employee + Children if only you are covered today. Other options: ${lines.join("; ")}. Mid-month starts are prorated; the exact first adjustment is calculated on your request.`,
    });
  }
  return out;
}

// ---------------- retrieval ----------------

const STOP = new Set("a an the and or of to in on for is are was be can i my me we you your our it this that what how when does do much many with from at by as if about any will would should could have has there their them please tell show".split(" "));
const SYNONYMS: Record<string, string[]> = {
  child: ["children", "birth", "adoption"],
  children: ["child"],
  kid: ["child", "children"],
  baby: ["child", "children", "birth"],
  newborn: ["child", "birth"],
  son: ["child"],
  daughter: ["child"],
  cost: ["contribution", "paycheck", "premium"],
  costs: ["contribution", "paycheck"],
  price: ["contribution", "premium"],
  pay: ["paycheck", "payroll", "deduction"],
  paycheck: ["contribution", "payroll"],
  deduction: ["payroll", "paycheck"],
  premium: ["contribution"],
  spouse: ["spouse"],
  husband: ["spouse"],
  wife: ["spouse"],
  deadline: ["window", "days"],
  late: ["window", "timing", "review"],
  window: ["days", "deadline"],
  divorce: ["divorce", "former", "separation"],
  cobra: ["continuation"],
  continuation: ["cobra"],
  document: ["evidence", "documents"],
  upload: ["evidence", "documents"],
  proof: ["evidence"],
  pregnant: ["pregnancy"],
  pregnancy: ["qualifying"],
  deductible: ["terms"],
  copay: ["terms"],
  network: ["terms", "provider"],
  doctor: ["network", "provider"],
  compare: ["terms", "contributions"],
  next: ["after", "submit"],
  happens: ["after"],
  status: ["after", "request"],
  change: ["qualifying", "event"],
  medicaid: ["chip", "60"],
  lose: ["loss"],
  lost: ["loss"],
  ended: ["loss", "ends"],
};

function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+ ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

export interface Scored {
  chunk: KnowledgeChunk;
  score: number;
}

export function retrieve(question: string, chunks: KnowledgeChunk[], o: { employerId: string | null; today: string; limit?: number }): Scored[] {
  const q = tokens(question);
  const expanded = new Map<string, number>();
  for (const w of q) {
    expanded.set(stem(w), Math.max(expanded.get(stem(w)) ?? 0, 1));
    for (const s of SYNONYMS[w] ?? SYNONYMS[stem(w)] ?? []) expanded.set(stem(s), Math.max(expanded.get(stem(s)) ?? 0, 0.6));
  }
  const costQuestion = q.some((w) => ["cost", "costs", "much", "price", "pay", "paycheck", "premium", "contribution", "expensive", "cheaper"].includes(w));
  const scored: Scored[] = [];
  for (const c of chunks) {
    if (c.employerId && o.employerId && c.employerId !== o.employerId) continue;
    if (c.effectiveDate > o.today && c.kind !== "case_record") continue;
    if (c.effectiveTo && c.effectiveTo < o.today) continue;
    const title = new Set(tokens(`${c.title} ${c.section}`).map(stem));
    const body = tokens(c.text).map(stem);
    const bodySet = new Set(body);
    let score = 0;
    for (const [w, weight] of expanded) {
      if (title.has(w)) score += 3 * weight;
      if (bodySet.has(w)) score += weight * Math.min(3, body.filter((b) => b === w).length) * 0.6;
    }
    if (score > 0 && c.kind === "estimate" && costQuestion) score += 4;
    if (score > 0 && c.kind === "case_record") score += 1.5;
    if (score > 0) scored.push({ chunk: c, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id)).slice(0, o.limit ?? 6);
}

export function toSourceRef(c: KnowledgeChunk): SourceRef {
  return { docId: c.docId, title: c.title, section: c.section, version: c.version, effectiveDate: c.effectiveDate, kind: c.kind };
}

