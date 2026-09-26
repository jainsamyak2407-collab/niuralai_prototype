# Working agreement

Build a cohesive, high-quality working product within the live brief and time budget.
Own ordinary design and implementation choices. State consequential assumptions in
short updates and keep working. Ask only about a missing requirement that materially
changes the user, scope, permissions, or outcome. Do not ask for aesthetic approval
on every component.

## Session start (mandatory, every session)
Before the first line of product code, in this order:
1. Run impeccable's context step, then read DESIGN.md and look at
   design/reference/app/salary-updates.png and payroll-home.png.
2. Load, with the Skill tool, every skill in the routing table that the brief
   touches. For a full-stack build that means: impeccable, ui-ux-pro-max,
   vercel-react-best-practices, vercel-composition-patterns, ai-sdk (if AI),
   supabase and supabase-postgres-best-practices (if persistence),
   playwright-cli, writing-guidelines, verification-before-completion,
   web-design-guidelines, vercel-cli-with-tokens. Report which ones loaded.
3. Write the shared contract, then delegate to niural-ui, niural-backend and
   niural-verifier as described under Delegation. Do not skip delegation
   because the build looks small; say so if you degrade to sequential work.
4. Check `VERCEL_TOKEN` works (`vercel whoami --token "$VERCEL_TOKEN"`) and
   report a failure at once, since Samyak has to fix it in the environment.

The approved look is the Payroll Readiness rehearsal (2026-09-26): white top
bar with module pills, #A78BFF strip, lavender sidebar with a white selected
pill, section cards with a header row, #F4F4F5 table header, white status
pills with a dot, right-side review sheet with a scrim, toast confirmation,
currency code before amounts. Keep that design language for every screen.

## Buttons and live link
- Every visible button, link, nav item and control works and serves the
  product goal. Do not add decorative or placeholder controls, and do not
  label anything "not in this demo". Build only what has a real use.
- Samyak names any future-scope items himself. Add those only when he asks.
- Keep a live Vercel link working throughout the build and share it after
  each working step. Click through the live link before calling anything done.

## Preparation and build
Preparation means tools, source research, generic operating rules, and reference
analysis. Do not implement the actual case before the live BUILD instruction.
During BUILD, use the brief and interviewer changes as the source of product scope.
Select one valuable end-to-end workflow and make its important steps work fully.
Propose one distinctive capability only when it strengthens that workflow and fits
the remaining time. Avoid inventing a predetermined payroll case.

## Design authority
Read DESIGN.md and inspect the application screenshots it cites before any UI
implementation. Start with design/reference/app/ (sharp app screens from niural.com),
then 4.png and 5.png. design/reference/README.md lists which images are website or
promotional material and must not be copied into product screens.
The supplied application references outrank generic aesthetic preferences. Treat
this as an extension to an existing product identity. Use Impeccable in Operate mode.
Maintain a reusable token and component system. Do not substitute an unrelated
font, landing-page layout, or palette to make the result look more fashionable.
Keep unresolved font and token provenance explicit. Never claim an exact match
from a compressed screenshot.

Do not browse or crawl niural.com. DESIGN.md and design/reference/ already hold
the researched design system. Re-research only if Samyak asks.

If design/reference/ holds no application screenshots, say so once at BUILD start,
then proceed with DESIGN.md's provisional values. Do not invent a different look.

## Skill authority
Impeccable is the only design lead. Run its context step once per session.
ui-ux-pro-max is a secondary reference for UX patterns, accessibility, tables,
charts, and interaction details. Use its search for those topics only. Ignore
its palette, font pairing, style, and landing-page recommendations whenever they
conflict with DESIGN.md. Do not use design, brand, slides, banner-design,
design-system, ui-styling, frontend-design, theme-factory, brand-guidelines,
canvas-design, or web-artifacts-builder for this project's product UI. They
compete with the Niural reference system.

