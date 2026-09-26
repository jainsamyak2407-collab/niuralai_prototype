# Fresh-session readiness check

Date: 2026-09-26. Branch: claude/nice-wright-y42c0p. No app code built; no existing file edited.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Setup script installed playwright-cli | FAIL | `command -v playwright-cli` returned nothing (exit 1). Installed manually with `npm install -g @playwright/cli@0.1.21`; then `/opt/node22/bin/playwright-cli`, version 0.1.21. |
| 2a | Required skills model-invocable | PASS | All 11 listed: impeccable, ui-ux-pro-max, ai-sdk, supabase, supabase-postgres-best-practices, vercel-react-best-practices, vercel-composition-patterns, web-design-guidelines, playwright-cli, systematic-debugging, verification-before-completion. |
| 2b | Blocked skills hidden | PASS | design, brand, slides, banner-design, design-system, ui-styling not in the skills list. (anthropic-skills:frontend-design, theme-factory, brand-guidelines, canvas-design, web-artifacts-builder do appear as account-level skills; NIURAL.md forbids them for product UI.) |
| 2c | Skill tool refuses design-system | PASS | Refused: "cannot be used with Skill tool due to disable-model-invocation". |
| 3 | CLAUDE.md imports NIURAL.md | PASS | CLAUDE.md is `@NIURAL.md`; the "Skill authority" section was in context without reading the file. |
| 4 | Niural agents available | PASS | niural-ui, niural-backend, niural-verifier all listed as agent types. |
| 5 | Verifier agent smoke test | PASS | open about:blank, screenshot to /tmp/verifier-smoke.png (5850 bytes), close all exit 0; .playwright-cli folder removed; git status clean. Preloaded skills: playwright-cli, web-design-guidelines, verification-before-completion. Read DESIGN.md (4124 bytes). Ran after the manual install from step 1. |
| 6a | Impeccable hooks in settings.json | PASS | PostToolUse and Stop both run `.claude/skills/impeccable/scripts/impeccable hook`. |
| 6b | `impeccable hooks status` | PASS | state: enabled; ignoreValues: overused-font=inter; maxFindings 5. |
| 6c | `impeccable context` paths | PASS | productPath "PRODUCT.md", designPath "DESIGN.md". |
| 7 | design/reference/ contents | FAIL | Only README.md, which says "images not uploaded yet". No screenshots present. |
| 8 | Credentials | BLOCKED | Not set: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, APP_ANTHROPIC_API_KEY, AI_GATEWAY_API_KEY, AI_MODEL, VERCEL_TOKEN. |
| 9 | Network | FAIL (partial) | registry.npmjs.org/ai 200. Proxy CONNECT 403 (curl 56) for ui.shadcn.com, api.vercel.com, ai-gateway.vercel.sh, supabase.com, ai-sdk.dev, cdn.playwright.dev. |

## Other observations
- MCP server 80871625-... needs OAuth authorization; 9020c34c-... failed to connect (404).
