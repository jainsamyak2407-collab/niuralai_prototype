// Document and fixture catalogue contract. Every download is generated from the same
// config and state the app uses, and is labeled SYNTHETIC DEMO — NOT VALID FOR ENROLLMENT.

export const SYNTHETIC_LABEL = "SYNTHETIC DEMO — NOT VALID FOR ENROLLMENT";

/** GET /api/documents/{kind}?caseId=&batchId=&runId=&referralId= */
export type DocumentKind =
  | "doc_benefits_guide"
  | "doc_election_rules"
  | "doc_contributions"
  | "doc_payroll_policy"
  | "doc_medical_standard"
  | "doc_medical_plus"
  | "doc_dental_vision"
  | "doc_election_statement" // current user's elections in the active scenario
  | "receipt" // ?caseId — submitted election receipt
  | "approval" // ?caseId — approved election summary
  | "edi_834" // ?batchId — illustrative .edi (text)
  | "edi_summary" // ?batchId — readable transaction summary (PDF)
  | "carrier_result" // ?caseId — carrier result summary
  | "payroll_statement" // ?caseId — payroll change statement
  | "payslip" // ?runId — historical or posted simulated payslip
  | "cobra_referral" // ?referralId — minimal continuation referral (admin roles only)
  | "aca_history"; // CSV "History for reporting"

export interface FixtureMeta {
  id: string;
  title: string;
  scenario: "birth" | "divorce" | "loss" | "any";
  tests: string; // what this fixture exercises
  expected: string; // what the product should do with it
  format: "pdf" | "png";
}

/** GET /api/fixtures/{id} returns the generated file. Deterministic bytes (hash-matchable). */
export const FIXTURES: FixtureMeta[] = [
  { id: "fx_birth_hospital", title: "Birth — hospital evidence (Ava, Sep 1)", scenario: "birth", tests: "Readable provisional hospital evidence", expected: "Proposes Ava Shah, date of birth Sep 1, 2026; Maya confirms.", format: "pdf" },
  { id: "fx_birth_conflict", title: "Birth — conflicting date (shows Sep 2)", scenario: "birth", tests: "Document vs form conflict", expected: "Shows both values and asks Maya which is correct; never overwrites silently.", format: "pdf" },
  { id: "fx_birth_unreadable", title: "Birth — unreadable scan", scenario: "birth", tests: "Unreadable file", expected: "Marked unreadable; HR requests the exact document. No fraud accusation.", format: "png" },
  { id: "fx_twins_same", title: "Twins — same date (Ava and Rhea, Sep 1)", scenario: "birth", tests: "Multiple children, one case", expected: "Two distinct child records; never merged.", format: "pdf" },
  { id: "fx_twins_midnight", title: "Twins — across midnight (Aug 31 / Sep 1)", scenario: "birth", tests: "Separate dates of birth", expected: "Each child keeps its own date and start date.", format: "pdf" },
  { id: "fx_adoption_placement", title: "Placement for adoption summary", scenario: "birth", tests: "Placement event date", expected: "Uses the placement date; a later decree must not duplicate enrollment.", format: "pdf" },
  { id: "fx_divorce_summary", title: "Divorce fact summary (final Sep 15)", scenario: "divorce", tests: "Final divorce, child-coverage note", expected: "Proposes final date Sep 15, 2026; child coverage continues.", format: "pdf" },
  { id: "fx_divorce_late", title: "Divorce fact summary — six months late (final Mar 16)", scenario: "divorce", tests: "Late report", expected: "Specialist review; no automatic backdate or refund.", format: "pdf" },
  { id: "fx_divorce_conflict", title: "Divorce fact summary — different final date (Sep 22)", scenario: "divorce", tests: "Document vs form conflict on the final date", expected: "Shows both dates and asks Maya which is correct; HR cannot approve until it is resolved.", format: "pdf" },
  { id: "fx_loss_notice", title: "Loss notice — Arjun, coverage ends Oct 31", scenario: "loss", tests: "Coverage end vs last workday", expected: "Proposes coverage end Oct 31 and last workday Oct 12 separately.", format: "pdf" },
  { id: "fx_loss_missing_name", title: "Loss notice — names only the subscriber", scenario: "loss", tests: "Missing affected person", expected: "Precise information request for a notice naming Arjun.", format: "pdf" },
  { id: "fx_loss_conflict", title: "Loss notice — conflicting date (Oct 15)", scenario: "loss", tests: "Document vs form conflict", expected: "Shows both values; Maya confirms.", format: "pdf" },
  { id: "fx_medicaid", title: "Medicaid/CHIP eligibility end notice", scenario: "any", tests: "60-day rule family", expected: "Routes to the dedicated 60-day review, not the 30-day window.", format: "pdf" },
  { id: "fx_cobra_exhaustion", title: "COBRA exhaustion notice", scenario: "any", tests: "Exhaustion vs early cancellation", expected: "Exhaustion qualifies; early cancellation or nonpayment goes to review.", format: "pdf" },
  { id: "fx_malicious", title: "Document with embedded instructions", scenario: "any", tests: "Prompt injection in evidence", expected: "Instructions are treated as data; no access to other cases, no tool use.", format: "pdf" },
];

/** The demo set shown to the employee on the upload step: one happy-path document and one
 *  problem document per deep flow. Problem documents are ones the reading step surfaces. */
export type DemoEvent = "birth" | "divorce" | "loss";
export interface DemoDoc {
  fixtureId: string;
  kind: "happy" | "problem";
  label: string;
  whatHappens: string;
}
export const DEMO_SET: Record<DemoEvent, DemoDoc[]> = {
  birth: [
    { fixtureId: "fx_birth_hospital", kind: "happy", label: "Hospital record for Ava — born September 1", whatHappens: "Matches your form. Confirm the date and continue." },
    { fixtureId: "fx_birth_conflict", kind: "problem", label: "Hospital record showing September 2", whatHappens: "The reading flags that the document and your form disagree. You choose which is correct; both values are kept for HR." },
  ],
  divorce: [
    { fixtureId: "fx_divorce_summary", kind: "happy", label: "Divorce fact summary — final September 15", whatHappens: "Matches your form: Arjun ends September 30 and Leela stays covered." },
    { fixtureId: "fx_divorce_conflict", kind: "problem", label: "Divorce fact summary showing September 22", whatHappens: "The reading flags a different final date. HR cannot approve until you confirm which date is correct." },
  ],
  loss: [
    { fixtureId: "fx_loss_notice", kind: "happy", label: "Coverage end notice naming Arjun — ends October 31", whatHappens: "Shows the coverage end date and the last day worked separately. Nexa coverage starts November 1." },
    { fixtureId: "fx_loss_missing_name", kind: "problem", label: "Coverage end notice that does not name Arjun", whatHappens: "The reading flags that the notice does not name the person who lost coverage. HR asks for a notice that does, and you reply in the same request." },
  ],
};
