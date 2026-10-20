# 4. Lightweight Charts for trades, D3 for analytics

- Status: accepted
- Date: 2026-10-20

## Decision

- The trade chart uses TradingView Lightweight Charts 5 (Apache-2.0; the attribution logo stays on). Fills are series markers, stops and targets are stepped line series, risk and reward zones are a custom series primitive.
- Analytics charts use D3 for scales, shapes and layout only; Svelte renders the SVG. Every chart has a hidden data table, keyboard navigation and a tooltip, and the palette is validated for colour-vision deficiency in light and dark themes.

## Consequences

- No chart library owns the DOM of the analytics charts, so they follow the design tokens and theme switches without re-initialising.
- Lightweight Charts is loaded with a dynamic import, so it is only fetched on pages that draw a trade chart.
