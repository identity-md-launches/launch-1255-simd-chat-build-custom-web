# Pulse design system

## Overview

Pulse is a personal intraday crypto research workspace. The interface uses a light, quiet canvas, white data surfaces, a forest-green primary action, and restrained financial status colors. The dashboard leads with the selected market and **Analyze market**, followed by four metrics, a chart and signal summary, technical indicators, and the underlying conversation sample. There is no marketing hero between the user and the tool.

The source of truth is `src/styles.css`, with structure in `src/App.tsx` and `src/components/`. Desktop navigation occupies a fixed leading sidebar; small screens get an in-flow navigation row. The product is English-only and deliberately implements one light theme.

## Colors

The canonical notation is sRGB hex. Primitive tokens live at the start of `src/styles.css`; components generally consume semantic `--color-*` tokens. Decorative coin colors and the insight surface gradient are local treatments, not additional action colors.

| Semantic token                                     | Value                 | Use                                              |
| -------------------------------------------------- | --------------------- | ------------------------------------------------ |
| `--color-bg`                                       | `#f7f9f8`             | Page canvas                                      |
| `--color-surface`                                  | `#ffffff`             | Cards, fields, header, sidebar                   |
| `--color-surface-soft`                             | `#eef2ef`             | Neutral badges and recessed details              |
| `--color-text`                                     | `#182a2a`             | Headings, primary text, numbers                  |
| `--color-text-secondary`                           | `#64716d`             | Captions, metadata, explanatory text             |
| `--color-border`                                   | `#e3e9e5`             | Non-interactive card boundaries and dividers     |
| `--color-control-border`                           | `#829086`             | Interactive outlines, selects, secondary buttons |
| `--color-accent` / `--color-accent-hover`          | `#175c46` / `#194b3d` | Primary action and hover                         |
| `--color-accent-soft`                              | `#e9f1eb`             | Selected navigation and control surfaces         |
| `--color-on-accent`                                | `#ffffff`             | Primary action text                              |
| `--color-focus`                                    | `#267563`             | 2px focus outline, offset by 4px                 |
| `--color-positive` / `--color-positive-soft`       | `#237363` / `#eaf5ef` | Bullish labels and positive change               |
| `--color-negative` / `--color-negative-soft`       | `#a4414e` / `#fbeced` | Bearish labels and negative change               |
| `--color-warning` / `--color-warning-soft`         | `#79561c` / `#fcf5e7` | Source failures and stale headlines              |
| `--color-chart` / `--color-chart-fill`             | `#318773` / `#cee6dc` | Price line, positive distribution, volume bars   |
| `--color-neutral-chart` / `--color-negative-chart` | `#c2cdc3` / `#d48f99` | Neutral and negative distribution segments       |

Status always has words and/or an icon in addition to color. Selected chart controls have an explicit underline. Watchlist selection uses a check icon. The green action and market-status families are distinguished by component shape, copy, and placement.

Rendered contrast measurements are recorded in `artifacts/browser-results.json`: primary button text **7.91:1**, secondary text on white **5.09:1**, bullish badge **5.08:1**, neutral badge **4.51:1**, control outline on white **3.34:1**, and focus perimeter against the page **5.22:1**. These measurements cover the named pairs, not every gradient pixel or system-rendered select popup.

## Typography

- Family: **Manrope**, then Arial, then generic sans-serif. The local Latin variable WOFF2 is `public/fonts/manrope-latin.woff2`, loaded with `font-display: swap` and a preload. Its license is `public/fonts/OFL.txt`. No font service is contacted at runtime.
- Declared weight range: 400–800. Body uses 500; controls and metadata primarily 600/650; headings and numbers 700/750; the wordmark 800. Browser verification confirmed the local face loaded. No italic text is required.
- Five-size scale: `--text-xs` **12px**, `--text-sm` **14px**, `--text-base` **16px**, `--text-lg` **20px**, `--text-xl` **28px**. The same roles apply across pages. The dense research dashboard uses 12px metadata and 14px headline copy; guide text enlarges to 16px on mobile.
- H1: 28px/1.25, weight 750, −1px tracking. Card H2: 16px/1.4, weight 750. Guide/settings section H2: 20px. Large signal values are paragraphs/strong text, not oversized subordinate headings.
- Default line-height is 1.5. Explanatory copy uses 1.6–1.9. Long prose is capped around 72–75ch. Headings balance wrapping; short explanatory paragraphs use pretty wrapping.
- Dynamic values use tabular numerals via `.num` or component rules. Significant prices and story titles are never ellipsized. Controls reach 16px input text on mobile.
- SVG chart labels render at 12px in a viewBox synchronized to the actual container width with `ResizeObserver`; they do not shrink to unreadable desktop-scaled labels on phones.

## Layout

The spacing vocabulary is 4, 8, 12, 16, 20, 24, 32, 40, and 48px (`--space-*` declarations). CSS uses both these tokens and matching literal layout values. Smaller spacing groups content; 18–24px gaps separate panels. The main container is capped at 1600px, with 36px desktop inline padding and shared card edges.

