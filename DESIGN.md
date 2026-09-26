# Niural application reference system

Status: seed based on supplied screenshots; not Niural's official design system.
Surface mode: Operate. Preserve the incumbent application language.
Sources: design/reference/; prioritize the flat All Entities application frame,
entity detail, and document table. Marketing animations are secondary evidence.

## Authority
Use any supplied official design tokens or verified app computed styles first.
Otherwise use these provisional values consistently and refine by screenshot review.
The font, dimensions, and unsampled colors below are implementation choices, not
claims about Niural's internal design files. Update provenance when better evidence
arrives. Keep the application identity stable across all agent work.

## Color
- Surface: #FFFFFF (observed pixels)
- Canvas: #FAFAFA (observed pixels)
- Sidebar base: #EDE9FE (observed pixels; frame contains a range of lavender tones)
- Primary action: #7550FF (observed button pixels; original token unverified)
- Main text: #171717 (provisional)
- Secondary text: #737373 (provisional; check contrast in actual usage)
- Border: #E5E5E5 (provisional)
- Success text: #15803D (provisional; pair with label/icon)
- Warning text: #A16207 (provisional; pair with label/icon)
- Error text: #B91C1C (provisional; pair with label/icon)
- Focus: primary accent with a clearly visible outline.
Use semantic tokens rather than scattered literals. Check text contrast against
the actual background; accuracy to a video sample does not override legibility.

## Type
Application family remains unverified. Use Inter as a provisional implementation
choice with system sans-serif fallback; replace it when actual app evidence is
available. Do not describe Inter as an exact identification. The marketing site's
font declarations are not the app's typography specification.
Suggested scale: 12px metadata, 14px interface body, 16px section titles, 22px page
title. Use 400/500/600 weights. Use tabular figures for aligned numerical data.
These sizes target a readable laptop demonstration, not raw screenshot pixels.

## Layout
Keep a compact white top navigation with organization context. Use a pale lavender
secondary sidebar with a white selected item. Keep content on white/off-white
surfaces with clear left alignment and consistent gutters.
Provisional dimensions: 56px header; 208px sidebar; 24px content gutter; 36px form
controls; 44–48px table rows. Adapt to content and viewport rather than copying the
downscaled video's apparent dimensions.
Use a 4px spacing basis: 4, 8, 12, 16, 24, 32. Prefer 6–8px control radius and
10–12px panel radius; dialogs may be larger. Use thin neutral borders and restrained
shadows. Reuse controls and interaction patterns across screens.

## Interaction
Use purple for the main action, selected tab underline, and focused/active states.
Use compact labeled status badges. Keep entity context visible in detail views.
Keep search, filtering, sorting, and primary action aligned when appropriate.
Use tabs for related detail sections. Use the reference document table rhythm for
data-heavy lists. Use dialogs/drawers only where they support the task.
Preserve focus, keyboard navigation, clear error recovery, and relevant state on
navigation. Respect reduced motion. Use brief state transitions, not constant motion.

## Exclusions from the operational UI
Do not recreate video playback controls, subtitles, world-map marketing art,
perspective distortion, or thick purple presentation frames as application UI.
Do not add oversized hero sections, ornamental glass panels, random gradients,
large greeting banners, or redundant summary cards to an operational workflow.
Brand expression should appear in precise components and interaction details.

## Reference verification
Inspect actual screenshots, not just this text. Compare navigation hierarchy,
content density, alignment, control sizing, whitespace, typography, and status
treatments. Use equivalent viewports/crops where practical. A whole-image pixel
score is not meaningful when the content differs. Document any unresolved mismatch.
