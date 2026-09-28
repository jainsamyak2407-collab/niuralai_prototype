# Product context

Status: live BUILD (2026-09-28). Brief: GPT.md and docs/spec/QLE-Feature-Specification-v3.md.

- **Product:** a standalone QLE (qualifying life event) service embedded in a payroll/HR
  platform's host shell. Niural-style shell, fictional employer Nexa.
- **Users:** Maya Shah (employee), Daniel Brooks (HR and payroll admin), Priya Patel
  (broker, assigned tasks only), a simulated carrier operator, a COBRA administrator, and
  a demo operator who drives the external-system simulators.
- **Task:** report a life event, decide it, deliver it to the carrier, reconcile the
  carrier's actual record and the posted payroll, and hand off COBRA where relevant.
- **Outcome:** the right people have the right coverage dates and the right deductions,
  with a named owner whenever something goes wrong.
- **Constraints:** synthetic data only; carrier, payroll, COBRA and email are simulated and
  labeled; code decides dates, rules and money; AI explains and proposes only.
- **Exclusions:** real carriers, real employee data, FSA/HSA, tax engines, claims, full HRIS.
- **Acceptance:** three deep flows (birth, divorce, loss of other coverage) reach a verified
  end state, including a wrong-date carrier response caught and repaired.
- **Success metric:** eligible cases correctly completed within the service target ÷
  eligible cases due in that cohort (unresolved cases stay in the denominator).
- **Surface mode:** Operate for every product screen. The entry page is a compact product
  entry, not a marketing page.
