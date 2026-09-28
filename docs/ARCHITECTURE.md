# Architecture map

```
 Host platform shell (simulated trusted boundary: Niural-style top bar, signed demo session)
 ┌──────────────────────────────────────────────────────────────────────────────────────────┐
 │  Employee UI        HR UI            Broker UI        Simulators UI (operator-only)        │
 │  /employee/*        /admin/*         /broker/*        /demo/integrations, /demo/fixtures   │
 └──────────┬──────────────┬───────────────┬──────────────────┬──────────────────────────────┘
            │ views (role-scoped reads)     │ POST /api/command (Zod union, idempotencyKey,
            │                               │ expectedVersion; actor from signed session)
 ┌──────────▼───────────────────────────────▼──────────────────────────────────────────────┐
 │ QLE service (modular monolith)                                                            │
 │  rules/timing ─ eligibility routing ─ evaluation (checks with rule id@version, sources)   │
 │  workflow: draft → submitted → needs_information/under_review → approved/declined/withdrawn│
 │  execution: approval freezes lines → ChangeOrders → carrier adapters                      │
 │  reconciliation: approved intent vs independent carrier observations (person/benefit/date)│
 │  payroll: obligations from posted ledger → instructions → posted result comparison        │
 │  COBRA: restricted referral lifecycle (review_needed → sent → received → notice_tracked)  │
 │  notifications outbox (simulated, deduped) · append-only audit · AI activity · clock/jobs │
 └───────┬──────────────────────┬──────────────────────┬──────────────────────┬─────────────┘
         │                      │                      │                      │
 ┌───────▼────────┐   ┌─────────▼────────┐   ┌─────────▼────────┐   ┌─────────▼────────────┐
 │ Carrier (sim.) │   │ Payroll (sim.)   │   │ COBRA TPA (sim.)  │   │ Email (sim. outbox)  │
 │ nightly 834    │   │ instruction      │   │ referral inbox    │   │ rendered, no real    │
 │ batch + API    │   │ accept ≠ posted  │   │ receipt ≠ notice  │   │ delivery             │
 │ adapter; own   │   │ ≠ election       │   │                   │   │                      │
 │ roster changes │   │                  │   │                   │   │                      │
 │ only on publish│   │                  │   │                   │   │                      │
 └────────────────┘   └──────────────────┘   └───────────────────┘   └──────────────────────┘
         Broker/manual route: Priya records portal submission, then a verified result.

 Persistence: Supabase Storage private buckets (append-only scenario revisions + evidence files)
 AI: server-side Anthropic via APP_ANTHROPIC_API_KEY; proposes facts and explanations only.
```

Separate truths are stored separately: proposed changes (case elections and evaluation),
HR-approved changes (frozen approval lines), carrier observations and roster, and posted
payroll ledger. Case completion is derived from these records; there is no "set complete" API.
