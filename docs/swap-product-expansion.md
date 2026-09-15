# Butterfly Swap product expansion

The user requested implementation after reviewing the LVSwap study. This increment adds working product navigation, global token search, Pancake V2 liquidity management, pool-based discovery, and a separate About page. It is a preview increment on PR 72, not a production release.

## Delivered behavior

- The header opens Trade, Liquidity, Explore and About. The URL retains the section and known swap assets. The footer preserves the main website and stock-market entry points.
- Global search matches listed names, tickers and contracts. Unknown contracts require chain metadata and explicit selection acknowledgement. Search results select the output asset and open Trade. The liquidity form reuses the same picker.
- Liquidity reads the canonical BSC V2 Factory at a specific block, verifies pair tokens and orders reserves correctly. It calculates both deposit quantities, reads the connected wallet's LP balance, and previews partial/full removal. It supports existing nonempty pools; pool creation is outside this increment.
- Each liquidity action checks chain/account, canonical Router factory/WBNB, allowance, balance, fresh review, simulation and native gas reserve. Approvals use exact amounts or explicit zero-first resets. Submitted hashes remain pending until a receipt or wallet replacement result is available; unknown outcomes never silently become success.
- Liquidity does not collect the swap service fee. Known taxed and unlisted assets are readable but writes are held until dedicated integration verification. This includes Butterfly token LP writes. Standard listed assets such as BNB/USDT use the full wallet transaction flow.
- Explore ranks listed assets by their selected reference pool's hourly volume or liquidity. Hourly buys/sells are pool counts, not unique people. Recent pool trades come through a validated cached GeckoTerminal endpoint, with transaction links and buy/sell direction relative to the selected token. Missing values remain unknown.
- About explains the 80-bps output fee, 70/30 split, no-referrer allocation, platform treasury, and current deployment state. Fee-bearing swaps remain disabled while the existing deployment manifest is empty.

## Deliberate scope

Limit orders, copy trading, WalletConnect, new DEX/launchpad adapters, and private-key wallets are not presented as working features. No signer secrets, airdrop workflows, nonce, budget or ledger were modified. No mainnet liquidity transaction was sent during development.

## Verification

Integer tests cover optimal deposits, rounding, withdrawals, native ordering, minimum amounts and LP allowances. Submission tests cover expiry, altered minima, router identity, simulation failure, account changes, gas reserve, exact approval and zero-first reset. Trade tests cover duplicate events, address-based direction, malformed records, missing versus zero metrics, and API request bounds. Existing UI checks include section navigation and the retained stock-market entry point. Preview browser checks verify real pool reads and page interactions separately from wallet transaction acceptance.

## References

- https://developer.pancakeswap.finance/contracts/v2/router-v2
- https://github.com/pancakeswap/pancake-swap-periphery
- https://docs.dexscreener.com/api/reference
- https://apiguide.geckoterminal.com/
- https://docs.coingecko.com/reference/pool-trades-contract-address

These sources describe upstream interfaces; their existence is not a guarantee that every token is compatible with liquidity operations.
