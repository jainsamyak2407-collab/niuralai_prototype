# Build contract for delegates (lead-owned)

Read first: GPT.md (build contract), docs/spec/QLE-Feature-Specification-v3.md, NIURAL.md,
DESIGN.md, design/reference/app/salary-updates.png and payroll-home.png. App lives in `app/`.

## What already works (do not rebuild)
- Domain engine: `app/src/server/domain/*` (rules, timing, money, execution, reconciliation,
  payroll, COBRA, clock/jobs). 22 passing tests in `app/tests/unit` cover birth, divorce, loss.
- Persistence: `app/src/server/store/store.ts` (Supabase Storage, append-only revisions).
- Commands: POST `/api/command` with the Zod union in `app/src/lib/contracts/commands.ts`.
  Client helper: `useCommand()` in `app/src/components/ui/client.tsx`.
- Read models: `app/src/server/views.ts` (role-scoped projections for every page).
- Session: `requireSession(roles)` in `app/src/server/guard.ts` (redirects if missing/wrong role).
- Shell, tokens, UI kit: `app/src/components/shell/**`, `app/src/app/globals.css`,
  `app/src/components/ui/{button,primitives,client}.tsx`, Emma dock `app/src/components/emma/EmmaDock.tsx`
  (use `AskEmmaButton` from it for "Explain with Emma").

## File ownership (never edit a file outside your list)
| Owner | Files |
|---|---|
| Lead | package.json, lockfile, configs, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/EntryClient.tsx`, `src/app/globals.css`, `src/components/shell/**`, `src/components/ui/**`, `src/components/emma/**`, `src/lib/**`, `src/server/{domain,store,config}/**`, `src/server/{views,runner,session,guard}.ts`, `src/app/api/{command,session,state,notifications,qle/cases/[id]/route.ts}` |
| niural-ui (employee) | `src/app/(app)/employee/**`, `src/components/employee/**` |
| niural-ui (hr) | `src/app/(app)/admin/**`, `src/app/(app)/broker/**`, `src/components/hr/**`, `src/components/broker/**` |
| niural-ui (simulators) | `src/app/(app)/demo/**`, `src/components/demo/**` |
| niural-backend | `src/app/api/{emma,documents,evidence,fixtures}/**`, `src/app/api/qle/cases/[id]/evidence/**`, `src/server/{ai,fixtures,docs}/**`, `src/lib/ai/**` |
| niural-verifier | `app/tests/e2e/**`, `artifacts/qa/**` |

Need data a view does not return? Add a read-only helper in your own folder that calls
`loadState(scenarioId)` from `@/server/views` and filters by the session role. Never widen what
a role can see. Contract changes (commands, domain types) go through the lead.

## Rules every delegate follows
- Never run `git commit`/`git push`, `npm install`, or `next build`. The lead integrates.
- A dev server already runs at http://localhost:3000 (hot reload). Do not start another.
  Sign in by POSTing `{"userId":"u_maya"|"u_daniel"|"u_priya"|"u_carrier"|"u_cobra"|"u_ops","scenarioId":"birth"|"divorce"|"loss"}`
  to `/api/session/demo`, or click through `/`. The demo operator (u_ops) can reset a scenario
  (`ops.reset` with `confirmScenario`) — reset only the scenario you are testing.
- Typecheck your files: `cd app && npx tsc --noEmit`.
- Design: Niural Operate mode. Section cards with a header row, `#F4F4F5` table header,
  white status pills with a dot, 8px controls, medium (not bold) headings, currency code before
  amounts (`<Money>`), tabular figures, left-aligned content. Purple only for primary action,
  selection, links, focus. No hero sections, greeting banners, decorative stat tiles, emoji,
  gradient text, or colored side borders. Use semantic Tailwind tokens (`bg-fill`, `text-muted`,
  `border-line`, `text-primary`…), never raw hex.
- States: skeleton loading (`loading.tsx` with `Skeleton`), useful empty states, inline
  validation linked with `aria-describedby` (`Field`), `CommandError` for failed commands (keep
  the user's input), a visible completed state (toast from `useCommand` + page change).
- Every visible control works and changes persisted state, explains why it is disabled, or
  links somewhere real. No "coming soon", no placeholder buttons.
- Copy: plain, active, specific. Use the exact message patterns in GPT.md §9/§10. Never say
  "legally ineligible". Label simulations ("simulated", "illustrative", "synthetic").
- Use pages as server components that call a view, with small client components for forms.
  Pass `expectedVersion` from the view's `case.version`. Use a stable `intentKey`
  (`useIntentKey`) per form so a retry never repeats the effect.

## Backend contracts the UI can rely on (niural-backend implements)
- POST `/api/qle/cases/{caseId}/evidence` multipart: `file` (PDF/JPEG/PNG, ≤10 MB), optional
  `taskId` (answers an information request). Returns `{ ok, message, file?: { id, status, readMode, documentType, proposedFacts[], readNote } }`.
  Statuses: uploading → reading → needs_confirmation | accepted_for_review | unreadable | rejected.
  Employees confirm facts with the `case.confirmFact` command.
- GET `/api/evidence/{fileId}` — authorized preview/download (owner employee or the employer's HR).
- POST `/api/emma` `{question, caseId?, page?}` → `EmmaApiResult` (`src/lib/contracts/ai.ts`).
- GET `/api/documents/{kind}?caseId=&batchId=&runId=&referralId=` — see `src/lib/contracts/documents.ts`.
- GET `/api/fixtures/{id}` — fixture files listed in `FIXTURES` (`src/lib/contracts/documents.ts`).

## Commands by screen (see commands.ts for exact fields)
- Employee wizard: `case.createDraft` → `case.updateDraft` (facts) → evidence upload →
  `case.confirmFact` / `case.markEvidencePending` → `case.setElections` → `case.submit`
  (`attestation: true`, `asReviewRequest` for late/unclear) → tracker: `case.respond`,
  `case.withdraw`, `case.urgentSupport`.
- HR case: `hr.reviewEvidence`, `hr.requestInformation`, `hr.resolveCheck`, `hr.approve`
  (`revisionNo` = latest revision), `hr.decide`, `hr.escalate`, `hr.addNote`,
  `hr.sendCorrection`, `hr.assignBroker`, `hr.recordDeliveryInquiry`, `hr.sendCobraReferral`,
  `hr.resolveTask`. HR payroll: `hr.authorizePayroll`, `hr.requestPayrollCorrection`.
- Broker: `broker.recordSubmission`, `broker.recordResult`.
- Simulators: `ops.runBatch`, `ops.batchTransport`, `ops.batchValidation`, `ops.memberResult`,
  `ops.publishObservation` (needs a unique `eventId`), `ops.publishAccepted` (batch id, or an
  API transaction id for the dental/vision API route), `ops.payrollInstruction`,
  `ops.payrollPost`, `ops.cobra`, `ops.clock`, `ops.preset`, `ops.bounce`, `ops.reset`.
