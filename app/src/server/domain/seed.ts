import type {
  Benefit,
  CarrierCoverage,
  Election,
  Person,
  PostedDeduction,
  QleCase,
  ScenarioId,
  ScenarioState,
  Task,
  Tier,
} from "@/lib/contracts/domain";
import { zonedToUtc } from "@/lib/dates";
import { CARRIERS, employeeCost } from "@/server/config/plans";
import { payCalendar } from "@/server/config/payroll";
import { NEXA, ORBIT, PARTNER_ID } from "@/server/config/identities";

// Three isolated synthetic snapshots. Same Maya persona, different households.
// They are not sequential events in one household record.

export const SCENARIO_META: Record<ScenarioId, { title: string; start: string; summary: string }> = {
  birth: {
    title: "Birth",
    start: "2026-09-27",
    summary: "Maya is employee-only in all three benefits. Ava was born September 1, 2026. Add Ava to medical.",
  },
  divorce: {
    title: "Divorce",
    start: "2026-09-28",
    summary: "Maya, Arjun and Leela are on family coverage. The divorce became final September 15, 2026. Remove only Arjun.",
  },
  loss: {
    title: "Loss of other coverage",
    start: "2026-10-31",
    summary: "Maya is employee-only. Arjun's job ended October 12; his health coverage ends October 31. Add Arjun from November 1.",
  },
};

const CASE_BASE: Record<ScenarioId, number> = { birth: 412, divorce: 521, loss: 633 };

function maya(): Person {
  return { id: "p_maya", employerId: NEXA.id, subscriberId: "NXS-000417", firstName: "Maya", lastName: "Shah", dob: "1991-04-12", relationship: "self", residenceState: "NY", ssnStatus: "on_file", ssnLast4: "4417" };
}
function arjun(): Person {
  return { id: "p_arjun", employerId: NEXA.id, firstName: "Arjun", lastName: "Shah", dob: "1990-08-03", relationship: "spouse", residenceState: "NY", ssnStatus: "on_file", ssnLast4: "8820" };
}
function leela(): Person {
  return { id: "p_leela", employerId: NEXA.id, firstName: "Leela", lastName: "Shah", dob: "2019-05-20", relationship: "child", residenceState: "NY", ssnStatus: "on_file", ssnLast4: "3306" };
}

const PLAN_FOR: Record<Benefit, string> = { medical: "aetna_standard", dental: "nexa_dental", vision: "nexa_vision" };

function electionsFor(tier: Tier, covered: string[]): Election[] {
  return (["medical", "dental", "vision"] as Benefit[]).map((b) => ({
    id: `el_seed_${b}`,
    personId: "p_maya",
    benefit: b,
    planId: PLAN_FOR[b],
    tier,
    coveredPersonIds: covered,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    source: "host_seed",
  }));
}

// The carrier's own roster, seeded independently of our elections.
function rosterFor(tier: Tier, covered: string[]): CarrierCoverage[] {
  const out: CarrierCoverage[] = [];
  for (const b of ["medical", "dental", "vision"] as Benefit[]) {
    const carrierId = b === "medical" ? "aetna_demo" : "clearview_dv";
    for (const pid of covered) {
      out.push({ id: `cov_seed_${b}_${pid}`, carrierId, personId: pid, benefit: b, planId: PLAN_FOR[b], tier, startDate: "2026-01-01", endDate: null, sourceRef: "Carrier roster 2026-01-01 (seed)", observedAt: "2026-01-02T15:00:00.000Z" });
    }
  }
  return out;
}

function ledgerFor(tier: Tier, postedPaydays: string[]): PostedDeduction[] {
  const out: PostedDeduction[] = [];
  for (const payday of postedPaydays) {
    for (const b of ["medical", "dental", "vision"] as Benefit[]) {
      const periodMonth = payday === "2026-10-30" ? "2026-10" : payday.slice(0, 7);
      out.push({ id: `pd_${payday}_${b}`, runId: `run_${payday}`, benefit: b, kind: "recurring", amountCents: employeeCost(PLAN_FOR[b], tier), allocatedMonth: periodMonth });
    }
  }
  return out;
}

