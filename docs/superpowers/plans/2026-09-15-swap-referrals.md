# Butterfly Swap Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. No subagent dispatch is needed.

**Goal:** Deliver a reviewable trading workspace and implement the approved 0.8% / 70:30 fee rules behind a verified deployment gate.

**Architecture:** Keep existing route discovery. Wrap the chosen quote with integer output fees; a fixed-router adapter settles in one transaction. A separate bounded API supplies informational historical charts.

**Tech Stack:** React, TypeScript, viem, Vite, Solidity 0.8.24, Vitest, Foundry, Lightweight Charts.

**Spec:** `docs/superpowers/specs/2026-09-15-swap-referrals.md`

## Global Constraints

- Fee 80 / 10000; inviter gets 70 / 100 of fee; no inviter sends all fee to treasury.
- Treasury `0x133c7e613a62dc43876f17b688df0b4d24a75735`.
- No active airdrop modifications or mainnet deployment in preview.
- No fake market data, rewards, or deployment address.

### Task 1: Fee policy and deployment boundary

Files: `src/swap/fees.ts`, `src/swap/fees.test.ts`, `src/swap/swap-deployment.json`, `src/swap/service.ts`.
Interfaces: `splitFee(gross: bigint, referred: boolean)` returns `{fee, inviter, treasury, net}`; `parseReferrer(search: string, account?: Address)` returns `Address | null`; `withPlatformFee(quote: SwapQuote): SwapQuote` marks fee-bearing quotes and reduces net output. Deployment manifest is null until verified.

- [ ] Test `expect(splitFee(100000n,true)).toEqual({fee:800n,inviter:560n,treasury:240n,net:99200n})` and no-inviter conservation, invalid links and no-deployment write rejection.
- [ ] Implement bigint formulas, explicit referral parsing and immutable deployment checks.
- [ ] Run `npx vitest run src/swap/fees.test.ts src/swap/service.test.ts`.

### Task 2: Atomic adapter

Files: `contracts/src/ButterflySwap.sol`, `contracts/test/ButterflySwap.t.sol`.
Interfaces: `swapV2(uint256 amountIn,uint256 minimumNet,address[] path,bool nativeIn,bool nativeOut,address inviter,uint256 deadline)`; `swapV3(uint256 amountIn,uint256 minimumNet,bytes path,bool nativeIn,bool nativeOut,address inviter,uint256 deadline)`; fixed getters and `referrerOf`, `invitedCount`, `earned`.

- [ ] Test output 100000 gives caller 99200, inviter 560, treasury 240; no-inviter treasury 800; failed minimum reverts balances and binding.
- [ ] Implement fixed-router swap execution, exact/reset approvals, per-trade balance deltas, non-reentrancy, immutable binding, immediate fee settlement.
- [ ] Run `forge test --root contracts` and compile with optimizer before release.

### Task 3: Market workspace and invitation UI

Files: `api/swap-chart.ts`, `src/swap/chartData.ts`, `src/swap/MarketChart.tsx`, `src/swap/ReferralPanel.tsx`, `src/swap/SwapPage.tsx`, `src/swap/swap.css`.
Interfaces: API GET accepts token and period allowlist; returns `{candles,pool,fetchedAt}` with USD candles. MarketChart consumes `SwapToken`. ReferralPanel consumes connected account and selected output asset, and reads verified contract totals only.

- [ ] Validate sorted candles with finite positive OHLC values and nonnegative volume; reject malformed responses.
- [ ] Replace hero with chart, add mobile ordering, invite dialog and per-quote fee breakdown.
- [ ] Keep preview swaps gated until manifest verification; confirmation snapshots bound inviter.
- [ ] Run `npm test -- --run` and `npm run build`; inspect desktop/mobile, token changes, invitation links and unavailable-data states.

### Task 4: Reviewable preview

- [ ] Commit source, tests, spec and plan to a feature branch; open PR explaining deployment boundary.
- [ ] Verify CI and Vercel preview for exact commit; provide preview URL and fee implementation status.
- [ ] Leave production and active holder distribution unchanged.
