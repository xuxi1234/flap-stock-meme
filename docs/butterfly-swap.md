# Butterfly Swap preview

This feature is on `feature/butterfly-swap-preview`; it must not be merged just to obtain a preview URL.

## Routes and hosting

- Preview: `/?view=swap` on the Vercel preview deployment.
- `app.gupiao.sh` and `app.hudiegupiao.com` select the swap page at `/`.
- Production homepage navigation maps each parent domain to its corresponding app subdomain. Preview navigation stays on the preview deployment.
- Attach the app subdomains to this Vercel project and the preview branch (until release) using the DNS targets Vercel supplies. Do not guess DNS values or change the parent-domain aliases.

## Implemented

BNB Chain (56), PancakeSwap V2 exact-input swaps, direct and single-intermediate routes through WBNB / USDT / USDC, native BNB wrapping, ERC-20 balances, token import, exact-amount approvals, configurable 0.1–5% slippage, recipient-bound review, 30-second quotes and two-minute swap deadline. The wallet remains the signer; there is no custodial address or platform fee.

The V2 supporting-fee-on-transfer entry points protect the recipient's minimum received amount. The initial quote does not include token-specific taxes. No claim of honeypot detection, audited custom-token safety or whole-market optimal routing is made. V3, Infinity, limit orders, bridges and fiat are outside this preview's supported scope.

## Open-source / primary references

