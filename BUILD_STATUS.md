# BUILD_STATUS

Last update: all phases built and integrated; live verification in progress (2026-09-28 session).
Resume: read GPT.md, docs/spec/QLE-Feature-Specification-v3.md, docs/CONTRACT.md, then this file.
Live: https://niuralai-prototype.vercel.app (deployed from `main`, Vercel root `app/`).

## Persistence decision
Supabase **Storage** (private buckets `qle-state`, `qle-evidence`) as an append-only,
revision-numbered document store per scenario. The environment has the Supabase secret key but
no SQL/migration access (no access token or DB password; the proxy blocks raw Postgres TCP).
Creating an existing revision fails, which gives compare-and-create commits: approval, queued
work, audit and outbox commit together per scenario. Durable across Vercel instances. No silent
fallback (the app refuses to run without Supabase credentials; tests use an in-memory store).

## Implemented
- Shared contract (types, Zod commands, AI/document schemas), synthetic config (plans and rates
  as one source of truth, versioned rules with sources and owners, pay calendar, identities,
  three isolated scenario seeds plus background queue cases and a second employer).
- Deterministic engine: 30/60-day timing (day-30/31, 60/61), effective dates (birth date per
  child, loss next month or Nexa advance rule, divorce end of month), checks with rule
  id@version and sources, permitted people/plans, costs, payroll forecast, approval freeze and
  invalidation on material change, change orders, nightly 834 batch and simulated API route,
  transport/file/member/observation stages, independent carrier roster, reconciliation at
  person/benefit/date/tier, line-only corrections, stale callbacks, unknown delivery inquiry,
  host election update on confirmation, payroll catch-up from the posted ledger with forecast
  labeling, authorization and recalculation, posting comparison and corrections, retroactive
  changes routed to payroll review, COBRA referral lifecycle, derived completion and reopen,
  reminders and escalations, clock and due jobs, rule/rate change review, linked divorce case.
- Signed demo sessions; server-side role checks on every command, view and download.
- Screens: entry; employee benefits, life-event tiles, five-stage wizard, evidence with fact
  confirmation and conflicts, options with plan comparison, review/submit, tracker, pay,
  documents; HR overview, queue, case review (checks, evidence, actions, delivery, payroll,
  COBRA, tasks, timeline, AI activity), payroll, integrations, audit with history for
  reporting; broker tasks; external systems simulator (carrier, manual, payroll, COBRA,
  outbox and controls); fixtures.
- AI: evidence reading with the configured model (`APP_ANTHROPIC_API_KEY`, `AI_MODEL`), labeled
  hash-matched fixture fallback and manual fallback; Emma with scoped retrieval, schema
  validation, source and number grounding checks and a deterministic fallback.
- Downloads: plan documents, statements, receipts, approval summaries, illustrative 834 and
  summary, carrier result, payroll statement, payslips, COBRA referral, ACA history CSV,
  14 synthetic evidence fixtures.

## Tests actually run
- `cd app && npx vitest run` → 33/33 (rules, money, three journeys, 11 edge cases, permissions).
- `npx tsc --noEmit` clean. Vercel production builds READY for every pushed commit.
- Delegates' browser checks on local dev (screenshots in artifacts/qa, not committed):
  employee wizard to submit, HR case actions, simulator stages, COBRA, reset isolation.
- Backend delegate: real model evidence reading and Emma answers verified; file-type
  rejections; role checks on all document kinds; fallbacks without a key.
- Live three-journey click-through: in progress (niural-verifier).

## Simulated (labeled in the UI)
Identity provider, carrier transport and responses, payroll runs, COBRA administrator, email.

## Not implemented / not tested
- Per-dependent and small-group age rating (composite tiers only, by design).
- Proactive age-26 monitoring (seeded review example only), full disability extension.
- Marriage, death, legal separation and other catalogue events use assisted review, not a
  deep flow.
- Uploads between 4.5 MB and 10 MB are rejected by Vercel's request size limit before our
  route (direct-to-storage upload would fix it). No malware scanning (stated in the UI).
- Emma rate budget is per server instance.

## Next action
Integrate the verifier's findings, fix defects, second visual review, reset scenarios.
