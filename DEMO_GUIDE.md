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
Run each life event in its own scenario. The household differs: in the Birth scenario Arjun is
not on Maya's plan, so a divorce started there has no one to remove (the details step says so).

| Scenario | Starts | Household | Expected result (autopilot on) |
|---|---|---|---|
| Birth | Sep 27, 2026, 9:00 AM ET | Maya employee-only. Arjun not enrolled. Ava born Sep 1. | Ava on medical from **Sep 1**. Medical USD 150 → 250. Only the Sep 15 paycheck was short → catch-up **USD 100**. Sep 30 paycheck: 250 + 100 + 12 + 4 = **USD 366**. Next run **USD 266**. |
| Divorce | Sep 28, 2026, 9:00 AM ET | Maya, Arjun, Leela on family coverage. Divorce final Sep 15. | Arjun ends **Sep 30**. Maya and Leela stay. Total **USD 450 → 284** from the Oct 15 run. No September refund. COBRA referral sent and acknowledged. |
| Loss of other coverage | Oct 31, 2026, 9:00 AM ET | Maya employee-only. Arjun's coverage ends **Oct 31**. | Arjun added from **Nov 1**. Total **USD 166 → 332** on the Nov 13 run, no catch-up. |

Reset: demo operator → Simulators → Demo controls → "Reset this scenario".

## Autopilot (on by default)
Demo controls → Autopilot. When a case is clean, the system does the follow-up work itself,
through the same checks and audit trail as the manual steps:
- Approves the case when every check passed and every document is an **AI match of 100%**.
- Sends the change to the carrier and records a simulated carrier confirmation.
- Authorizes payroll catch-ups up to USD 500 and applies them to the next run.
- Sends the COBRA referral (address on file) and records the administrator's receipt.

It stops for a person when a document is under 100%, a check needs review, the carrier returns
a different result, or the payroll adjustment is large or retroactive.

Status after submit on a clean case: **Enrolled · pay update scheduled** (divorce: **Removal
confirmed · pay update scheduled**). The case turns **Complete** once the paycheck with the new
deduction posts: operator → Payroll → Post the run (or Advance to next payday).

## Main walkthrough (autopilot on, about 3 minutes per flow)
1. **Maya** (Birth scenario): Benefits → Report a life event → Birth. Add Ava Shah, born
   2026-09-01. Documents step → Demo documents → download the happy-path hospital record and
   upload it: **AI match 100%, verified automatically**. Benefit changes: medical, Aetna Standard,
   USD 150 → 250. Review → attest → Submit.
2. The tracker already shows HR approved, sent to the provider, confirmed, pay update scheduled.
   **Daniel** sees the case approved by "Rules engine (straight-through)" with the full audit.
3. **Operator** → Payroll → post the Sep 30 run: USD 366. Maya's tracker shows **Complete**.
4. Problem path: upload the Sep 2 record instead. The AI flags the date conflict, the score drops
   below 100%, and the case waits for Daniel.

Divorce (Divorce scenario): Remove from Nexa → final Sep 15, Arjun, no child order → upload the
happy-path summary → Submit. Arjun's end date is confirmed, COBRA referral is sent and received.
Post the Oct 15 run (USD 284) → Complete. Maya never sees Arjun's address or COBRA details.

Loss (Loss scenario): Other health coverage → Coverage from another plan ended → Arjun,
employment ended, coverage ends Oct 31 → upload the notice naming Arjun → Submit. Confirmed from
Nov 1 (not active today). Post the Nov 13 run (USD 332) → Complete.

## Manual walkthrough (autopilot off: shows each hand-off)
Turn autopilot off in Demo controls. Daniel clicks **Approve this version**. Operator: Advance
to next batch (10:00 PM) → Carrier inbox → Acknowledge transport → Accept file → Publish. Arm
"Carrier returns next-month start" first to show reconciliation catching "requested Sep 1,
carrier shows Oct 1"; Daniel → Send correction for this line only. Daniel authorizes the payroll
catch-up; operator applies the instruction and posts the run. In the birth flow, a late carrier
confirmation misses the Sep 30 cutoff, so the catch-up is USD 200 and the Oct 15 paycheck is
USD 466.

## Failure presets (operator → Demo controls)
Carrier next-month start · Carrier rejects one record (use twins) · Transport outcome unknown
(HR must record a status inquiry before any resend) · Payroll posts a different amount
(coverage stays confirmed, payroll mismatch task) · Dental record fails (medical still
completes). Presets change the next simulated response only; they never complete a case.

## Demo documents (Maya can download them on the Documents step)
| Flow | Happy path | Problem document — what the reading surfaces |
|---|---|---|
| Birth | Hospital record, Ava born Sep 1 | Record says Sep 2 → date conflict; Maya picks which is correct |
| Divorce | Fact summary, final Sep 15 | Summary says Sep 22 → date conflict; HR cannot approve until resolved |
| Loss | Notice naming Arjun, ends Oct 31 | Notice does not name Arjun → blocking check; HR requests a named notice; Maya replies with the happy-path file |

Posting a future pay run in the simulator moves the business clock to that payday first.

## Fixtures
/demo/fixtures lists every synthetic file and what it tests. Every file carries
"SYNTHETIC DEMO — NOT VALID FOR ENROLLMENT".
