# Butterfly Swap trading workspace and service fees

User-approved commercial rules: charge 80 / 10,000 (0.8%); a valid inviter receives 70% of that fee; treasury receives the remainder. Without an inviter treasury receives the entire fee. Treasury: `0x133c7e613a62dc43876f17b688df0b4d24a75735`.

## Settlement

The adapter receives swap output, calculates the fee from its actual output balance increase, and transfers the net output to the caller. Amounts use integer arithmetic: fee = gross * 80 / 10000; inviter = fee * 70 / 100; treasury = fee - inviter. Rounding residue belongs to treasury. All transfers and swaps are atomic; a revert rolls back service fees (network gas can still be spent). Minimum output checks the caller's actual token balance increase after the fee and any final transfer tax. BNB / WBNB wrapping remains a 1:1 conversion without a service fee.

Fee recipients receive the output asset immediately, not an off-chain credit. No extra BNB value is sent beyond the exact native input. Taxed input transfers to the adapter that change the specified input amount are rejected; V2 supports pool transfer taxes and V3 is only quoted for configured untaxed tokens. Arbitrary tokens can still fail simulation. No arbitrary external calls or caller-selected routers.

Inviter binding occurs with the first successful referred swap, is visible in confirmation, and cannot subsequently change. An unreferred swap leaves the account unbound. No self-invitation, zero address binding, adapter binding or treasury binding. Invalid links are not silently displayed as valid invitations. Existing on-chain binding takes precedence over links. Referral counts represent distinct bound wallets, not visits. Earnings display actual on-chain per-asset totals, never synthetic revenue.

## UI and data

Desktop: token/USD chart and market statistics left, swap card right. Mobile: swap card first. Preserve Butterfly branding, asset discovery, favorites, route comparisons, wallet/account checks, and transaction history. Use Lightweight Charts with TradingView attribution; source OHLCV from GeckoTerminal public BSC pool endpoints behind a bounded cached API. Validate pool/asset and OHLCV response; unavailable data gets an explicit empty state. Chart price is USD, not a claimed executable swap quote. Prices never supply transaction calldata.

Invite dialog: connected wallet's referral link, 70% share, treasury address, no-inviter rule, on-chain binding and per-output-asset earnings when a verified deployment exists. During preview clearly label fees as proposed execution preview and do not fabricate statistics.

## Release boundary

No mainnet adapter exists yet. A checked-in deployment manifest must contain chain 56, adapter address and reviewed runtime bytecode hash before fee-bearing writes are enabled. Check chain, code hash, treasury and fixed fee parameters before approval or swap. Preview can show live quotes and fee estimates but cannot send fee-bearing swaps until this verification passes. Production is not switched by this branch. Mainnet deployment and a small real acceptance trade require a separate wallet confirmation. Do not touch the active holder airdrop, its secrets, nonce or ledger.

## Acceptance

Tests cover integer fee conservation, no inviter, self referral, binding precedence, altered fee quotes, deployment gate, fee/revert atomicity, exact approval cleanup, invalid routes, V2/V3, native input/output and recipient minimum. Chart tests cover malformed data and correct token selection. Build and desktop/mobile checks precede preview delivery. Custom adapter tests are not an independent security audit.
