# Independent Butterfly Mint — 2026-09-12

Preview branch only. Production is unchanged. This implementation is original and non-upgradeable; it does not claim to reproduce the reference site's unavailable Solidity source.

## Frozen deployment

- Network: BSC (56).
- Factory owner and commission receiver: `0x79F8b832DE72e81Ad34fd66EcbbF673613264072`.
- Flap VaultPortal: `0x90497450f2a706f1951b5bdda52B4E5d16f34C06`.
- Owner may pause new campaign creation. No owner method withdraws participant escrow or modifies existing campaign terms.
- Deploying the factory sends zero BNB value; UI maximum network-fee allowance is 0.002 BNB. Wallet signature is required.
- Factory deployment input keccak256: `0xa59fd8a065441b738365cb3eb25e7b3824bf0d7f07e8f37a02443d0fd4f0b198`.
- Solidity 0.8.24, optimizer 200, Paris. Factory runtime 2,257 bytes; campaign runtime 9,999 bytes.
- ABI/creation bytecode are reproducible with `forge build --root contracts` and `node scripts/build-mint-artifacts.mjs --check`. CI checks formatting, sizes, tests and artifact equality. No signer or broadcasting in CI.

## What is implemented

Each share costs 0.01 BNB. Before launch, participants may refund their own shares at any time; cancellation or expiry preserves this right. At full subscription before the deadline, anyone may submit a reviewed launch transaction using the frozen Flap configuration and minimum output. A failed launch rolls back, preserving refunds. Following launch, each participant claims their pro-rata tokens and any returned BNB. Only rounding residue after every share is claimed can be collected by the creator.

The preview includes wallet-signed factory deployment, exact creation-transaction verification, campaign creation, listing, contribution, refund, cancellation, launch and claim. Ordinary vault functionality remains available. The first web adapter uses the percent-buyback factory; it does not claim all catalog templates work with Mint.

Factory provenance requires an exact matching deployment input, sender, zero value, successful creation receipt, two blocks of confirmation, deployed code and matching immutable addresses. An arbitrary contract with similar getters is not accepted. Campaigns must be registered by that verified factory. Cross-device links carry factory transaction hash and campaign address; balances are read from BSC.

## Verification completed

- 15 new campaign tests, including 256 fuzz cases; full Foundry suite: 33 passed, one optional fork test skipped in offline run.
- Separately enabled BSC fork at block 121370887: PASS, simulated 0.02 BNB subscription, real Flap V6 launch, actual token transfer to participant and registry checks. No real funds spent. See `mint-fork-result.json`.
- 24 vault frontend/service tests passed, including constructor simulation, wallet identity, persisted pending transactions, exact deployment provenance and rejection of unrelated campaigns.
- TypeScript and production build passed.

## Mainnet acceptance still required

Update: factory deployment succeeded in user-signed transaction `0x6e048b3aecb8c376162960bc0074f200a6dbab8810f0b3bbf6451144d032d7a2`, block 121375692. Factory `0xA64186DB66bAed9fDC13678c4Cfb89B1e1E9cCa9`, implementation `0x904C9E436299A65Fc25f32c48F3f908534F0e988`. Exact creation input, code presence, owner, commission receiver and VaultPortal were checked. The new preview auto-verifies this deployment and removes repeat factory deployment. Next, use separate reviewed signatures for one small campaign, contribution/refund, funding, launch and claim. This is not an audited or fully mainnet-accepted fundraising product yet.

The default Mint form uses acceptance-test metadata, 2 shares, seven days, buy/sell tax 3%, 100% tax allocation to the third-party percent-buyback vault, 60-second interval and 10% spend fraction. Its minimum output is editable and frozen on creation. Thresholds do not guarantee prices or profits. Third-party Flap/underlying vault upgrade and fee rules remain external dependencies.

The transaction budget journal is browser/origin local. Its 0.1 BNB ceiling is not a global on-chain spending limit; changing preview origins or clearing storage resets local history. Review cumulative mainnet spending against actual receipts before each acceptance step. Never put private keys into this public repository.