function bgCase(n: number, scenario: ScenarioId, init: Partial<QleCase> & Pick<QleCase, "employeeName" | "eventCode" | "status">, createdAt: string): QleCase {
  return {
    id: `case_bg_${scenario}_${n}`,
    caseNumber: `QLE-2026-0${CASE_BASE[scenario] - 10 - n}`,
    partnerId: PARTNER_ID,
    employerId: NEXA.id,
    employeeId: `p_bg_${n}`,
    background: true,
    version: 3,
    createdAt,
    updatedAt: createdAt,
    facts: {},
    elections: [],
    preferences: {},
    evaluation: null,
    revisions: [],
    receipt: {
      caseNumber: "",
      receivedAt: createdAt,
      ingestedAt: createdAt,
      revisionNo: 1,
      hash: "seed",
      timingAtReceipt: "within_window",
      reportedAt: createdAt,
      enrollmentRequestedAt: null,
      kind: "review_request",
    },
    approvals: [],
    lines: [],
    ownerId: "u_daniel",
    backupOwnerId: "u_rosa",
    linkedCaseIds: [],
    sensitive: false,
    checkResolutions: {},
    ...init,
  };
}

function backgroundCases(scenario: ScenarioId, clockIso: string): { cases: QleCase[]; tasks: Task[]; people: Person[] } {
  const day = (offsetHours: number) => new Date(new Date(clockIso).getTime() - offsetHours * 3600_000).toISOString();
  const cases: QleCase[] = [
    bgCase(1, scenario, { employeeName: "Jordan Lee", eventCode: "marriage", status: "under_review", facts: { eventDate: "2026-09-12" } }, day(40)),
    bgCase(2, scenario, { employeeName: "Sam Ortiz", eventCode: "medicaid_chip_loss", status: "needs_information", facts: { eventDate: "2026-08-30" } }, day(96)),
    bgCase(3, scenario, { employeeName: "Wei Chen", eventCode: "dependent_age_off", status: "under_review", facts: { eventDate: "2026-12-04" } }, day(20)),
  ];
  for (const c of cases) c.receipt!.caseNumber = c.caseNumber;
  // A case belonging to a different employer on the same platform — never visible to Nexa HR.
  const orbit = bgCase(4, scenario, { employeeName: "Alex Rivera", eventCode: "birth", status: "under_review", employerId: ORBIT.id, facts: { eventDate: "2026-09-10" } }, day(30));
  orbit.receipt!.caseNumber = orbit.caseNumber;
  cases.push(orbit);
  const mk = (c: QleCase, t: Partial<Task> & Pick<Task, "kind" | "title" | "reason" | "nextAction">, dueOffsetH: number, owner = "u_daniel"): Task => ({
    id: `task_bg_${c.id}`,
    caseId: c.id,
    ownerId: owner,
    backupOwnerId: "u_rosa",
    dueAt: new Date(new Date(clockIso).getTime() + dueOffsetH * 3600_000).toISOString(),
    createdAt: c.createdAt,
    status: "open",
    blocking: true,
    internalOnly: false,
    ...t,
  });
  const tasks: Task[] = [
    mk(cases[0], { kind: "specialist_review", title: "Assisted review: marriage", reason: "Marriage is handled through assisted review in this build.", nextAction: "Confirm spouse eligibility and requested plans" }, 20),
    mk(cases[1], { kind: "information_request", title: "Medicaid end-date notice requested", reason: "The notice does not show the date Medicaid eligibility ended.", nextAction: "Waiting for employee", items: ["State notice showing the Medicaid end date"] }, 48, "u_maya"),
    mk(cases[2], { kind: "specialist_review", title: "Age-limit review (seeded P1 example)", reason: "Dependent reaches the plan age limit. No automatic removal at 26.", nextAction: "Confirm plan end date and disability-extension question" }, 70),
    mk(orbit, { kind: "hr_review", title: "Review birth request", reason: "Orbit Labs case", nextAction: "Orbit Labs HR review" }, 24, "u_orbit_hr"),
  ];
  tasks[1].ownerId = "u_bg_employee";
  const people: Person[] = [];
  return { cases, tasks, people };
}

