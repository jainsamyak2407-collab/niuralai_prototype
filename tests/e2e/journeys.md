# QLE live journeys: click scripts

These are the exact click sequences used to verify https://niuralai-prototype.vercel.app on
2026-09-28 (QA run). Run them from the repo root with playwright-cli, using one named session
per role, because each session cookie holds one identity and one scenario.

Sessions: `-s=maya`, `-s=daniel`, `-s=ops`, `-s=cobra`.
Evidence fixtures: `artifacts/qa/fixtures/synthetic-{birth_hospital,divorce_summary,loss_notice}.pdf`
(download as the operator from /demo/fixtures or `GET /api/fixtures/{fx_id}`).
Permission checks: `NODE_USE_ENV_PROXY=1 node tests/e2e/smoke.mjs`.

## Harness notes (this cloud container only)
- Chromium through the agent proxy fails the first request after about 8s idle with
  `net::ERR_TOO_MANY_RETRIES` (stale keep-alive tunnel). curl is fine. Work-around used in this
  run: open with a scratch config (`--disable-http2 --disable-quic`, explicit proxy) and install
  a context route that re-fetches every non-multipart request through Playwright's Node side
  with up to four retries (`route.fetch()` + `route.fulfill()`).
- Do not route multipart uploads through `route.fetch()`: Chromium does not expose file bodies
  to interception, so the server receives an empty file ("This file is empty"). Let multipart
  go natively (`route.continue()`), and just before an upload flush stale sockets with a few
  `fetch('/api/health', {method:'POST', body: new FormData()})` calls.
- Radios, checkboxes and the file input are `sr-only` inside a `<label>`. Click the label text
  (`getByText(...)`), not the hidden input, or the click is a no-op. For the file chooser,
  click the "Choose file" label and then `playwright-cli upload <path>`.
- Right after `goto /`, wait about 2s for hydration before clicking a scenario card. Clicks
  that land before hydration are lost.

## Sign in
1. `goto /`, click the scenario radio (Birth / Divorce / Loss of other coverage).
2. Click "Continue as Maya" (lands /employee/benefits), "Continue as Daniel" (/admin),
   "Open the simulators" (/demo/integrations), or the "Continue" button in the
   "Continuation administrator" row (/demo/integrations, COBRA inbox only).
3. To switch scenario later: click the top-bar scenario chip ("Birth · …"), then pick the
   scenario in the menu. Each scenario keeps its own records and clock.

## Journey 1: Birth with the wrong-date repair (expected 466 / 266)
Maya (Birth):
1. Benefits → "Report a life event" → "Family changes" → "Birth". A new draft opens
   (a new case number; if a draft already exists, a "Continue QLE-…" banner is offered).
2. First name "Ava", Last name "Shah", Date of birth 2026-09-01, tick "Social Security number
   not issued yet". The deadline text "You can submit this request by October 1, 2026…" shows
   after the first save.
   Invalid input check: clear First name, then "Save and continue". Expect "Enter a first name."
3. "Save and continue" → Documents. Click the "Choose file" label → upload
   `synthetic-birth_hospital.pdf`. Expect "Read by AI model: check each value" with 3 values
   (document type, DOB Sep 1, 2026, child Ava Shah). Click "Confirm" on each → "Accepted for review".
4. "Continue to benefit changes". Defaults: Medical changed, Ava ticked, Aetna Standard;
   dental and vision unchanged. Expect Medical USD 150.00 → USD 250.00, total USD 166.00 →
   USD 266.00, forecast "+ USD 100.00" on Sep 30 (labelled estimate).
   Emma check: "Explain with Emma" → answer with a Sources list.
5. "Continue to review" → click the attestation text → "Submit request". Tracker shows
   "HR review", receipt QLE-2026-04xx, received Sep 27, 2026, 9:00 AM ET.
Daniel (Birth):
6. goto /admin/qle/<caseId> → "Accept as evidence". If "Other open requests: needs review" blocks
   approval, click "Record review" and fill Reason and Source (empty Reason/Source is flagged
   invalid) → "Record review".
7. "Approve this version" → dialog lists Ava/Maya medical from Sep 1, USD 166.00 → 266.00 →
   "Approve revision 1". Status becomes "Waiting for carrier".
Ops (Birth):
8. Simulators → "Email outbox and demo controls" → select "Carrier applies the wrong start
   date" → "Arm preset" (badge: "Armed: Carrier applies the wrong start date") →
   "Advance to next batch (10:00 p.m.)" ("Nightly batch batch_b1 sent (2 records)").
9. "Carrier inbox" → batch_b1 → "Acknowledge transport" → "Accept file validation" →
   "Publish observations for accepted records (values from file)". Batch shows "Result mismatch".
Check:
10. Daniel, reload the case: status "Provider issue"; text "Ava Shah's requested start is September 1.
    The carrier record shows October 1."
11. Maya, /employee/cases/<caseId>: "We are correcting a provider response. No action is needed
    from you right now." (The Oct 1 carrier date is not shown to Maya.)
12. Daniel → "Send correction for this line" → "Queue correction" ("Carrier · correction queued").
Ops:
13. Controls → "Advance to next batch" (batch_b2, 1 record) → Carrier inbox → Acknowledge →
    Accept file validation → Publish observations. Roster: Ava Shah, Medical, Sep 1, 2026.
    Daniel's case: "Enrolled · pay update scheduled".
