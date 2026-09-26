# Niural design system (reference for builds)

Status: built from Niural's public brand guideline, the live website's CSS and
rendered pages (34 pages crawled 2026-09-26), and full-size app screenshots
published on niural.com. This is not Niural's internal design file.
Surface mode for product builds: **Operate**. The product is a calm,
data-dense finance and HR tool. Purple marks action and selection.

## Evidence levels
- **Verified**: declared in Niural's CSS or brand guideline, or rendered by the browser
  from CSS (exact values).
- **Measured**: sampled from sharp app PNGs on niural.com. Very close, but it is a raster
  image, not a token.
- **Observed**: structure or behavior visible in screenshots.
- **Estimate**: chosen to fit. Replace it when better evidence arrives.

## Sources
Application UI (primary; use for every product build):

| File | Shows |
|---|---|
| [app/payroll-home.png](design/reference/app/payroll-home.png) | Payments > Payroll: upcoming payroll card, secondary and destructive buttons, tag, deadline text |
| [app/salary-updates.png](design/reference/app/salary-updates.png) | Data table with filters, flags, currency amounts, delta badge, status badges, row actions, pagination |
| [app/contracts.png](design/reference/app/contracts.png) | People > Manage: segmented tabs, toolbar, "+ New Contract", warning status, avatars, kebab menu |
| [app/benefits.png](design/reference/app/benefits.png) | Underline tabs, yellow warning banner, grouped table, provider chips, "View" buttons |
| [app/hire-worker-type.png](design/reference/app/hire-worker-type.png) | Form with selectable option cards and a select field |
| [app/wallet.png](design/reference/app/wallet.png) | Wallet: green balance card, info banner, transactions table, link actions |
| [app/ai-assistant-panel.png](design/reference/app/ai-assistant-panel.png) | "Niural AI" docked chat panel beside a table (frame from the site's Meet Emma video) |
| [4.png](design/reference/4.png), [5.png](design/reference/5.png) | Settings > All Entities card grid, and the entity detail with tabs and label/value grid (video frames) |

Brand and website (secondary; use for marketing surfaces and brand decisions):
- [site/brand-colors-typography.png](design/reference/site/brand-colors-typography.png): official palette and type samples from niural.com/brand
- [site/](design/reference/site/): home, product, pricing, blog, and tool pages at 1440x900

Promotional (vocabulary only, never a layout source): [1.png](design/reference/1.png) and
[3.png](design/reference/3.png). Excluded entirely: [2.png](design/reference/2.png).

## Design philosophy
Drawn from the brand guideline and consistent across the site and app:
- **Clean, modern, approachable.** Simple and legible, with no ornament. The tool should
  disappear into the task.
- **Purple dominates, but sparingly in the UI.** Niural Purple marks primary actions,
  current selection, links and highlights. Neutrals (white, gray) carry text and
  surfaces. Do not introduce colors outside the palette.
- **Trust for money and HR.** Plain numbers, explicit currencies, clear status, and
  visible deadlines. Payroll warnings are specific and dated.
- **Confident, helpful voice.** Clear, down-to-earth, active sentences. No jargon, slang
  or gimmicks. Niural speaks as a helpful co-pilot: "Please confirm salary adjustments
  by the cut-off date."
- **AI is a co-pilot inside the workflow.** It is not a separate product surface (see AI patterns).
- **Consistency.** One icon style (line icons, uniform stroke), one button family, one
  table rhythm across every module.

## Color
### Brand (verified: brand guideline and CSS `--brand-primary`)
| Token | Value | Use |
|---|---|---|
| primary | **#714DFF** (Niural Purple, PANTONE 2725 C) | Primary buttons, links, active tab underline, focus, selected text |
| primary-strong | #5226FF (measured #5022FF to #5A2EFF) | Selected nav and sidebar text and icons, secondary-button text |
| primary-soft | #E3DDFF (measured) | Selected top-nav pill background |
| tint-1..4 | #A080FF, #BCA6FF, #D5C9FF, #F1ECFF (verified swatches) | Hover fills, soft backgrounds, charts |
| app-backdrop | #A78BFF (measured) | The purple strip between the top bar and the workspace |
| accent-pink | #E151FF (Niural Pink, verified) | Rare accent only. The announcement bar gradient and AI sparkle. Never for UI states |

The brand page lists Pink's RGB as 255, 81, 255 (#FF51FF). That conflicts with its hex,
and the rendered swatch is #E151FF, so use #E151FF.

### Neutrals
| Token | Value | Evidence |
|---|---|---|
| text | #141417 | Verified CSS `--primary`. App measured #161618 |
| text-secondary | rgba(14,11,11,0.65) | Verified CSS `--secondary` |
| text-muted | #615E6E | Verified CSS `--muted` (the site's most common text color) |
| text-subtle | #616161 | Verified CSS |
| surface | #FFFFFF | Workspace, cards, inputs, top bar |
| canvas | #FAFAFA | Verified CSS gray-3. Grid pages such as All Entities |
| page-bg (site) | #F7F7F8 | Verified CSS gray-2 |
| fill | #F4F4F5 | Verified. Table header, secondary button, tag, search `/` key |
| segment-fill | #EBEBEB | Measured. Selected segmented tab |
| border | #E5E7EB | Verified CSS. App card edges measured #DBDBDB to #E0E0E4 |
| divider | #E3E3E3 | Measured. Table rows and card headers |
| neutral dark | #18181B, #27272A, #3F3F46, #52525B | Verified brand swatches. Dark surfaces only |

### Sidebar
A vertical gradient from #E5DEFF at the top to #F1EFFF in the middle to #FFFFFF at the
bottom (measured on sharp app images). The selected item is a white pill with a 1px
lavender border (about #E1DAFF) and primary-strong text and icon.

### Semantic (verified CSS tokens or measured app pixels)
| Meaning | Colors | Where |
|---|---|---|
| Success | dot #00C950. Wallet green #0BC15A (verified `--wallet-primary`). Text #32A06E | "Reviewed", "Enrollment Live", selected option card border, positive money |
| Info | #3F85F5 (verified blue-11) | Info dot, info banner icon |
| Warning | icon #F0B100. Banner #FEF9C2. Deadline text #CB7B00 | "Onboarding", "Processing", "In Review", enrollment banner, "Deadline: Nov 10" |
| Error / negative | text #F51023 (verified red-11). Negative amount #FB303B. Delta badge text #CE292E on #FEEBEC | Destructive outline button, "- USD 570.53", "↓ 12.8%" |

Status always pairs color with a dot or icon and a text label.

## Typography
- **Website: verified.** On all 34 crawled pages the loaded fonts were Inter (body, UI,
  buttons) and Inter Tight (headings). CSS also declares Manrope as `--font-family-primary`,
  but no page loads it.
- **Brand guideline** samples: Inter for "Body, Paragraph" and labels, and Switzer for
  "Title, Display".
- **App: unverified.** The letterforms in the app screenshots are consistent with Inter,
  but that is not proven. Use **Inter** for all app UI, and label it as a provisional
  match. Inter Tight is acceptable for large page titles and marketing headings. Do not
  add another family.
- **Website scale (verified computed styles)**:
  - Hero h1: 48px/600, line height 1.2, Inter Tight
  - Section h2: 32px/500, line height 1.3
  - h3/h4: 20px/500, line height 1.5, and 18px/400 at 29px
  - Body: Inter 16px/24px with -0.32px tracking
  - Buttons: 16px/400
- **App scale (measured from roughly 1:1 app images at 1512px wide)**:
  - Sidebar module title ("Payments"): about 18px/600
  - Page title ("Payroll", "Salary Updates"): 18 to 20px/500
  - Card and section title: 16 to 18px/500
  - Body, table cells, nav, sidebar items: 14px/400 to 500
  - Table header: 14px/400, darker than muted
  - Uppercase group labels: 12px/500 with slight tracking
  - Tags and badges: 12px
  - Use tabular figures for money and dates.
- Weights 400/500/600 only. Headings are medium, not bold.

## Shape, elevation, spacing (verified CSS unless noted)
- **Radius scale**: 4, 6, 8, 12, 16, 24px, and full.
  - Buttons and inputs: 8px (verified on site buttons, measured in the app)
  - Tags: 4 to 6px
  - Cards and panels: 10 to 12px
  - Workspace container: about 16px (measured)
  - Nav pills, avatars and status chips: fully rounded
- **Shadows** (Niural's own tokens):
  - `borders-base`: 0 0 0 1px #00000014, 0 1px 2px #0000001f
  - `elevation-flyout`: 0 0 0 1px #00000014, 0 4px 8px #00000014, 0 8px 16px #00000014
  - `elevation-modal`: adds a 0 16px 32px #00000014 layer
  - App cards mostly use a 1px border with little or no shadow.
- **Spacing**: 4px base (verified `--spacing: .25rem`). App measurements:
  - Sidebar padding about 24px
  - Workspace padding about 24px
  - Card padding 20 to 24px
  - Gap between cards about 16px
  - Table rows about 52 to 56px (dense tables down to 44px)
  - Controls about 36 to 40px tall in the app. Site buttons are 44px.

## App shell (observed on every app image)
1. **Top bar**, white, about 60px tall. From left to right:
   - "Niural AI" logo, then a thin vertical divider.
   - Module nav as icon plus label: People, Payments, Niural Pay, Organization, Niural
     Insights, Integrations. The active module is a primary-soft pill with
     primary-strong text.
   - Right side: a wallet balance chip (outlined pill, green wallet icon, "$ 28,043.34",
     up/down chevron), then an AI entry button (outlined pill with a purple sparkle,
     labeled "Niural AI" or "Ask Emma").
   - Then round outlined icon buttons (search, support or settings), a thin divider,
     and a round avatar.
2. **App backdrop**: a thin purple strip (#A78BFF) below the top bar. The white
   **workspace** panel sits on it with rounded top corners (about 16px) and small side
   insets.
3. **Module sidebar**, about 210 to 250px wide, on the lavender gradient:
   - Module title (18px/600).
   - Uppercase group labels (MONTHLY SALARY UPDATES, CONFIGURATION, HISTORY, TRACKING,
     REIMBURSE, CONFIGURATIONS) with line-icon items under each.
   - Settings and configuration items are pinned to the bottom.
4. **Content**:
   - Page title top-left, with an optional primary action top-right (for example
     "Settings" or "+ New Contract").
   - Then tabs, the toolbar, and the content.
   - Content stays left-aligned and fills the width. Tables run edge to edge inside the
     workspace.

## Components (observed)
- **Buttons**:
  - Primary: solid #714DFF with white text, 8px radius, optional leading "+" or
    trailing ">" icon ("Continue Payroll >", "+ New Contract", "Add Benefit").
  - Secondary: #F4F4F5 fill, 1px border, primary-strong text with a trailing chevron
    ("Run Bonus Payroll >").
  - Outline: white with a 1px border and dark text ("Export CSV", "All Status v",
    "Enrollment Census", "View").
  - Destructive: white with a red 1px border and red text ("Discard").
  - Icon buttons: square and outlined in toolbars (refresh), round in the top bar.
  - Text links: primary color ("View All Transactions", "Refresh" with icon, "Setup
    benefit enrollment ↗").
- **Toolbar row**: search input (leading icon, "/" key hint), refresh icon button,
  then right-aligned filter dropdowns (Status, Type, Hire Date, All Countries), a thin
  vertical divider, and the primary action.
- **Tables**:
  - Header row filled #F4F4F5, 14px regular text, a sort arrow on sortable columns.
  - Leading checkbox column. Rows separated by 1px dividers, with no zebra striping.
  - Cells may hold an avatar or flag plus a name. Money shows a muted currency code
    ("GBP 4,800/ month", "CAD 1,300.00"). Numbers are right-aligned where appropriate.
  - Status column uses badges. The action column uses icon buttons or a kebab menu.
  - Footer: "0 of 100 row(s) selected" on the left; "Rows per page [10]", "Page 1 of
    10" and square first/prev/next/last buttons on the right.
  - Grouped tables have expandable group rows ("▾ Company Paid Benefits").
- **Status badges**:
  - White pill, 1px light border, dark 12 to 13px label, with a leading 6px colored
    dot (Reviewed = green, Info = blue, In Review = amber, Enrollment Live = green) or
    a warning triangle ("Onboarding", "Processing").
  - Delta badge: soft red fill with red text and an arrow ("↓ 12.8%").
  - Tag: gray fill #F4F4F5, 4 to 6px radius, 12px ("Tax myself", "Primary").
- **Tabs**:
  - Underline tabs: active is dark text with a 2px #714DFF underline, above a
    full-width divider ("Company Benefits", "Overview").
  - Segmented tabs: active is a #EBEBEB filled rounded rectangle, inactive is plain
    text ("Manage / Directory / Contracts / Org Chart").
- **Cards**:
  - White, 1px border, 10 to 12px radius.
  - A section card has a header row (title plus divider) and body content.
  - Inner action cards ("Regular Payroll", "Bonus Payroll") use a title, a muted
    description and a button.
  - List cards (All Entities): flag, name, muted address and a "View Details" link.
- **Banners**:
  - Info: white, 1px border, blue info icon, 14px text, and an optional right-aligned link.
  - Warning: #FEF9C2 fill, amber triangle, bold lead text and a link.
  - Context callout: an icon in a round outlined container with a title and a
    description ("Jan 2025 (Current Pay Period)").
- **Forms**:
  - Label above the field, with a red asterisk for required fields.
  - Select with a chevron, 8px radius, and 36 to 40px height.
  - Option cards: white bordered cards with an icon, title and description. The
    selected card gets a #0BC15A green border.
- **Label/value grid** (detail pages): three columns, label 14px/600 over value 14px/400,
  with about 24px row gaps.
- **Money display**: currency code prefix, thousands separators and two decimals where
  the currency uses them. Negative is red with a leading minus ("- USD 570.53").
  Balances show large on the green wallet card only.
- **Icons**: thin line icons at 16 to 20px (Lucide is an acceptable stand-in). Country
  flags are round. Avatars are round photos or initials on pink (#E151FF-like) for the
  current user.

## AI patterns (observed in the app images and the Meet Emma video)
- A top-bar entry: an outlined pill with a purple sparkle, labeled "Niural AI" or "Ask Emma".
- A **docked right panel** titled "Niural AI" sits beside the working page, not over it.
  - The user's request appears as a right-aligned outlined pill ("Run payroll for January").
  - The AI answers in prose, followed by structured cards (for example "Pending
    Approvals" rows with amber counts such as "34 Reports").
  - "Smart Actions by Niural AI" offers one-click suggestion cards.
  - Suggested follow-up questions sit near a "Continue Chatting" input.
- AI can act on the page. For example it can filter the table, with a red "Clear AI
  Filter" link to undo it.
- Long tasks show in a small bottom tray ("Run Payroll in Progress").
- Label AI output, keep a human approval step for money movement, and show uncertainty.

## Website patterns (use only for marketing or landing surfaces)
- Announcement bar: a purple-to-pink gradient with white text.
- Floating nav container: rounded, 1px border, white. "Book a Demo" button.
- Pages start with an eyebrow chip ("Future of Intelligent Finance is Here"), then a
  48px Inter Tight headline. The key phrase is sometimes highlighted in Niural Purple
  ("Calculate the true cost of **Hiring Globally**").
- Light off-white page, subtle grid or dot textures, and product screenshots on the right.
- Primary and secondary buttons are both 44px with 8px radius.
- Pricing uses a dark theme. The AI marketing images use dark glowing 3D cards.
- Tool pages (runway calculator, cost calculator, compliance calendar) look closest
  to the app: bordered white cards, labeled inputs, a muted helper line, and
  result tiles.

## Exclusions from application UI
Never bring any of these into product screens:
- Marketing heroes, eyebrow chips, gradient announcement bars, grid textures.
- The dark 3D glow imagery, glassmorphism (1.png), floating tilted cards, or big
  radial purple backgrounds (3.png).
- Video controls, captions ("Lack"), or blurred montage content (2.png).
- The outer lavender border around 4.png and 5.png. It is presentation framing. The thin
  #A78BFF strip under the top bar is real app chrome and should be kept.
- The literal "Sort by {title}" label from 4.png. Use a real label.
- Pink as a UI state color. Green primary buttons: the Meet Emma video shows a green
  "Add New" in one expense view, but purple is the standard primary.

## Reference verification
Before calling a screen done:
- Capture it at 1440x900 and compare it with the closest app image above.
- Check the shell (top bar, purple strip, workspace, sidebar gradient), density,
  alignment, and control heights.
- Check type weights (medium headings, no bold), badge style, table rhythm, and that
  purple is used only for action and selection.
- Record any mismatch that remains. Never claim an exact font or pixel match.