| Width           | Implemented behavior                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Above 1550px    | Main padding grows to 44px; cards gain breathing room                                                                                                                          |
| Default desktop | 220px sidebar, 76px header; four metric columns; chart and summary use approximately 1.95:1 columns                                                                            |
| At/below 1250px | Sidebar becomes 194px; padding and card density tighten; main analysis columns are approximately 1.7:1                                                                         |
| At/below 1060px | Sidebar becomes 180px; metrics become two columns; chart/conversation sections stack; summary temporarily uses an internal two-column arrangement                              |
| At/below 760px  | Sidebar becomes an in-flow horizontal brand/navigation area; watchlist is accessed through Settings and the market selector; there is no mobile overlay menu                   |
| At/below 570px  | Main padding is 18px; actions sit below the heading with Analyze market dominant; metrics remain two columns; summary and settings stack; live refresh controls remain visible |
| At/below 360px  | Main padding is 14px; navigation icons are omitted to keep names on one line; compact price text stays readable                                                                |

Reflow was tested at 320, 390, 570, 760, 800, 1060, 1280, and 1440 CSS pixels without document-level horizontal overflow. The 390×844 first-screen capture shows the brand, product, market selector, and primary action. Data tables use their own bounded scrolling area. Native browser 200% zoom and physical devices were not manually tested.

## Elevation & Depth

Surfaces are almost flat: a 1px structural border and a very subtle `0 2px 3px #102b1c02` shadow. The primary button has a small shadow; selected metric controls have a subtle shadow and a dark underline. The insight panel uses a pale gradient from `#f6f9f2` through `#fcfdfb` to white. Chart area fill fades from 17% opacity to transparent. There are no modals, blurred backdrops, or animated page entrances.

The fixed desktop sidebar uses z-index 20; the keyboard skip link uses 1000. Below 760px, navigation returns to normal document flow so it cannot cover content.

## Shapes

`--radius-sm` is 6px for badges; `--radius-md` is 9px for buttons and navigation; `--radius-lg` is 12px for panels. Some local control and nested surface radii are 5–10px to fit their padding. Coin markers and avatars are circular. Chart lines use round caps/joins. Use the stronger control border for interactive shapes, and the light structural border for ordinary cards.

## Components

| Component / source                                            | Use and behavior                                                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell — `src/App.tsx`                                     | Hash navigation to Home, How to use, and Settings; native links with `aria-current`; skip link; route changes move focus to main; one H1 per page                                                             |
| Buttons — `.button`, `.primary`, `.secondary`, `.text-button` | One filled primary action in the visible workflow. Hover, focus, pressed, and disabled/loading states. Busy analysis has text plus a spinner; repeated submissions are disabled                               |
| Market control — `Dashboard.tsx`, `.market-select-wrap`       | Native labeled select for BTC/ETH/SOL/LINK; switching cancels the prior request and clears mismatched live data                                                                                               |
| Metric card — `.metric-card`                                  | Label, large numeric value, explanatory metadata, and optional redundant status/sparkline. Missing data is an em dash, never a fabricated value                                                               |
| Chart / Sparkline — `Chart.tsx`                               | Price or headline-observation metric, three time windows, pointer inspection, optional keyboard range inspector, textual SVG summary, expandable table of the latest 20 observations; actionable empty state  |
| Signal summary — `Dashboard.tsx`, `.insight-panel`            | Transparent three-factor alignment. Expandable ATR scenario. Missing or stale conversation data withholds the intraday summary; all demo figures remain labeled                                               |
| Conversation — `Dashboard.tsx`                                | Native filter buttons with `aria-pressed`; 4-row preview and full-feed expansion; external HN links; recoverable empty state                                                                                  |
| TextAnalyzer — `Dashboard.tsx`                                | Local, ephemeral text form. Visible label/hint, inline error linked with `aria-describedby`, error focus, escaped text rendering, polite result announcement; no network submission                           |
| Settings — `Settings.tsx`                                     | Native selects, checkboxes, and checkbox-based switch. Changes apply on Save settings. Restore defaults changes the draft first. Persistence failures apply settings for the session and state the limitation |
| Status/data provenance — `Dashboard.tsx`                      | Demo/public/partial/updating labels, source-failure recovery, headline-age notice, and expandable per-source UTC timestamps                                                                                   |
| Icons — `Icon.tsx`                                            | One original SVG set, 24-unit viewBox, 1.7px stroke, `currentColor`, decorative `aria-hidden`; text names remain on controls                                                                                  |

High-frequency interactions are immediate. The only continuous motion is the in-progress refresh icon. Button transitions are 120ms and press scale is 0.96, gated behind `prefers-reduced-motion: no-preference`. Reduced motion disables those animations. Hover effects only apply to devices that support hover. Forced-colors overrides retain control boundaries and use system Highlight for focus.

## Do's and Don'ts

- Reuse `.panel`, `.panel-heading`, `.page-heading`, and the semantic tokens. A new page should retain the shell, one H1, and the current hash-routing pattern.
- Keep the main action near the heading, visible before dashboard detail on mobile. Keep secondary actions outlined or text-based.
- Keep actual-source status, sample size, and timestamps close to consequential metrics. Never blend demo numbers into a live result.
- Keep numerical calculations in `analysis.ts` and provider parsing in `data.ts`. Present unavailable values plainly rather than inventing confidence or interpolated observations.
- Preserve native controls, readable chart labels, visible keyboard focus, and responsive input sizes. Add text/icon cues when adding a new status.
- Do not add an account flow, wallet, private credentials, dark theme, or decorative motion without a product requirement.

Design and documentation guidance attribution is retained in `artifacts/ATTRIBUTION.md` and `artifacts/DESIGN-GUIDANCE-LICENSE.txt`.
