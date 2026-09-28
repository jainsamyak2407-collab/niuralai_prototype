# Demo guide

Live link: https://niuralai-prototype.vercel.app — synthetic data only. Use separate browser
windows (or a private window) to show two roles at once; each window keeps its own demo session.

## Identities (demo sessions, no passwords)
The entry page lists predefined fictional identities only. The server signs the session and
decides role and employer; the browser cannot choose a role.

| Person | Email | Role | Lands on |
|---|---|---|---|
| Maya Shah | maya@nexa.example | Employee | /employee/benefits |
| Daniel Brooks | daniel@nexa.example | HR and payroll administrator | /admin |
| Priya Patel | priya@broker.example | Broker (assigned tasks only) | /broker/tasks |
| Carrier operator | carrier@demo.example | Simulated carrier inbox only | /demo/integrations |
| Continuation administrator | cobra@demo.example | Assigned COBRA referrals only | /demo/integrations |
| Demo operator | ops@demo.example | All simulators, clock, presets, reset | /demo/integrations |

## Scenarios (isolated; switch from the entry page or the scenario chip in the top bar)
| Scenario | Starts | Household | Expected result |
|---|---|---|---|
| Birth | Sep 27, 2026, 9:00 AM ET | Maya employee-only (medical, dental, vision). Arjun not enrolled. Ava born Sep 1. | Ava on medical from **Sep 1**. Medical USD 150 → 250. Sep collected 300 vs owed 500 → catch-up **USD 200**. Oct 15 paycheck: 250 + 200 + 12 + 4 = **USD 466**. Next run **USD 266**. |
| Divorce | Sep 28, 2026, 9:00 AM ET | Maya, Arjun, Leela on family coverage. Divorce final Sep 15. | Arjun ends **Sep 30** (Nexa demo plan term). Maya and Leela stay. Total **USD 450 → 284** from Oct 1. No September refund. COBRA referral acknowledged by the administrator. |
| Loss of other coverage | Oct 31, 2026, 9:00 AM ET | Maya employee-only. Arjun's job ended Oct 12; coverage ends **Oct 31**. | Arjun added from **Nov 1** (Nexa advance-request rule). Total **USD 166 → 332**. First change on the Nov 13 run, no catch-up. A first request on Nov 2 would return Dec 1 and flag a gap. |

Reset: demo operator → Simulators → Demo controls → "Reset this scenario" (confirmation; only
that scenario's synthetic records change; earlier revisions stay in storage history).

## Main walkthrough (birth, with the wrong-date repair)
1. **Maya**: Benefits → Report a life event → Family changes → Birth. Add Ava Shah, born
   2026-09-01 (SSN not issued yet is fine). The deadline appears early ("You can submit this
   request by October 1, 2026…").
2. Documents: upload `fx_birth_hospital` (download it from /demo/fixtures as the demo operator).
   Confirm the proposed date of birth. Benefit changes: medical only, Aetna Standard; see
   USD 150 → 250 and the labeled catch-up forecast. Review → attest → Submit. Receipt shows the
   case number and received time.
3. **Daniel** (second window): Life events → the case. Checks show sources and rule versions.
   Accept the evidence → Approve this version. Approval queues carrier work; it does not mark
   coverage.
4. **Demo operator**: Controls → set preset "Carrier returns next-month start". Advance to next
   batch (10:00 PM). Carrier inbox → open batch → Acknowledge transport → Accept file → Publish
   observations for accepted records.
5. Reconciliation catches: "Ava Shah's requested start is September 1. The carrier record shows
   October 1." Maya sees "We are correcting a provider response. No action is needed from you
   right now." Daniel → Send correction for this line only.
6. Operator: advance to next batch, acknowledge, accept, publish. The line matches. Advance to
   next payday (Sep 30 posts at the old USD 150).
7. Daniel → Payroll changes → Authorize the USD 200 catch-up (recalculated from posted payroll).
   Operator → Payroll → Apply instruction → Post the Oct 15 run: USD 466. Post Oct 30: USD 266.
8. Maya → tracker shows Complete; Pay shows the posted payslip.

## Divorce walkthrough (COBRA)
Maya reports Divorce → "Remove from Nexa" → final Sep 15, Arjun, no child order. Submit.
Daniel sees a COBRA task immediately. Approve (after evidence) → Confirm and send referral.
Operator runs the batch (medical) and processes the API requests (dental, vision), publishes.
Payroll: apply and post Oct 15 (USD 284). COBRA administrator → Acknowledge receipt → case
completes while the continuation workflow stays with the administrator. Maya never sees
Arjun's address, election or payments.

## Loss walkthrough
Maya reports Other health coverage → Coverage from another plan ended → Arjun, employment
ended, last workday Oct 12, coverage ends Oct 31. Upload `fx_loss_notice`. Start Nov 1 appears.
Submit → Daniel approves → carrier confirms ("Confirmed from November 1", not active today) →
payroll Nov 13 posts USD 332.

## Failure presets (operator → Demo controls)
Carrier next-month start · Carrier rejects one record (use twins) · Transport outcome unknown
(HR must record a status inquiry before any resend) · Payroll posts a different amount
(coverage stays confirmed, payroll mismatch task) · Dental record fails (medical still
completes). Presets change the next simulated response only; they never complete a case.

## Fixtures
/demo/fixtures lists every synthetic file and what it tests. Every file carries
"SYNTHETIC DEMO — NOT VALID FOR ENROLLMENT".