14. Controls → "Advance to next payday" ("Pay run 2026-09-30 posted", USD 166.00 at old rate).
Daniel:
15. /admin/payroll → the instruction shows + USD 200.00, "Needs authorization" →
    "Authorize adjustment" → confirm "Authorize adjustment" → state "Scheduled".
Ops:
16. Payroll simulator → "Apply instruction" → "Post run" (Oct 15) → **USD 466.00** →
    "Post run" (Oct 30) → **USD 266.00**.
Maya:
17. Tracker shows "Complete" (reload to confirm). Pay → "Latest payslip" shows Medical USD 250.00;
    each payslip "Download" returns application/pdf.

## Journey 2: Divorce with COBRA (expected 284)
Maya (Divorce):
1. "Report a life event" → "Family changes" → "Divorce (final)".
2. Click text "Remove my former spouse from Nexa's plan". "Is the divorce final?" Yes.
   Invalid input check: "Save and continue" with empty date. Expect "Enter a valid date.",
   "Choose the option that fits.", "Choose yes or no." (errors wired via aria-describedby).
3. Date the divorce became final 2026-09-15, Former spouse Arjun Shah (preselected),
   "No order about coverage", mailing address known "Yes" → "Save and continue".
4. Upload `synthetic-divorce_summary.pdf` → confirm 4 values (type, Sep 15, 2026, Arjun Shah,
   Leela Shah). Reload: confirmations persist.
5. "Continue to benefit changes": Arjun leaves (coverage ends Sep 30, 2026); Maya and Leela stay;
   total USD 450.00 → USD 284.00 from Oct 1; "None expected" adjustment.
6. "Continue to review". "Submit request" without the attestation → "Confirm the attestation to
   submit." Then tick and submit → tracker "HR review".
Daniel:
7. Case shows the COBRA task immediately ("COBRA needs attention"). "Accept as evidence" →
   "Approve this version" → "Approve revision 1" → "Waiting for carrier".
8. (Reload if needed) "Confirm and send referral" → "Verified address on file" → "Send referral"
   → "Sent, awaiting receipt".
Ops (Divorce):
9. Controls → "Advance to next batch" (batch_d1, 2 records) → Carrier inbox → Acknowledge
   transport → Accept file validation → Publish observations.
10. API requests table: "Accept" ×4, then "Publish (values from request)" ×4.
    Roster: Arjun medical/dental/vision end Sep 30; Maya Employee + Children from Oct 1;
    Leela stays "Open".
11. Payroll simulator → "Apply instruction" ×3 (medical 400→250, vision 12→8, dental 38→26) →
    "Post run" (Sep 30, USD 450.00) → "Post run" (Oct 15, **USD 284.00**).
COBRA administrator (Divorce, `-s=cobra`):
12. Referral inbox → "Acknowledge receipt" → "Receipt acknowledged".
Check:
13. Daniel and Maya both show "Complete". Maya's tracker: "Administrator confirmed receipt… their
    choices, payments and address stay private." Search Maya's HTML and
    `/api/qle/cases/<id>` for "Hudson" / "arjun.private": no match.
14. Maya Benefits: current coverage stays Family (until Sep 30); "Confirmed future changes" lists
    Maya and Leela from Oct 1. Pay shows upcoming USD 284.00.

## Journey 3: Loss of other coverage (expected 332, no catch-up)
Maya (Loss):
1. "Report a life event" → "Other health coverage" → "Coverage from another plan ended".
   Invalid input check: "Save and continue" empty. The reason select and coverage end date are
   flagged invalid.
2. Tick "Arjun Shah · spouse", reason "Employment ended", Last day worked 2026-10-12, Date the
   health coverage ends 2026-10-31, "had this coverage" Yes, "still have other coverage" No →
   "Save and continue".
3. Upload `synthetic-loss_notice.pdf` → confirm 4 values (type, coverage ends Oct 31, last day
   worked Oct 12 kept separately, Arjun Shah).
4. Benefit changes: all three benefits add Arjun, Employee + Spouse from Nov 1; USD 166.00 →
   USD 332.00; "None expected" adjustment; affected paycheck Nov 13.
5. Review → attestation → "Submit request".
Daniel:
6. "Accept as evidence" → "Approve this version" → "Approve revision 1".
Ops (Loss):
7. Controls → "Advance to next batch" (Oct 31, 10:00 PM, batch_l1) → Acknowledge → Accept file
   → Publish; API requests Accept ×4 and Publish ×4.
Check (clock still Oct 31):
8. Maya Benefits: current coverage unchanged (Employee only, USD 166.00); "Confirmed future
   changes" shows "Confirmed from November 1" for all three.
Ops:
9. Payroll simulator → "Apply instruction" ×3 → Controls → "Advance to next payday" (Nov 13,
   9:00 AM, run posts automatically) → Nov 13 run **USD 332.00**, adjustment USD 0.00.
10. Maya tracker "Complete".

## Quick checks
- Employee goto /admin/qle, /admin, /admin/qle/<id>, /demo/integrations → all redirect to
  /employee/benefits. (/demo/fixtures is open to employees by design; the route allows
  employee + demo_operator.)
- Tracker downloads: Receipt, Download receipt, Download approval summary, evidence file →
  200 application/pdf. Another scenario's receipt → 404.
- Scenario isolation: Daniel on /admin/qle/<divorce case> after switching to Loss → "Case not
  found".

## Reset (ops)
Simulators → "Email outbox and demo controls" → "Reset this scenario" → confirm, once per
scenario (switch with the scenario chip). Only reset when the scenario holds nothing but QA data.
