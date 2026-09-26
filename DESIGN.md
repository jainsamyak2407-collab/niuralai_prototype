# Niural application reference system

Status: reconciled against the supplied screenshots. This is not Niural's official
design system. Surface mode: Operate. Preserve the incumbent application language.

## Sources
Visual source of truth, in priority order:
1. [design/reference/4.png](design/reference/4.png): Settings > All Entities (application UI)
2. [design/reference/5.png](design/reference/5.png): Entity detail, Overview tab (application UI)

Secondary evidence, never a layout source:
- [design/reference/3.png](design/reference/3.png): promotional payroll cards. Use only for status vocabulary.
- [design/reference/1.png](design/reference/1.png): promotional report cards. Use only for report names.
- [design/reference/2.png](design/reference/2.png): video overlay. Exclude entirely.

See [design/reference/README.md](design/reference/README.md) for the index. It also
lists the guide's screenshots that were not received, including the only table reference.

## Evidence levels
- **Observed**: visible in 4.png or 5.png (structure, labels, order, presence).
- **Measured**: pixel-sampled from 4.png or 5.png. These screenshots are downscaled and
  compressed, so a measured value is close but not a proven CSS token.
- **Estimate**: chosen to fit the screenshots. Replace it when better evidence arrives.
Never describe a measured or estimated value as exact.

## Authority
Use supplied official tokens or verified computed styles from a real Niural page
first. Otherwise use the values below consistently, and refine them by comparing
screenshots. Keep this file's evidence labels up to date.

## Color
| Token | Value | Evidence | Where seen |
|---|---|---|---|
| canvas | #FAFAFA | Measured (4.png between cards, 5.png page) | Content background behind cards |
| surface | #FFFFFF | Measured | Cards, inputs, selected sidebar item, detail card |
| topbar | #FFFFFF | Estimate (measured #FBFBFB, likely compression) | Top navigation bar |
| sidebar | vertical gradient #EBE4FF (top) to #F6F3FF (bottom) | Measured | Settings sidebar. A flat #F0ECFF is an acceptable approximation |
| primary | #7550FF | Measured (most frequent pixel in the Add Entity button) | Primary button, active tab underline, AI entry icon |
| border | #E8E8E8 | Measured range #E7E7E7 to #EAEAEA (1px edge) | Card and input borders |
| divider | #E4E4E4 | Measured range #E0E0E0 to #E8E8E8 | Under the tabs and the page header |
| text | #111111 | Measured darkest pixels #0E0E0E to #111111. The true value may be pure black | Headings, names, values, labels |
| text-muted | #7E7E7E | Measured | Addresses, location line, secondary text |
| sidebar-label | #88819C | Measured, violet-gray | Uppercase section labels on the lavender sidebar |
| success | green, value unverified | Observed (Verified check, HQ pill, payroll amounts in 3.png) | Verified, Paid, positive amounts |
| warning / error | values unverified | Not seen in the app screens | Use accessible amber and red with an icon and label |