export function seedScenario(scenario: ScenarioId, nowReal: string): ScenarioState {
  const meta = SCENARIO_META[scenario];
  const clock = zonedToUtc(meta.start, "09:00");
  const runs = payCalendar();
  let people: Person[];
  let elections: Election[];
  let roster: CarrierCoverage[];
  let posted: string[];
  if (scenario === "birth") {
    people = [maya(), arjun()];
    elections = electionsFor("EE", ["p_maya"]);
    roster = rosterFor("EE", ["p_maya"]);
    posted = ["2026-08-14", "2026-08-31", "2026-09-15"];
  } else if (scenario === "divorce") {
    people = [maya(), arjun(), leela()];
    elections = electionsFor("FAM", ["p_maya", "p_arjun", "p_leela"]);
    roster = rosterFor("FAM", ["p_maya", "p_arjun", "p_leela"]);
    posted = ["2026-08-14", "2026-08-31", "2026-09-15"];
  } else {
    people = [maya(), arjun()];
    elections = electionsFor("EE", ["p_maya"]);
    roster = rosterFor("EE", ["p_maya"]);
    posted = ["2026-08-14", "2026-08-31", "2026-09-15", "2026-09-30", "2026-10-15", "2026-10-30"];
  }
  for (const r of runs) {
    if (posted.includes(r.payday)) {
      r.status = "posted";
      r.postedAt = zonedToUtc(r.payday, "09:00");
    }
  }
  const tier: Tier = scenario === "divorce" ? "FAM" : "EE";
  const bg = backgroundCases(scenario, clock);
  const state: ScenarioState = {
    scenarioId: scenario,
    schemaVersion: 1,
    rev: 0,
    seededAt: nowReal,
    clock: { businessNow: clock },
    preset: "none",
    autopilot: true,
    counters: { case: CASE_BASE[scenario] },
    people: [...people, ...bg.people],
    elections,
    cases: bg.cases,
    evidence: [],
    tasks: bg.tasks,
    carriers: CARRIERS.map((c) => ({ ...c })),
    txns: [],
    batches: [],
    roster,
    observations: [],
    payRuns: runs,
    ledger: ledgerFor(tier, posted),
    instructions: [],
    payrollSetup: (["medical", "dental", "vision"] as Benefit[]).map((b) => ({
      benefit: b,
      recurringCents: employeeCost(PLAN_FOR[b], tier),
      fromRunId: null,
      pending: null,
      oneTime: [],
    })),
    cobra: [],
    outbox: [],
    audit: [
      {
        id: "au_seed",
        caseId: null,
        at: clock,
        ingestedAt: nowReal,
        actor: "system",
        type: "scenario.seeded",
        summary: `Scenario "${meta.title}" seeded. ${meta.summary}`,
        employeeSummary: null,
        visibility: "internal",
      },
    ],
    ai: [],
    processed: {},
    metrics: [],
  };
  // Loss scenario: prior waiver context for Arjun (on file at the host).
  return state;
}

export const LOSS_WAIVER_CONTEXT = {
  personId: "p_arjun",
  waivedOn: "2025-11-10",
  statement: "Arjun declined Nexa spouse coverage at 2026 open enrollment because he had coverage through Harbor Logistics (fictional). Waiver statement on file.",
  priorEmployer: "Harbor Logistics (fictional)",
  priorCarrier: "Summit Health Plan (fictional)",
};
