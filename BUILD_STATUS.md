# BUILD_STATUS

Last update: Phase 1 complete, Phase 2–4 delegated (2026-09-28 build session).
Resume: read GPT.md, docs/spec/QLE-Feature-Specification-v3.md, docs/CONTRACT.md, then this file.

## Persistence decision
Supabase **Storage** (private buckets `qle-state`, `qle-evidence`) used as an append-only,
revision-numbered document store per scenario. Reason: the environment has the Supabase secret
key but no SQL/migration access (no access token or DB password; the proxy blocks raw Postgres
TCP). Creating an existing revision object fails, which gives compare-and-create commits: two
writers cannot both commit the same revision, so approval + queued work + audit + outbox commit
atomically per scenario. Durable across Vercel instances. No silent fallback: without
`SUPABASE_URL` + `SUPABASE_SECRET_KEY` the app refuses to run (tests use an in-memory store).
Limitation: one JSON document per scenario, so heavy concurrent writes retry; fine for a demo.

## Completed
- Shared contract: domain types, Zod commands, AI and document schemas (`app/src/lib/contracts`).
- Synthetic config: plans/rates (one source of truth), rules with id/version/source/owner,
  event catalogue, pay calendar, identities, three isolated scenario seeds + background cases.
- Deterministic engine: timing (30/60-day, day-30/31), effective dates (birth date, loss next
  month or Nexa advance rule, divorce end of month), checks with sources, permitted people/plans,
  proposed lines, costs, payroll forecast, approval freeze, change orders, nightly 834 batch,
  simulated API route, carrier observations, reconciliation (person/benefit/date/tier), targeted
  corrections, stale-callback handling, host election update on confirmation, payroll
  instructions with catch-up from posted ledger, payroll posting and comparison, COBRA referral
  lifecycle, derived completion/reopen, reminders and escalations, clock and due jobs.
- Signed demo sessions (server picks role/employer), role checks on every command and view.
- Shell (top bar, purple strip, sidebar, scenario chip, notifications, account menu, live
  refresh polling), tokens, UI kit, Emma dock (UI), entry page, benefits page, HR queue.

## Tests actually run
- `cd app && npx vitest run` → 22/22 passed (rules, payroll math, birth/divorce/loss journeys,
  permissions). Numbers verified: birth $466 then $266, divorce $450 → $284, loss $166 → $332.
- HTTP smoke on local dev: entry 200, session creation, unknown identity rejected, employee
  blocked from HR command (403), benefits page and HR queue render from Supabase state.

## In progress (delegated)
- Employee wizard, tracker, pay, documents (niural-ui).
- HR overview, case detail, payroll, integrations, audit, broker task (niural-ui).
- External simulators and fixtures pages (niural-ui).
- Evidence upload + AI extraction, Emma API, documents/fixtures generation (niural-backend).

## Blockers
- None blocking. SQL tables not used (see persistence decision).

## Next action
Integrate delegate work, deploy, click through the three journeys on the live link.
