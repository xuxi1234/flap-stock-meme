# US market dashboard: source decision (2026-09-08)

## Selected for the preview
TradingView official hosted widgets. No API key or paid plan was purchased. Preserve the provider branding and links; do not scrape widget data into a separate feed. US widget market coverage is documented as delayed Cboe One data. The browser preview displayed 15-minute delay markers for SPY, QQQ, DIA and IWM. These are ETF prices, not index levels.

- https://www.tradingview.com/widget/
- https://www.tradingview.com/widget-docs/markets/north-america/
- https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/demos/watchlist/
- https://www.tradingview.com/widget-docs/widgets/watchlists/market-overview/
- https://www.tradingview.com/widget-docs/widgets/watchlists/stock-market/demos/no-chart/

## GitHub alternatives evaluated
- https://github.com/tradingview/lightweight-charts — open-source chart renderer, not a price feed. Preserve its license/NOTICE attribution if used. Suitable for a future custom UI once a data feed is licensed.
- https://github.com/ranaroussi/yfinance — convenient research client; its README states Yahoo Finance data is intended for personal use. Open-source code is not a redistribution license. Not selected for public production quotes.

## Custom API alternative
Twelve Data separates individual/internal use from business/external display access. Public-display and redistribution rights must be confirmed for the intended plan and markets before integrating. Do not assume a free individual API tier authorizes website display.
- https://twelvedata.com/pricing-business
- https://support.twelvedata.com/en/articles/9935903-us-equities-market-data
- https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage

## Preview implementation
Route: ?view=markets. Chinese dashboard with:
- Curated bilingual company search, plus explicit NASDAQ/NYSE/AMEX symbol lookup.
- Provider-hosted chart; unknown symbols retain the provider's unavailable state.
- ETF market reference tab and US movers tab.
- Local-browser watchlist, maximum 30 unique symbols, no wallet.
- Retry controls and provider fallback links. No fabricated quotes or guaranteed real-time claims.

## Deliberate limits
No standalone stock database, news feed, market holiday calendar, trading, paid data entitlement or cloud-synced watchlist. Do not calculate exchange open/closed state from a browser clock; use the provider's indicator. The iframe can load before quotes become available; iframe insertion is not evidence of successful quote delivery. Data availability depends on the provider and network. Mobile layout uses a single column; device testing is separate from desktop verification.
