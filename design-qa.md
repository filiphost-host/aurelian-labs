# Design QA

## Evidence

- Source visual: `/var/folders/nh/9yr_kj256vg2y_m2_bt8mx6w0000gn/T/codex-clipboard-fbbf8c45-a76b-4f9d-a684-f044da9d08bd.png`
- Full implementation: `/Users/filiphost/Documents/Aurelian Labs/output/playwright/obsidian-portfolio-1600.png`
- Focused implementation: `/Users/filiphost/Documents/Aurelian Labs/output/playwright/obsidian-portfolio-viewport-1600.png`
- Mobile implementation: `/Users/filiphost/Documents/Aurelian Labs/output/playwright/obsidian-portfolio-viewport-390.png`
- Additional screens: `obsidian-insights-1600.png`, `obsidian-map-1600.png`, and `obsidian-stress-1600.png` in `output/playwright/`
- Index research evidence: `output/playwright/index-research-expanded.png`
- Hover-intent evidence: `output/playwright/map-egypt-hover-delay.png`
- Desktop viewport: 1600 x 900 at 1x density
- Mobile viewport: 390 x 844 at 1x density
- State: local preview data, NOK display, Norway selected on the map, US Technology Drawdown selected in Stress Test

## Comparison

The reference and implementation were inspected together at original detail. The implementation carries over the reference's near-black canvas, quiet graphite panels, white chart line, divider-led KPI strip, muted labels, compact controls, and restrained green/red status colors. Aurelian gold remains deliberately limited to the brand, selected navigation, and selected states.

The subsequent crimson signal pass adds a subtle burgundy cast to the canvas, short red section rules, red interaction details, and stronger downside emphasis. Red is reserved for attention, risk, and interaction; positive portfolio data remains green and researched-market identity remains gold.

The portfolio is the closest structural match because its transaction-backed history is now the primary visualization directly below the KPI strip. Insights, Global Map, Stress Test, login, dialogs, search, and public snapshots use the same surfaces and hierarchy without imitating a single-stock page where that would reduce usability.

## Findings

- Desktop: no horizontal overflow at 1600 px; the performance chart precedes holdings and finishes its entrance animation as a crisp white path.
- Mobile: no horizontal overflow at 390 px; navigation uses compact icons and the currency control remains available.
- Map: researched geography remains distinct, Norway selection is visible, and controls retain sufficient contrast without the previous gold-heavy treatment.
- Stress Test: preset selection, estimated loss, and explanatory hierarchy remain immediately legible.
- Market Monitor: index selection opens one full-width research drawer with three benchmark metrics and a horizontally contained constituent table.
- Map hover intent: Egypt remains closed at 500 ms, opens after 1.15 seconds, and closes after pointer exit.
- Typography and controls: labels, figures, tables, buttons, and badges remain contained at both tested widths.

## Comparison History

- P1 fixed: mobile navigation labels were compressed in the 390 px header; compact icon-only navigation now preserves spacing.
- P2 fixed: portfolio chart looked absent in an immediate capture; QA now waits for the intentional chart entrance animation and confirms the rendered SVG path.
- P2 fixed: gold and green previously competed across most surfaces; both are now scoped to identity, selection, and semantic data.
- P2 fixed: the first Obsidian pass was visually quiet compared with the reference; controlled crimson details now add energy without reducing data clarity.
- Open P0/P1/P2 findings: none.

final result: passed
