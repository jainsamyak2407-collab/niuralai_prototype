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

| Scenario | Starts | Household | Expected result (HR approves and sends same day) |
|---|---|---|---|
| Birth | Sep 27, 2026, 9:00 AM ET | Maya employee-only. Arjun not enrolled. Ava born Sep 1. | Ava on medical from **Sep 1**. Medical USD 150 → 250. Only the Sep 15 paycheck was short → catch-up **USD 100**. Sep 30 paycheck: 250 + 100 + 12 + 4 = **USD 366**. Next run **USD 266**. |
| Divorce | Sep 28, 2026, 9:00 AM ET | Maya, Arjun, Leela on family coverage. Divorce final Sep 15. | Arjun ends **Sep 30**. Maya and Leela stay. Total **USD 450 → 284** from the Oct 15 run. No September refund. COBRA referral sent and acknowledged. |
| Loss of other coverage | Oct 31, 2026, 9:00 AM ET | Maya employee-only. Arjun's coverage ends **Oct 31**. | Arjun added from **Nov 1**. Total **USD 166 → 332** on the Nov 13 run, no catch-up. |

Reset: **Reset demo** button in the top bar (any role). Pick which scenarios to reset (one, two
or all three), autopilot on or off, then which scenario to open and as whom (Maya, Daniel or the
demo operator). Only the chosen scenarios go back to the start.

## The flow
1. **Maya** submits the request with her document. The AI reads it and gives an **AI match**
   score. A 100% document is verified automatically; anything lower shows what differs.
2. **Daniel** opens the case. The **AI review** card at the top shows the score, what was
   verified (each fact with its document page and quote, each rule check with its rule id) and
   what is left for him to check. He approves: one case, or **Approve all ready (N)** in the queue
   for every case at 100% with nothing open.
3. The EDI 834 batch runs **every night at 10:00 PM ET**. For the demo, Daniel clicks **Run
   batch now** (on the case or in the queue). **View 834 file** (case → Delivery, or
   Integrations) opens the exact file the carrier received, line by line or raw, with a download.
   The carrier side (operator → Carrier inbox) shows the same file.
4. With autopilot on, the simulated carrier receives and accepts the file at once. Once the carrier
   confirms, the pay update is authorized automatically (HR already approved it with the case) and
   sent to payroll: status **Enrolled · pay update scheduled** (divorce: **Removal confirmed · pay
   update scheduled**). Nothing is approved without HR.
5. The case turns **Complete** once the paycheck with the new deduction posts: operator →
   Payroll → Post the run (or Advance to next payday).

## Wrong date or name on the form? Let the document fix it
If Maya types a wrong date (say Sep 23) and uploads the right document (Sep 15), the AI flags the
difference at 60%. She clicks **Use the document's date**: the form is corrected and the AI match
goes to **100%**. Daniel's AI review shows "form corrected from September 23, 2026". If she keeps
her own date, the score stays below 100% and the difference is listed for Daniel to check.
The same works for a child's name: type "Eva Shah", upload the record naming "Ava Shah", and the
AI flags it; **Correct my form to the document** fixes the name and lifts the score to 100%.

## Daniel's queue
Life events shows an **AI match** column, **Approve all ready (N)** and **Run batch now (N)**. Cases below 100% (for example Chris Wong, 60%, date difference) stay for review.
Sample cases (Priya Nair, Tom Becker, Lena Park, Chris Wong) are seeded queue examples: approving
one records the decision only.

## Walkthrough (about 3 minutes per flow)
1. **Reset demo** → all three, autopilot on → open Birth as Maya.
2. **Maya**: Report a life event → Birth. Add Ava Shah, born 2026-09-01. Documents → download the
   happy-path hospital record and upload it: **AI match 100%**. Medical, Aetna Standard,
   USD 150 → 250. Review → Submit.
3. **Daniel** (account menu → Switch role): Life events → the case → read the AI review →
   **Approve this version** (or Approve all ready in the queue) → **Run batch now** → **View 834
   file** to show the file the carrier received.
4. Status: **Enrolled · pay update scheduled**. Operator → Payroll → post the Sep 30 run: USD 366.
   Maya's tracker shows **Complete**.

Divorce (Divorce scenario): Remove from Nexa → final Sep 15, Arjun, no child order → upload the
happy-path summary → Submit. Daniel approves and runs the batch; the COBRA referral is sent and
received. Post the Oct 15 run (USD 284) → Complete. Maya never sees Arjun's COBRA details.

Loss (Loss scenario): Other health coverage → Coverage from another plan ended → Arjun,
employment ended, coverage ends Oct 31 → upload the notice naming Arjun → Submit. Daniel approves
and runs the batch. Confirmed from Nov 1 (not active today). Post the Nov 13 run (USD 332).

## Manual carrier (autopilot off: shows each simulated hand-off)
Turn autopilot off in Demo controls. Daniel approves and sends the batch. Operator: Carrier inbox → Acknowledge transport → Accept file → Publish. Arm
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
| Divorce | Fact summary, final Sep 15 | Summary says Sep 22 → date conflict; Maya picks which is correct; HR sees it in the AI review |
| Loss | Notice naming Arjun, ends Oct 31 | Notice does not name Arjun → blocking check; HR requests a named notice; Maya replies with the happy-path file |

Posting a future pay run in the simulator moves the business clock to that payday first.

## Fixtures
/demo/fixtures lists every synthetic file and what it tests. Every file carries
"SYNTHETIC DEMO — NOT VALID FOR ENROLLMENT".