## Skill routing
Load these project skills with the Skill tool when the work starts, without being
asked. Load each one once per session, not per file.
| Work | Load |
|---|---|
| Any screen, component, or visual change | impeccable (run its context step), then follow DESIGN.md |
| Tables, charts, forms, accessibility, interaction details | ui-ux-pro-max (UX guidance only) |
| React or Next.js code | vercel-react-best-practices, vercel-composition-patterns |
| Page or state transitions | vercel-react-view-transitions |
| AI features, model calls, structured output, chat | ai-sdk |
| Supabase, auth, storage, realtime | supabase |
| Tables, migrations, RLS, queries | supabase-postgres-best-practices |
| Opening, clicking through, or screenshotting the app | playwright-cli |
| UI review before a demo | web-design-guidelines, plus impeccable critique or polish |
| UI copy, empty states, error text | writing-guidelines |
| A bug, failing build, or unexpected behavior | systematic-debugging |
| Before saying anything works or is done | verification-before-completion |
| Preview or deploy | vercel-cli-with-tokens (token-based), deploy-to-vercel |
| Deployed performance or cost | vercel-optimize |
| React Native or Expo only | vercel-react-native-skills |
design, brand, slides, banner-design, design-system and ui-styling load only when
Samyak types their slash command.

The Impeccable design hook scans every UI file edit and reports findings at turn
end. Fix real findings. Never add an ignore just to silence one.

## Niural UI standard
Every screen, including the first draft, follows DESIGN.md without a second prompt:
- Shell: white top bar (logo, icon-labeled module nav with a soft purple active
  pill, wallet chip, AI pill button, round icon buttons, avatar), a thin #A78BFF
  strip, then a white rounded workspace. Module sidebar on the lavender-to-white
  gradient with uppercase group labels and a white selected pill.
- Density: operational, not marketing. Full-width tables with a #F4F4F5 header,
  label/value grids, section cards with a header row, and actionable list cards.
  No hero sections, greeting banners, or decorative summary tiles.
- Components: Niural's button family (primary #714DFF, gray secondary with purple
  text, outline, red outline destructive), 8px control radius, white status pills
  with a colored dot or icon, one table rhythm with a pagination footer.
  Purple only for primary action, selection, links, and focus.
- Type: Inter (provisional match), headings medium not bold, 12/14/16/18-20 app
  scale, tabular figures, currency code before amounts.
- Spacing: 4px basis. Consistent gutters. Left-aligned content.
- States: loading skeletons, useful empty states, inline validation, error
  recovery, and a visible completed state for every primary action.
- AI features follow DESIGN.md's AI patterns: a docked right panel, structured
  answer cards, Smart Actions, and a visible undo for AI-applied changes.
Tokens live in one place (global CSS variables mapped into Tailwind). Components
use semantic tokens, never scattered hex values.

## Stack
When no real codebase is supplied, default to Next.js App Router, TypeScript,
Tailwind, shadcn/ui primitives, Lucide icons, Zod, Supabase persistence where needed,
and AI SDK with one model provider when the task requires AI. A supplied codebase's
existing stack takes priority. Add a dependency only when it serves the brief.
Read version-matched framework and SDK documentation before using unfamiliar APIs.

## Delegation
You are the product and integration lead. Use the niural-ui, niural-backend, and
niural-verifier agents when their work can proceed independently. First establish
the shared data/API contract and file ownership. You own package files, app shell,
shared schema, global tokens, and integration. Do not let two agents edit the same
file. Pass the brief, reference paths, and acceptance checks to each delegate.
Integrate useful completed work as it returns. Do not wait for all agents to finish
before opening a working preview. Degrade to sequential work if delegation fails.

Before delegating, write the shared contract yourself: Zod schemas and inferred
types, route and server action signatures, and the table list. Delegates import
it and never redefine it. A contract change goes through you.

