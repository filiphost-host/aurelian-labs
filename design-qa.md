# Design QA

final result: passed

## Scope

- Reference images: four supplied Fey/Mobbin screenshots covering magic-link confirmation, earnings calendar, peer analysis, and earnings analysis.
- Implemented surfaces: shared application shell, Portfolio entry points, Company Research, Earnings Calendar, and magic-link confirmation.
- Desktop viewport: 1600 x 900 CSS pixels at DPR 1.
- Mobile viewport: 390 x 844 CSS pixels at DPR 1.

## Visual Comparison

- Matched the references' near-black canvas, low-contrast panel borders, compact typography, dense analytical tables, restrained crimson signals, and floating navigation.
- Kept Aurelian's identity and information architecture while adopting the reference hierarchy and interaction patterns.
- Compared the source and implementation together for the Research and Calendar states.
- Desktop captures:
  - `output/playwright/fey-research-desktop.png`
  - `output/playwright/fey-calendar-desktop.png`
  - `output/playwright/fey-earnings-desktop.png`
- Mobile captures:
  - `output/playwright/fey-research-mobile-full.png`
  - `output/playwright/fey-calendar-mobile-full.png`

## Functional Checks

- Research company selector and Peers, Earnings, and Thesis modes work.
- Portfolio research actions open the selected holding.
- Calendar month controls, holdings filter, ticker filter, and Day, Week, and Month modes work.
- Calendar events open the corresponding company research view.
- Floating navigation switches among all primary workbench views.
- Wide tables use contained horizontal scrolling on narrow screens without widening the document.

## Fixes During QA

- Reduced mobile research mode controls to icon-first labels to prevent crowding.
- Kept calendar and peer tables internally scrollable while confirming the 390-pixel document width remains stable.
- Replaced a remaining gold focus treatment with the site's crimson interaction color.
- Removed native select styling drift and aligned controls with the shared dark surface treatment.
- Clarified that current company research and calendar figures are illustrative and not live market data.

## Intentional Differences

- Aurelian's masthead remains visible instead of copying the reference's anonymous shell.
- Generic issuer markers use the existing interface treatment because the source's proprietary logo assets were not supplied.
- Calendar content is tailored to the sample Aurelian portfolio and August 2026 product context.
