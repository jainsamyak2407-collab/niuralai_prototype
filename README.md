# Nexa life events (QLE) — demo build

A qualifying-life-event service embedded in a Niural-style host shell. One case runs from the
employee's request through HR's decision, simulated carrier delivery, reconciliation against the
carrier's own record, payroll posting, and a COBRA handoff where relevant. All data is synthetic.

- Live preview: https://niuralai-prototype.vercel.app (Vercel project `niuralai-prototype`, root `app/`)
- Build contract: [GPT.md](GPT.md) · Spec: [docs/spec](docs/spec) · Status: [BUILD_STATUS.md](BUILD_STATUS.md) · Demo: [DEMO_GUIDE.md](DEMO_GUIDE.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Zod 4 · Lucide · AI SDK 7 with
`@ai-sdk/anthropic` · pdf-lib · Vitest. Font: Inter (a provisional match for Niural's app).

## Persistence
Supabase Storage, private buckets `qle-state` and `qle-evidence`, used as an append-only,
revision-numbered document store (one JSON document per scenario per revision). Commits use
create-if-absent, so two writers can never both commit the same revision. The environment has
the Supabase secret key but no SQL migration access, so no Postgres tables are created.
There is no silent fallback: the app refuses to start without `SUPABASE_URL` and
`SUPABASE_SECRET_KEY`. Tests use an in-memory store.

## Environment (names only)
`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `APP_ANTHROPIC_API_KEY` (the only model key name), `AI_MODEL`
(currently `claude-sonnet-5`), optional `DEMO_SESSION_SECRET` (otherwise derived server-side from
the Supabase secret). `VERCEL_TOKEN` is a deployment credential only.

## Run
```bash
cd app
npm install
npm run dev            # http://localhost:3000
npm test               # Vitest: rules, money, journeys, permissions (in-memory store)
npx tsc --noEmit       # typecheck
npm run build          # production build
```
Browser checks use `playwright-cli` from the repo root (it reads `.playwright/cli.config.json`).

## Where things live
- `app/src/lib/contracts` — shared domain types, Zod command union, AI and document schemas
- `app/src/server/config` — one source of truth for plans, rates, rules, pay calendar, identities
- `app/src/server/domain` — deterministic engine (timing, eligibility routing, money, execution,
  reconciliation, payroll, COBRA, clock and due jobs)
- `app/src/server/{runner,views,session,guard}.ts` — command runner, role-scoped read models,
  signed demo sessions
- `app/src/app` — pages (employee, HR, broker, simulators) and API routes
