# Niural prep readiness

Last checked: 2026-09-26. Branch: `claude/dazzling-volta-7u1esu` (fresh cloud session).
No application code exists yet. Status terms: **PASS** (observed working in this
session), **FAIL** (checked and broken or missing), **NOT YET TESTED** (config found,
behavior not exercised). Earlier sessions' results are marked as such.

## Summary

| # | Area | Result | Blocker / next action |
|---|---|---|---|
| 1a | Core skills listed | PASS | None |
| 1b | Competing design skills hidden | PASS | None |
| 1c | Niural agents available | PASS (listed) / NOT YET TESTED (run) | Run verifier on the first practice screen |
| 1d | Impeccable precedence and hooks | PASS (config + detector) / NOT YET TESTED (hook firing on a UI edit) | First UI edit in the practice build will show it |
| 2 | Visual references | PASS, with gaps listed below | Optional: supply extra screenshots |
| 3 | Browser (playwright-cli) | PASS | Run it from the repo root (see note) |
| 4 | Network | PASS | None |
| 5 | Supabase | PASS (read) / NOT YET TESTED (write) | Empty schema; write test needs a table in the practice build |
| 6 | Anthropic | **FAIL** | `ANTHROPIC_API_KEY` is not in this cloud environment |
| 7 | Vercel | PASS, with two flags | Change production branch; plan for preview protection |

## 1. Instructions and skills

- CLAUDE.md is `@NIURAL.md`; NIURAL.md loaded into context at session start. PASS.
- Core skills in the session skill list: impeccable, ui-ux-pro-max, ai-sdk, supabase,
  supabase-postgres-best-practices, vercel-react-best-practices, vercel-composition-patterns,
  web-design-guidelines, playwright-cli, systematic-debugging, verification-before-completion. PASS.
- design, brand, slides, banner-design, design-system, ui-styling: each SKILL.md has
  `disable-model-invocation: true` and none appear in the session skill list. PASS.
  Account-level frontend-design, theme-factory, brand-guidelines, canvas-design,
  web-artifacts-builder still appear; NIURAL.md forbids them for product UI (rule only).
- Agents niural-ui (impeccable, vercel-react-*), niural-backend (ai-sdk, supabase,
  supabase-postgres-best-practices), niural-verifier (playwright-cli, web-design-guidelines,
  verification-before-completion) are listed as agent types. Not run this session; an
  earlier session ran the verifier successfully.
- Impeccable precedence: NIURAL.md "Skill authority" names Impeccable the only design lead.
  `.claude/settings.json` runs `impeccable hook` on PostToolUse (Edit|Write) and Stop.
  `impeccable hooks status`: enabled, ignoreValues `overused-font=inter`, maxFindings 5.
  `impeccable context` resolves PRODUCT.md and DESIGN.md.
- Tested: `impeccable detect` on a planted test page flagged `gradient-text` and
  `flat-type-hierarchy`. Not tested this session: the hook firing automatically after a
  UI file edit (no UI files exist yet).

## 2. Visual references

- 19 PNGs committed and readable (valid headers, sizes checked; four opened visually in
  earlier sessions). app/ screens are 1512 px wide; 4.png and 5.png are small video frames
  (1120x628, 899x512); ai-assistant-panel.png is an 800x800 video frame.
- DESIGN.md links all 7 app screens plus 4.png, 5.png, site/ and the promo exclusions.
  design/reference/README.md classifies every root image.
- Gaps between the written rules and the images:
  - App font is unverified (DESIGN.md says so; Inter is provisional).
  - No logo asset file; the top-bar logo must be a text/placeholder mark.
  - No reference for loading skeletons, empty states, inline validation, toasts,
    modals or drawers. NIURAL.md requires these, so their look is an estimate.
  - No application home/dashboard screen; the old list also named a Documents and
    Compliance table and a logo crop, still missing.
  - The AI panel reference is a low-resolution video frame; Smart Actions and the undo
    pattern are rules without a matching image.
  - 4.png and 5.png are too small for reliable pixel measurement.

## 3. Browser tools — PASS

