# Dashboard improvements — 2026-09-08

## Sources inspected
- https://github.com/Open-Dev-Society/OpenStock — useful search/watchlist/company-context flow. AGPL-3.0; no implementation code copied and no new dependency on this project.
- https://www.tradingview.com/widget-docs/tutorials/iframe/build-page/dynamic-symbols/ — supported exchange-qualified symbols and symbol-specific Top Stories.
- https://www.tradingview.com/widget-docs/tutorials/lazy-loading/ — defer offscreen widgets.
- https://react.dev/reference/react/lazy — load dashboard module separately.

## Applied
Stock selection updates a shareable URL and supports back/forward. Links include the selected symbol; clipboard failures expose a selectable URL. Ctrl/Cmd K focuses stock search. News follows selected company. Offscreen widgets start near the viewport. Dashboard code loads only on the market route. Existing local watchlist, ETF context, provider attribution and retry controls remain.

## Deliberate boundaries
Do not copy a full AGPL application or introduce accounts, MongoDB, paid Finnhub plans, price alerts or scraping merely to add a dashboard. Official embedded data remains subject to provider availability and delays. Widgets are not a licensed bulk quote API. No synthetic prices or news. The private sale remains closed and QQ remains disabled.

## Verification scope
Vercel build plus browser interaction checks. Responsive CSS covers desktop and narrow widths; no claim of physical-device testing. Iframe insertion is not proof of complete data availability, so attribution, reload and source fallback remain visible.
