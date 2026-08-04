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

- Default navigation order is Portfolio, World Map, Scenarios, followed by secondary research tools.
- Portfolio opens as the default signed-in workbench view.
- Portfolio metrics reconcile to NOK 450,000 and a 97.5% legacy total return in preview and private Supabase data.
- The performance chart compares the same dated portfolio observations with a clearly labelled S&P 500 reference path.
- Decision-history cards expand and collapse to show outcome and lesson for Alphabet, Novo Nordisk, Tesla, Saab, and Lockheed Martin.
- Dock items expose descriptive hover labels and use a neutral-grey hover state before selection.
- Research company selector and Peers, Earnings, and Thesis modes work.
- Portfolio research actions open the selected holding.
- Calendar month controls, holdings filter, ticker filter, and Day, Week, and Month modes work.
- Calendar events open the corresponding company research view.
- Floating navigation switches among all primary workbench views.
- Wide tables use contained horizontal scrolling on narrow screens without widening the document.
- At 390 x 844, the document remains 390 pixels wide and the decision-history rail scrolls internally.

## Fixes During QA

- Reduced mobile research mode controls to icon-first labels to prevent crowding.
- Kept calendar and peer tables internally scrollable while confirming the 390-pixel document width remains stable.
- Replaced a remaining gold focus treatment with the site's crimson interaction color.
- Removed native select styling drift and aligned controls with the shared dark surface treatment.
- Clarified that current company research and calendar figures are illustrative and not live market data.
- Kept the S&P 500 benchmark explicitly labelled as an indexed reference estimate until provider-backed total-return data is connected.
- Added a faint structural grid, inset panel edges, compact crimson dividers, and clearer hover feedback without weakening the flat analytical hierarchy.

## Intentional Differences

- Aurelian's masthead remains visible instead of copying the reference's anonymous shell.
- Generic issuer markers use the existing interface treatment because the source's proprietary logo assets were not supplied.
- Calendar content is tailored to the sample Aurelian portfolio and August 2026 product context.