- `playwright-cli` 0.1.21 at `/opt/node22/bin/playwright-cli` (present at session start).
- Served a temp page from the session scratchpad (outside the repo), opened it at
  1440x900, clicked a button, confirmed the text changed, saved a 16.9 KB screenshot and
  read it. Browser closed; `.playwright-cli/` removed; repo clean.
- Note: the first launch from the scratchpad failed ("chrome not found at
  /opt/google/chrome/chrome") because `.playwright/cli.config.json` (which sets
  `/opt/pw-browsers/chromium`) is only found from the repo root. Always run
  playwright-cli with the repo root as the working directory.

## 4. Network — PASS

| Host | Code | Meaning |
|---|---|---|
| registry.npmjs.org | 200 | Reachable |
| ui.shadcn.com (registry index) | 200 | Reachable (was blocked earlier; now allowed) |
| supabase.com | 200 | Reachable |
| project `*.supabase.co` | 401 without key, 200 with key | Reachable; auth works |
| api.anthropic.com | 401 without key | Reachable; auth needed (not a network block) |
| api.vercel.com | 403 without token, 200 with token | Reachable; auth works |
| ai-sdk.dev | 200 | Reachable |

## 5. Supabase — PASS (read only)

- All four variables present. `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` are identical,
  `https://<20-char ref>.supabase.co`, no trailing slash.
- Publishable key has the `sb_publishable_` prefix; secret key has a valid prefix.
- Reads with the secret key: REST root 200 (OpenAPI returned), Auth admin users 200
  (empty list), Storage buckets 200 (none). Auth settings with the publishable key 200.
  Publishable key on the REST root returns 401 "Secret API key required", which is
  expected for that endpoint.
- Limitation: the public schema has no tables (only `/rpc/rls_auto_enable`). No write,
  RLS, or row read can be tested until the practice build creates a migration.

## 6. Anthropic — FAIL

- `ANTHROPIC_API_KEY` and `AI_GATEWAY_API_KEY` are both absent from this cloud container,
  so no application server process here can call a model. Claude Code's own
  `ANTHROPIC_BASE_URL` session routing was not used as proof.
- `AI_MODEL` is set to `claude-sonnet-5`, a current model ID, but it could not be
  checked against this account's model list without a key.
- No model request was made.
- The key is set in Vercel (production and preview), so a deployed app may work, but
  that is unproven.
- **Next action:** add `ANTHROPIC_API_KEY` to this Claude cloud environment's
  environment variables, start a new session, then re-run:
  `GET https://api.anthropic.com/v1/models` (confirm `AI_MODEL` is listed) and one
  minimal `POST /v1/messages` (max_tokens 16) from a Node server process.

## 7. Vercel — PASS with flags

- `VERCEL_TOKEN` is valid and team-scoped: project reads work; `/v2/user` returns
  "User not found" and team listing is forbidden, which fits a team token.
- Project `niuralai-prototype` (team account) is linked to GitHub
  `jainsamyak2407-collab/niuralai_prototype`; Git deployments enabled.
- Root directory: repo root. Framework, build, install, output commands: unset (auto).
  Node 24.x.
- Env var names, all type `sensitive`, targets production and preview:
  SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY, AI_MODEL. `VERCEL_TOKEN` is not in Vercel,
  which is correct.
- Existing deployments: 4 READY production builds of the docs-only branch.
- **Flag 1:** production branch is `claude/nice-wright-y42c0p` (the old prep branch).
  Every push to it deploys to production, and pushes to other branches (including this
  one) create preview deployments automatically. Next action: in Vercel Project
  Settings > Git, set the production branch to the branch the build will use (or `main`).
- **Flag 2:** Deployment protection (`all_except_custom_domains`) is on. A preview URL
  will ask for Vercel login on your laptop. Next action: stay logged in to Vercel in the
  demo browser, or create a Protection Bypass for Automation if the verifier must open it.
- Not yet validated until an app exists: framework detection (Next.js), build and
  install commands, output, Node 24 compatibility, and that sensitive `NEXT_PUBLIC_*`
  values are inlined at build time.

## Not yet proven
- A Supabase write and read-back from the practice app.
- Any model call, local or deployed.
- A working preview URL opened from your laptop.
- The Impeccable hook firing on a real UI edit.