The purple band around 4.png and 5.png (about #AD96FF) is a presentation frame, not
app UI. Check text contrast against the real background. Legibility beats matching a sample.

## Typography
- **Family: unverified.** The UI uses a clean neo-grotesque sans. Inter is a
  provisional implementation choice with a system sans fallback. Never claim it
  matches. The marketing site's font declarations are not evidence for the app.
- **Observed hierarchy**:
  - Page title ("All Entities") is semibold and larger than body text.
  - Entity name in the detail header ("Nexus Corp") is the largest text on screen.
  - Section title ("Company Information") is semibold.
  - Card title ("Nexus UK Ltd.") is semibold, with a muted address line below it.
  - Detail fields are a semibold label above a regular value, both dark.
  - Sidebar section labels are small uppercase muted text (ORGANIZATION, FEATURES,
    DEVELOPER, ADMINISTRATION).
  - Tabs and nav items use medium weight.
- **Scale (estimate)**: 12px sidebar labels and metadata, 14px body, labels and
  values, 16px section and card titles, 20 to 22px page title, 24px entity name in
  the detail header. Use 400/500/600 weights and tabular figures for numbers.
- **Data formats observed**: masked IDs ("*******474782"), dates as MM-DD-YYYY
  ("01-24-2023"), and currency with a symbol and two decimals ("$ 28,043.34").
  Other currencies still need currency-aware decimals.

## Layout (observed in 4.png, sizes are estimates)
- **Top bar, left to right**:
  - "Niural AI" logo, then an organization switcher ("Nexus Corp Global" with a
    green "HQ" pill and a chevron).
  - Primary nav as icon plus label: People, Payments, Niural Pay, Niural Insights,
    Integrations.
  - Right side: a wallet balance chip ("$ 28,043.34" with a chevron), an "Ask Emma"
    AI assistant button with a purple icon, search and settings icon buttons, and
    an avatar.
  - The bar is white and compact, about 56px tall.
- **Section sidebar** (about 200 to 210px):
  - A bold section title ("Settings"), then grouped items under uppercase labels.
  - Each item is a line icon plus a label.
  - The selected item is a white rounded pill with a faint shadow. Other items sit
    directly on the lavender.
- **Content**:
  - A page header strip with the page title and a thin bottom divider.
  - Below it, a toolbar row: a search input with a leading icon, then an outlined
    "Sort by" button with an icon, then an outlined square refresh icon button.
    The primary action ("+ Add Entity") is right-aligned.
  - Content sits in a centered column with generous side margins at laptop width.
- **Detail view (5.png)**:
  - Header: a round logo or avatar, the entity name, and an inline green "Verified"
    check.
  - Below it: a flag and a muted "• New York, US" location line.
  - Then a tab row with a full-width divider, a section title, and a white rounded
    card holding a 3-column label/value grid with generous row gaps.
- **Spacing**: 4px basis (4, 8, 12, 16, 24, 32). Card grid gap about 16px. Card
  padding about 16px. Detail grid row gap about 24px. All estimates.

## Components
- **Buttons**:
  - Primary: solid purple, white label, optional leading "+" icon, radius about
    8px, height about 36px.
  - Secondary: white with a 1px border and an optional leading icon ("Sort by").
  - Icon-only: square and outlined (refresh), or bare in the top bar (search,
    settings).
- **Inputs**: white, 1px border, radius about 8px, leading search icon,
  placeholder text ("Search entity").
- **List cards (4.png)**:
  - White, 1px light border, radius about 8 to 10px, very soft shadow.
  - Content: a round flag, a semibold name, a pin icon with a muted address that
    truncates with an ellipsis, and a "View Details" text action at the bottom left.
  - Three columns at laptop width.
  - These are operational list items that lead to a detail view. They are not
    decorative summary tiles.
- **Detail card (5.png)**: white, radius about 12px, no visible border on #FAFAFA,
  label/value grid inside.
- **Tabs**:
  - Text tabs in a row. The active tab has dark text and a purple underline about
    2px thick. Inactive tabs have dark regular text.
  - A full-width light divider sits under the row.
- **Pills and badges**:
  - Observed in the app: the green "HQ" pill and the green "Verified" check with a
    label.
  - Seen only in 3.png, a promotional graphic: white pills with a light border, a
    leading colored icon, and a short status label ("Awaiting Payment",
    "Calculating Payroll", "Salary Updates", "Awaiting Approval", "Paid").
  - Treat that vocabulary and pattern as plausible, not verified.
- **Icons**: thin line icons (Lucide is an acceptable stand-in), about 16px, in
  navigation, the sidebar and inline metadata. Country flags appear as round icons.
- **Tables: not observed.** The Documents & Compliance reference was not received.
  Until it is, use a plain table: white surface, a 1px border, a muted 12 to 13px
  header, 44 to 48px rows, thin row dividers, and left-aligned text with
  right-aligned numbers.

## Interaction
- Use purple for the primary action, the selected tab underline, and
  focus/active states.
- In the sidebar, show selection with the white pill, not purple.
- Keep search, sort, refresh and the primary action on one toolbar row.
- Use tabs for related detail sections, and keep the entity context in the header.
- Status always pairs color with an icon and a label.
- Keep focus visible and keyboard navigation working.
- Respect reduced motion. Use brief state transitions only.
- Any AI assistant entry should follow the "Ask Emma" pattern: a secondary button
  with a purple icon in the top bar. Label AI output as AI-generated.

## Exclusions from the application UI
Never reproduce any of these as app UI:
- The purple presentation frame around 4.png and 5.png, video controls, captions
  such as "Lack", or blurred montage backgrounds.
- The mock alert cards in 2.png.
- The glassmorphism, purple glow borders and gradient washes in 1.png.
- The large purple radial backgrounds, floating tilted cards and hero title in 3.png.

Operational screens also get no hero sections, greeting banners, ornamental glass,
random gradients, or redundant summary tiles.

Do not copy the literal "Sort by {title}" label in 4.png. It looks like an unfilled
template string in the source. Use a real label such as "Sort by name".

## Reference verification
Before calling a screen done, compare it side by side with 4.png and 5.png. Check:
- navigation hierarchy
- density
- alignment
- control sizing
- whitespace
- type weights
- status treatment

Use a similar viewport (1440x900). A whole-image pixel score means nothing when the
content differs. Record any unresolved mismatch.
