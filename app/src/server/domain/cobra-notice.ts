import type { CobraReferral, ScenarioState } from "@/lib/contracts/domain";
import { addDays, fmtDateLong, localDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { plan } from "@/server/config/plans";

// COBRA election notice, modeled on the structure of the U.S. Department of Labor model
// election notice. Synthetic demo text: not legal advice and not a valid notice.

export interface CobraNotice {
  subject: string;
  to: string; // masked address for display
  noticeDate: string;
  electBy: string;
  coverageThrough: string;
  costs: { plan: string; monthly: string }[];
  sections: { heading: string; paragraphs: string[] }[];
}

const BENEFIT: Record<string, string> = { medical: "Medical", dental: "Dental", vision: "Vision" };

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}•••@${domain ?? ""}`;
}

/** Last day of the month, N months after the coverage-loss date. */
function monthsAfter(date: string, months: number) {
  const [y, m] = date.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + months + 1, 0));
  return end.toISOString().slice(0, 10);
}

export function cobraNotice(s: ScenarioState, r: CobraReferral): CobraNotice {
  const noticeDate = localDate(s.clock.businessNow);
  const loss = r.coverageLossDate ?? noticeDate;
  const later = loss > noticeDate ? loss : noticeDate;
  const electBy = addDays(later, 60);
  const coverageThrough = monthsAfter(loss, 36);
  // Up to 102% of the full single-coverage premium (employee + employer), per month (24 paychecks a year).
  const costs = r.plans.map((p) => {
    const pl = plan(p.planId);
    const monthly = Math.round(((pl.premiumCents.EE * 24) / 12) * 1.02);
    return { plan: `${BENEFIT[p.benefit] ?? p.benefit}: ${pl.shortName}`, monthly: fmtMoney(monthly, "USD") };
  });
  const d = (x: string) => fmtDateLong(x, true);
  return {
    subject: "Important information about your COBRA continuation coverage rights",
    to: maskEmail(r.private.email),
    noticeDate,
    electBy,
    coverageThrough,
    costs,
    sections: [
      {
        heading: `Dear ${r.beneficiaryName},`,
        paragraphs: [
          "This notice has important information about your right to continue your health care coverage in the Nexa group health plan, and about other coverage options that may be available to you, including coverage through the Health Insurance Marketplace. Please read it carefully.",
        ],
      },
      {
        heading: "Why you are receiving this notice",
        paragraphs: [
          `Your coverage under the Nexa plan ends on ${d(loss)} because of a qualifying event: ${r.qualifyingEvent.toLowerCase()}${r.eventDate ? ` (final ${d(r.eventDate)})` : ""}.`,
          `You are entitled to elect COBRA continuation coverage starting ${d(addDays(loss, 1))}, so there is no gap in coverage if you elect and pay on time.`,
        ],
      },
      {
        heading: "What is COBRA continuation coverage?",
        paragraphs: [
          "Federal law requires most group health plans to give employees and their families the opportunity to continue their coverage when a qualifying event would otherwise end it. COBRA coverage is the same coverage the plan gives other members.",
        ],
      },
      {
        heading: "How long will continuation coverage last?",
        paragraphs: [`For a divorce, COBRA coverage may last up to 36 months, through ${d(coverageThrough)}. It can end earlier if premiums are not paid on time or you become covered under another group health plan.`],
      },
      {
        heading: "How do I elect, and by when?",
        paragraphs: [
          `You have 60 days to elect. Your election must be received by ${d(electBy)}. Reply to this email or use the election form from Nexa's continuation administrator. If you do not elect by that date, you lose your right to COBRA coverage.`,
        ],
      },
      {
        heading: "How much does it cost?",
        paragraphs: [
          "COBRA coverage costs up to 102% of the plan's full premium. Your first payment is due within 45 days after you elect; later payments are due monthly, with a 30-day grace period.",
        ],
      },
      {
        heading: "Other coverage options",
        paragraphs: [
          "Instead of COBRA, you may be able to buy coverage through the Health Insurance Marketplace, qualify for Medicaid, or enroll in another group plan (such as a spouse's plan) through a special enrollment period. You generally have 60 days after losing coverage to enroll in these options.",
        ],
      },
      {
        heading: "Questions",
        paragraphs: ["Contact Nexa's continuation administrator (simulated) at cobra@demo.example. Keep a copy of this notice for your records and tell the plan if your address changes."],
      },
    ],
  };
}

/** Plain-text email body for the outbox. */
export function cobraNoticeText(n: CobraNotice) {
  return [
    ...n.sections.flatMap((s) => [s.heading, ...s.paragraphs, ""]),
    "Monthly cost if you elect (illustrative):",
    ...n.costs.map((c) => `  ${c.plan}: ${c.monthly}`),
    "",
    "SYNTHETIC DEMO — NOT A LEGAL NOTICE.",
  ].join("\n");
}
