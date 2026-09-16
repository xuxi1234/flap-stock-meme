# Flap discovery board in Butterfly Swap

Reference inspected: https://flap.sh/board?lang=zh on 2026-09-16. This implementation reuses interaction concepts, not Flap branding or bundled application code. Public client assets were inspected to identify read endpoints and field semantics.

## Delivered

Explore defaults to a Flap board, alongside the existing curated token ranking and reference-pool trades. Eight categories, table/card layouts, quote-asset filter, stage filter, minimum liquidity, loaded-record search, favorites, sortable fields and cursor pagination are implemented. Rows include price, quote asset, market cap, buy/sell taxes, 24-hour volume, holders, liquidity and 5m/1h/4h/24h changes. Missing values remain unknown; contract address identifies an asset, not its symbol.

- Trending: `GET https://bnb.taxed.fun/v3/board`
- Stocks: `/v3/board/tag=stocks`
- Bonding: `/v3/board/graduatinghot`
- LISTADAO: `/v3/board/tag=listadao`
- Gifts: `/v3/board/tag=gifttoken`
- Innovation: `isInnovation=true`
- FAC: `isLowRisk=true`
- Flap's inspected client returns an empty board for its proprietary “不对劲” category. Butterfly labels its own rule explicitly: within the loaded trending set, absolute 5m change >=5% or absolute 1h change >=10%. It is not represented as Flap's proprietary ranking.

The API route accepts only enumerated categories/sorts, hex quote addresses and bounded opaque cursors. It reads a fixed BSC origin, limits body size, disables redirects, sets timeouts, normalizes untrusted data and caches for 30 seconds. It cannot receive a caller-specified URL or transaction calldata.

## Availability

Direct requests to Flap's category API returned HTTP access errors from the development environment. A separate unauthenticated public page at `https://flap.sh/board?lang=zh` serves a JSON initial trending board. A bounded parser reads its JSON string without executing scripts. Trending, custom anomaly, FAC and innovation can fall back to this first-page subset, with explicit source/range labels and original data timestamp when available. The fallback never exposes a cursor or claims a complete category. Other category failures return 503, never successful empty fabricated rankings. API availability remains an upstream dependency. No challenge, login gate or geographic declaration is bypassed.

FAC marks are displayed only when explicitly returned by Flap. They are not Butterfly security guarantees. Taxes are upstream informational data and can change. Stock category membership is upstream-defined, separate from the existing curated bStocks catalog.

## Trading boundary

Graduated rows open the existing token picker with the exact contract. Unknown metadata/decimals are read on chain and require explicit contract acknowledgment. Board values never become executable token decimals, quote routes or approval spenders. Bonding or unknown-stage rows lead to Flap for verification; no internal bonding-curve transaction is implemented. Existing fee-adapter readiness checks and exact approval behavior remain in effect.

No mainnet transaction is sent and no airdrop workflow, nonce, ledger or signer configuration is changed. Fees and production deployment status are unchanged.

## Verification

Unit and UI checks cover numeric/identity normalization, zero vs missing, tax bounds, public JSON parsing, fixed request destinations, query validation, honest category errors, bounded fallback, anomalous movement thresholds, null-last sorting, category-response races, card/search behavior and graduated vs bonding actions. Browser checks are performed on the resulting preview before delivery. No real wallet transaction acceptance is claimed.

Preview acceptance (2026-09-16): 185 frontend tests passed, 6 optional live tests skipped; build/TypeScript and GitHub verification passed. The deployed preview also receives category API failures, so its working live feed is the clearly labelled 20-record public trending-page fallback. The bonding category correctly reports unavailable. Browser checks confirmed a NECTAR contract from the board was read on chain and selected as the swap output after the standard acknowledgment, without connecting a wallet or submitting a transaction. Table/card views and 320px/390px CSS viewport checks passed with no page-level horizontal overflow. A banner contrast issue and missing NVDAB quote label were corrected before final delivery.
