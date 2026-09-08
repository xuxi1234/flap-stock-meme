# Market discovery and portability — 2026-09-08

## Problems found
The homepage still prioritized a closed sale and its social metadata advertised 0.05 BNB participation. The market page had no sector view, watchlist portability or compact mobile section navigation. Loading the market page still loaded homepage and wallet code.

## Sources and choices
- Ghostfolio https://github.com/ghostfolio/ghostfolio — inspected its import/export feature and AGPLv3 license. Borrowed the product principle that personal lists should be portable; no source copied, dependencies or backend services added.
- TradingView stock heatmap https://www.tradingview.com/widget-docs/widgets/heatmaps/stock-heatmap/ — official SPX500 dataset, sector grouping, market-cap sizing, daily percentage coloring. Attribution retained; data can be delayed.
- TradingView heatmap explanation https://www.tradingview.com/support/solutions/43000707144-how-to-set-up-a-heatmap-what-is-size-by-and-color-by/ — distinguish area from daily performance; explain it next to the widget.
- Google web.dev https://web.dev/articles/accessible-tap-targets — mobile controls target 48px with space between controls. Focus styles, skip link and a compact section navigation reduce repeated scrolling.
- React lazy https://react.dev/reference/react/lazy — both route components lazy loaded, so the stock dashboard no longer requires homepage wallet modules.

## Applied
S&P 500 sector heatmap, near-viewport loading placeholder and retry controls; watchlist backup as versioned JSON text and merge-only import with deduplication, a 30-symbol limit and invalid-format rejection; cross-tab watchlist synchronization; offline notice; share feedback cleared on browser back; mobile section navigation; search input 16px on small screens; homepage market CTA and truthful closed-sale metadata.

The watchlist remains local to the browser. Backups contain only qualified stock symbols, no wallet data, prices, holdings or personal fields. Portable JSON is intentionally simple; it is not a claim of compatibility with Ghostfolio files.

## Verification
TypeScript passed for dashboard and transfer components. Eight import cases passed: duplicates, valid dotted ticker, bad JSON, schema version, invalid symbol/type, empty list, over-limit list and excessive input. Complete Vercel build and browser checks are recorded in the preview handoff. No production merge.
