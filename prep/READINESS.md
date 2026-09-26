# Niural prep readiness

Last checked: 2026-09-26. Branch: `claude/nice-wright-y42c0p`.
Status terms: **Installed** (files present), **Configured** (settings written),
**Tested** (observed working), **Blocked** (needs something only Samyak can give).

| Area | Status | Evidence |
|---|---|---|
| Core skills (impeccable, ui-ux-pro-max, ai-sdk, supabase, supabase-postgres-best-practices, vercel-react-best-practices, vercel-composition-patterns, web-design-guidelines, playwright-cli, systematic-debugging, verification-before-completion) | Tested | All listed as model-invocable in a fresh session (prep/fresh-session-check.md) |
| Competing design skills (design, brand, slides, banner-design, design-system, ui-styling) | Tested | `disable-model-invocation: true`; hidden and refused by the Skill tool in a fresh session. Still usable by typing the slash command |
| Account-level design skills (frontend-design, theme-factory, brand-guidelines, canvas-design, web-artifacts-builder) | Configured | Not removed (global). NIURAL.md forbids them for product UI |
| NIURAL.md rules via CLAUDE.md | Tested | Loaded into context in a fresh session |
| niural-ui, niural-backend, niural-verifier agents | Tested | Listed in a fresh session; verifier preloaded its skills, read DESIGN.md, captured a screenshot |
| Impeccable design hook (per edit plus turn-end pass) | Tested | Flagged planted gradient text; runs without the machine-local consent file; enabled in a fresh session |
| Impeccable context | Tested | Resolves PRODUCT.md and DESIGN.md |
| Browser automation | Tested | Launch, click, fill, reload, screenshot at 1440x900 against a practice app |
| Next.js scaffold, build, Google font | Tested | create-next-app, `npm run build`, next/font Inter all worked |
| Practice workflow (unrelated equipment reservation, outside repo) | Tested | Server-side validation, save, survives refresh, double booking refused, no console errors |
| Reference screenshots | Blocked | design/reference/ holds only README.md |
| Setup script | Blocked | Fresh session started without playwright-cli; the saved script fails or is missing |
| shadcn component registry | Blocked | ui.shadcn.com denied by network policy (CONNECT 403) |
| Supabase | Blocked | No credentials; supabase.com and *.supabase.co denied by network policy |
| App AI model calls | Blocked | No ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY. api.anthropic.com is reachable; ai-gateway.vercel.sh is denied |
| AI SDK online docs | Blocked | ai-sdk.dev denied. Bundled docs in node_modules/ai/docs still work once `ai` is installed |
| Preview route for your laptop | Blocked | No VERCEL_TOKEN; api.vercel.com denied by network policy |

## Not yet proven
- A real Supabase write and read, and a real model call, from the practice app.
- A preview URL opened from your laptop.
- The first-draft UI matched against real Niural screenshots.