- [PancakeSwap V2 official addresses](https://developer.pancakeswap.finance/contracts/v2/addresses) — authoritative BSC factory and router.
- [PancakeSwap Router V2](https://developer.pancakeswap.finance/contracts/v2/router-v2) — ABI and fee-on-transfer swap methods.
- [Official Smart Router example](https://github.com/pancakeswap/smart-router-example) — researched for future V3 / Infinity routing; not vendored or represented as implemented.
- [PancakeSwap frontend](https://github.com/pancakeswap/pancake-frontend) — current SDK monorepo; old standalone swap-sdk has moved.
- [viem](https://github.com/wevm/viem), MIT — existing locked dependency, used for contract reads, simulation, integer quantities, wallet requests and receipts. Its license stays in the installed package; no upstream UI is copied.
- [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963) — existing browser-wallet discovery.
- [LVSwap](https://lvswap.app/) — interaction reference only; its code or assets are not copied.

No paid quote API, API secret, third-party swap wrapper or additional deployed contract is required. Pool fees, token taxes and BSC gas still apply. Browser wallets and mobile wallet DApp browsers are supported; external mobile WalletConnect QR requires a project configuration and is not offered in this build.

## Checks

`npm test -- --run src/swap/service.test.ts` tests precision, min output, path selection, canonical router, account/network changes, expiration before and after async operations, gas reserves, simulation failure and exact approvals.

`VITE_SWAP_READONLY_SMOKE=1 npm test -- --run src/swap/live.test.ts` is an opt-in read-only BSC smoke check of router identity, token decimals and real quotes. If the shell requires its configured network proxy, use Node's `NODE_USE_ENV_PROXY=1` option. No transactions are broadcast by tests.

Preview trading uses actual BSC assets if a user confirms in their wallet. A successful build and simulated transaction tests are not a claim of completed mainnet trading or a security audit.

## Stock catalog preview — 2026-09-09

- Source of the 10 initial contract identities: https://www.binance.com/en/support/announcement/detail/fd3c0f17a7504eb5be1cb1911c6da0cd
- Each token's decimals was read from `decimals()` over BSC public RPC (all 18).
- Official display images: Binance public asset metadata endpoint `/bapi/asset/v2/public/asset/asset/get-all-asset`, resolved by the official announcement's asset code. The resolved HTTPS URLs are stored per contract in `src/swap/stock-tokens.json`. Images load from Binance's CDN; no rights to redistribute them are assumed. Image failures retain the symbol fallback.
- Initial catalog: AAPLB, AMATB, AMZNB, BEB, DELLB, FLNCB, GSB, PYPLB, SMHB, SOXSB. ETF and leveraged inverse ETF labels are explicit.
- Contract identity, listing, and tradability are separate. No claim of token safety or V2 liquidity is implied by inclusion. Quotes retain the existing live V2 route and price-impact checks. V3/Infinity execution has not been added.
- Market-page AAPL and AMZN entries link to the corresponding contract in the swap. Deep links accept catalog contracts only, never router/account/approval overrides.
- New transactions persist optional input/output keys for icons; old transaction records remain readable.
- No wallet transaction is needed to inspect or validate the catalog.

## Magnificent Seven completion — 2026-09-09

Added MSFTB, NVDAB, GOOGLB, METAB and TSLAB; retained AAPLB and AMZNB. All seven appear first in the catalog and have a dedicated selection filter. Market links use each stock's exact ticker (GOOGL Class A, not GOOG Class C). Contract symbol and decimals read directly from BSC. Images resolved from Binance asset metadata.

Official contract sources:
- Microsoft / Meta: https://www.binance.com/en/support/announcement/detail/03b264b679a646119d1a2415b9097bd6
- NVIDIA / Tesla: https://www.binance.com/en/support/announcement/detail/5646e3f9ea6b4c989cb76aa18bd99245
- Alphabet: https://www.binance.com/en/support/announcement/detail/6a55706a042c4a7ebedc2a0899744088

Catalog inclusion does not promise a V2 route; route checks remain live.

## Asset discovery and quote clarity — 2026-09-09

### Product behavior
- Asset explorer: Magnificent Seven, all assets, ETFs, and browser-local favorites. Search supports company names, tickers and contracts; sorting supports ticker and representative-pool liquidity.
- DEX reference prices are separate from executable quotes. The fixed read-only `/api/stock-markets` endpoint requests only reviewed stock contracts, caches for 60 seconds, and filters provider results by BSC, PancakeSwap, exact base contract and trusted USDT/USDC/WBNB quote contracts. It selects the highest-liquidity eligible pool among returned results; all displayed metrics refer to that individual pool. No synthetic history, liquidity totals, or executable-price guarantees.
- Missing metrics remain missing. Old snapshots are explicitly labeled after 3 minutes or a failed refresh. Provider failures do not disable independent chain quotes.
- V2 candidates include up to two intermediate assets (three pools), at most 10 loop-free paths. The existing same-block output comparison chooses the highest output, then shortest path on ties. Display shows valid alternatives, actual route and expiry. This is not gas-adjusted or a V3/Infinity router.
- Share links encode only known input/output assets, never amounts, wallet addresses, approvals, or the current query string. Unknown contracts and duplicate pair parameters cannot create automatic imports or wallet operations.
- Expanded asset details include contract copying, issuer source and a link to the actual reference pool. Images share the same fallback component throughout.
- `/butterfly-stock-list.json` is generated during build using the Uniswap Token Lists schema, with checksummed BSC addresses and stock/ETF tags.

### Open-source and official sources inspected
- Uniswap Token Lists specification (MIT): https://github.com/Uniswap/token-lists ; schema https://github.com/Uniswap/token-lists/blob/main/src/tokenlist.schema.json . Used for the public catalog format, no dependency on a default list or token safety endorsement.
- PancakeSwap official Smart Router examples: https://github.com/pancakeswap/smart-router-example . Studied route comparison and multi-protocol separation; no V3/Infinity execution code imported into this V2 preview.
- DEX Screener official API: https://docs.dexscreener.com/api/reference . Uses GET `/tokens/v1/bsc/{addresses}`. Source fields validated before display; provider-supplied logos, links, symbols and calldata are never trusted for asset identity or transactions.

Validation: focused coverage for chain/contract binding, missing metrics, rejected malformed prices, endpoint failure, catalog search/filter, favorites after remount, pair-link sanitization, and a three-pool-only quote. No broadcast transaction is part of these checks.