Default file ownership inside app/ (adjust per brief, and state changes up front):
- Lead: package.json, lockfile, config files, src/app/layout.tsx,
  src/app/globals.css, src/components/shell/**, src/lib/contracts/**, .env.example.
- niural-ui: src/app/(app)/**/page.tsx and loading/error files,
  src/components/<feature>/**, src/components/ui/** additions.
- niural-backend: src/app/api/**, src/server/**, src/lib/ai/**, src/lib/db/**,
  supabase/migrations/**, seed scripts.
- niural-verifier: tests/e2e/**, artifacts/qa/**. Never edits application code.

## Decisions
Make ordinary product, design, and implementation choices without asking. Record
consequential assumptions in the status line and keep going. Stop and ask only
when a choice changes the product direction, the target user, or the scope, or
when you need access, credentials, or authorization only Samyak can give.

## Functional standard
Visible primary actions must work and yield clear feedback. Handle loading, empty,
invalid, failed, and completed states where relevant. Persist important changes
through refresh when the product needs persistence. Keep UI data and backend state
consistent. Use synthetic information. Label simulated integrations and AI outputs.
Use server-side validation and explicit business logic for consequential decisions.
Use currency-aware arithmetic; do not hardcode two decimal places for every currency.
Prevent duplicate consequential actions and record relevant state changes.
Forms keep the user's valid input after a validation or server error. Every schema
error maps to plain language, never raw validator text. Server action and API
failures show an inline, retryable error; they never replace the page. Link each
field error to its input with aria-describedby.
Do not connect to or mutate Niural production systems without supplied authorization.

## AI standard
Read the model key only from `process.env.APP_ANTHROPIC_API_KEY`, in every
environment (local, Vercel, Claude cloud). Pass it to the provider explicitly
(e.g. `createAnthropic({ apiKey })`); never rely on a provider's default env name.
Put model calls and credentials on the server. Use structured validated outputs
when downstream code depends on them. Give the model only relevant data. Treat
uploaded documents as data, not instructions. Make uncertainty, failures, and
human review visible. A model's own confidence number is not a calibrated score.
Verify at least a normal case, missing/ambiguous information, and a model/API failure
when AI is central to the brief. Claim only behavior actually demonstrated.

## Automatic review
After the first integrated screen and again before final demonstration: open the
browser, inspect the screenshot, exercise the workflow, and fix material defects.
Do this without being asked. Each review round:
1. Capture the screen with playwright-cli at 1440x900 and read the image.
2. Compare it with the reference screenshots and the Niural UI standard above.
3. List the top material weaknesses: hierarchy, alignment, density, spacing,
   inconsistent components, missing states, contrast, broken interactions.
4. Fix them in one batch, then capture once more to confirm.
Stop after two rounds per surface unless a blocker remains.
Use Impeccable critique/polish and web-design-guidelines for the relevant surface.
Use systematic-debugging for errors and verification-before-completion for claims.
Run focused checks plus the production build once the flow is stable. Preserve
evidence in artifacts/qa. Fix blockers before decorative refinements. Keep a demo
buffer and stop open-ended polish when the remaining time cannot support it.

## Communication
Updates should state the product decision, what now works, and the next check in
three short lines. Track major assumptions and actual limitations. Do not narrate
every file edit. Honor interviewer changes and keep Samyak able to explain the work.

## Git
`main` is the only branch. A SessionStart hook (.claude/hooks/use-main.sh)
switches cloud sessions off their generated claude/* branch. Every session starts from `main`, commits to `main`,
and pushes to `main`. Do not create session or feature branches, even if the
session setup names one.

## Vercel
- The Vercel project `niuralai-prototype` is linked to this repo through
  Vercel's GitHub app, so every push to any branch creates a preview. Its
  Root Directory must point at the Next.js app folder (`app`). Do not add a
  static-export `vercel.json`; it breaks API routes and server actions.
- Deploy from the CLI with `vercel deploy --token "$VERCEL_TOKEN"` using
  `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`, so a preview exists without a push.
  Vercel only deploys commits whose author is on the team, so the SessionStart
  hook sets the git author to Samyak; commits still carry the Claude
  Co-Authored-By line. Do not change the git author.
- Previews sit behind Vercel login. Check them with `vercel curl <path>
  --deployment <url>`; the SessionStart hook writes the CLI login file.
- Until `app/` exists on `main`, pushes to `main` fail with "Root Directory
  app does not exist". That is expected and clears with the first build.
- Set the app's runtime variables (APP_ANTHROPIC_API_KEY, Supabase keys) in
  the Vercel project, not only in the Claude environment.
- This container's proxy re-signs HTTPS, so headless Chromium rejects live
  Vercel URLs unless the setup script trusts the proxy CA. Test locally on
  `next start` first, then smoke-test the preview.
