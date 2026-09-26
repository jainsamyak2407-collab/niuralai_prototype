# Fresh-session readiness check

Date: 2026-09-26. First run on claude/nice-wright-y42c0p. Rows 1, 7, 8 and 9 re-run the same day in a later session; all pass. No app code built.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Setup script installed playwright-cli | PASS | `command -v playwright-cli` finds `/opt/node22/bin/playwright-cli`, version 0.1.21, with no manual install. |
| 2a | Required skills model-invocable | PASS | All 11 listed: impeccable, ui-ux-pro-max, ai-sdk, supabase, supabase-postgres-best-practices, vercel-react-best-practices, vercel-composition-patterns, web-design-guidelines, playwright-cli, systematic-debugging, verification-before-completion. |
| 2b | Blocked skills hidden | PASS | design, brand, slides, banner-design, design-system, ui-styling not in the skills list. (anthropic-skills:frontend-design, theme-factory, brand-guidelines, canvas-design, web-artifacts-builder do appear as account-level skills; NIURAL.md forbids them for product UI.) |
| 2c | Skill tool refuses design-system | PASS | Refused: "cannot be used with Skill tool due to disable-model-invocation". |
| 3 | CLAUDE.md imports NIURAL.md | PASS | CLAUDE.md is `@NIURAL.md`; the "Skill authority" section was in context without reading the file. |
| 4 | Niural agents available | PASS | niural-ui, niural-backend, niural-verifier all listed as agent types. |
| 5 | Verifier agent smoke test | PASS | open about:blank, screenshot to /tmp/verifier-smoke.png (5850 bytes), close all exit 0; .playwright-cli folder removed; git status clean. Preloaded skills: playwright-cli, web-design-guidelines, verification-before-completion. Read DESIGN.md (4124 bytes). Ran after the manual install from step 1. |
| 6a | Impeccable hooks in settings.json | PASS | PostToolUse and Stop both run `.claude/skills/impeccable/scripts/impeccable hook`. |
| 6b | `impeccable hooks status` | PASS | state: enabled; ignoreValues: overused-font=inter; maxFindings 5. |
| 6c | `impeccable context` paths | PASS | productPath "PRODUCT.md", designPath "DESIGN.md". |
| 7 | design/reference/ contents | PASS | 1.png to 5.png, app/ (ai-assistant-panel, benefits, contracts, hire-worker-type, payroll-home, salary-updates, wallet), site/, README.md. |
| 8 | Credentials | PASS | Set and tested live: Supabase REST 200 with the secret key; Anthropic message to AI_MODEL (claude-sonnet-5) 200 via APP_ANTHROPIC_API_KEY; `vercel whoami` returns jainsamyak2407-collab; VERCEL_ORG_ID and VERCEL_PROJECT_ID set. AI_GATEWAY_API_KEY unset and not needed (NIURAL.md uses APP_ANTHROPIC_API_KEY only). |
| 9 | Network | PASS | All hosts answer through the proxy: registry.npmjs.org, ui.shadcn.com, ai-sdk.dev, supabase.com/docs 200; api.vercel.com, ai-gateway.vercel.sh 308; cdn.playwright.dev 400 on the bare root (reachable). No CONNECT 403. |

## Other observations
- MCP server 80871625-... needs OAuth authorization; 9020c34c-... failed to connect (404).
