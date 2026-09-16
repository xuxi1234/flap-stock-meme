# Butterfly Genesis contracts

Local implementation and deployment preparation. No production contracts have been deployed by this package's implementation work.

## Economics and interfaces

- ERC721Enumerable: 7,777 IDs, exactly **0.01 BNB** per mint request; mint proceeds go to **0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF** on claim. No royalties/ERC2981, platform sale fee, admin mint or mutable metadata.
- `requestMint()` reserves capacity, `requests(id)` returns `(payer,tokenId,claimed)`, and only the payer can `claim(id,recipient)` after assignment. The authenticated VRF callback makes no external payments or receiver calls. Allocation remains the original constant-time sparse Fisher–Yates algorithm.
- `payerRequestCount(payer)` and `payerRequests(payer,offset,limit)` expose stable append-only request IDs. Limit is at most 100; pages include claimed requests, so clients read `requests(id)` and filter status. `totalSupply`, `tokenByIndex`, `tokenOfOwnerByIndex` support wallet inventory.
- `contractURI()` is fixed base + `collection.json`; `tokenURI(id)` is fixed base + decimal ID + `.json`.
- Market `list(id,price)` requires current ownership and market approval. The NFT **stays in the seller wallet**. Listing again updates its price and transfer snapshot. `listings(id)` returns `(seller,price)`; clients must check `isListingActive(id)`.
- `listedTokenCount()` and `listedTokenIds(offset,limit)` (max 100) expose append-once historical listing candidates; filter with `isListingActive`. Relisting does not duplicate an ID.
- `buy(id,expectedSeller,expectedVersion)` binds the seller and listing version reviewed by the buyer. It requires the exact BNB price, atomically safe-transfers the NFT and pays **100% to the seller**. `FEE_BPS=0`; `Sold` retains its fee argument with zero. Receiver or payout rejection restores ownership, approval, nonce and listing. `cancel(id)` only clears the listing and does not transfer the NFT.
- `listingVersion(id)` increments on every successful `list`, including unchanged-price updates, and survives cancellation and sale. The old unbound `buy(id)` method does not exist. Clients must snapshot seller/version from the displayed order and pass both; replacement or cancelled/relisted orders revert even at the same price.
- Every NFT ownership update increments `transferNonce(id)`. The market snapshots `listingNonce(id)`: a transfer away and back cannot resurrect a listing. Revoked approvals disable sales; reapproval can reactivate an unchanged-owner listing. Cancel to remove it permanently.

Pending requests reserve funds/capacity indefinitely; no cancellation or reroll path exists. A maintained VRF subscription and monitoring are operational requirements. There is no rescue for NFTs forcibly sent with unsafe ERC721 transfers. A seller contract must accept BNB.

## Local verification

```sh
cd contracts/nft
npm ci --ignore-scripts --no-audit --no-fund
npm run compile
node --test --test-skip-pattern='all 7777' test/*.test.mjs
```

`npm test` also runs the slower full 7,777-reservation capacity test. OpenZeppelin 5.4.0, solc 0.8.30, optimizer 200, Shanghai; ethers 6.15.0 and Ganache 7.9.2. Local tests use ephemeral accounts and a deterministic coordinator mock that explicitly rejects LINK-billed requests. Ganache's optional native µWS warning falls back to JavaScript.

## BNB Chain VRF

`config/bsc-vrf.json` pins the official chain-56 coordinator, 200-gwei gas-lane hash, 3 confirmations, and 300,000 callback gas. Adapter requests use `ExtraArgsV1({nativePayment:true})`. Parameters were checked against [Chainlink's supported-networks documentation](https://docs.chain.link/vrf/v2-5/supported-networks#bnb-chain-mainnet) on 2026-09-16; deployment also reads coordinator configuration. BNB VRF costs are **separate from mint price**, paid by the project's native BNB subscription. The immutable coordinator/binding cannot be migrated.

## Guarded deployment preparation

`node scripts/deploy.mjs` is check-only by default. Missing configuration produces a concrete missing-input report and sends nothing. It never loads dotenv, looks up airdrop/shared keys, or creates a signer in check-only mode.

Required public inputs: `NFT_RPC_URL`, explicit `NFT_SIGNER_ADDRESS`, final absolute HTTPS/IPFS `NFT_METADATA_BASE` ending `/`, HTTPS `NFT_ASSET_BASE` ending `/`, `NFT_VRF_SUBSCRIPTION_ID`, and explicit `NFT_MAX_SPEND_BNB`. The script verifies chain 56, coordinator code/configuration, subscription ownership/native balance, signer balance, compiler/source hash and budget. It estimates each executable step, adds 20% gas headroom, and uses conservative bounds for dependent steps before they exist. It does not claim to estimate unavailable dependent constructors.

Execution additionally requires `--execute`, the dedicated `NFT_DEPLOY_PRIVATE_KEY`, and `NFT_DEPLOY_CONFIRM=DEPLOY_BUTTERFLY_ON_56:<checksummed signer address>`. It deploys adapter, collection and market, binds the collection once, and adds the adapter as consumer. Each transaction has a bounded legacy gas price and gas limit; cumulative gas spend cannot exceed the explicit cap. Three confirmations are required for new, recovered and previously recorded transactions; shallow receipts stop the run until the operator retries. Canonical receipts are re-read after checking confirmation height. No transaction or secret was used to test this preparation.

`NFT_DEPLOY_JOURNAL` optionally changes the receipt journal path (default `deployment-56.json`). Resume uses the same source/configuration identity and verifies canonical receipts. Intent is persisted before broadcast and hash immediately afterwards. If a crash falls between broadcast and hash persistence, the script stops for nonce/receipt reconciliation instead of duplicating a deployment. Never delete an unresolved journal merely to bypass that stop. Use a dedicated signer without concurrent transactions. Retain the journal outside source control.

Concrete unresolved launch inputs:

1. Publish and pin all 7,777 metadata JSON files, matching JPEG assets and `collection.json`; verify their availability. URI validation checks syntax, not hosting completeness or immutability.
2. Select/fund the NFT deployment signer and supply an RPC and explicit gas budget.
3. Create a **fresh dedicated VRF v2.5 subscription** using the official [subscription workflow](https://docs.chain.link/vrf/v2-5/subscription/create-manage), owned by that signer, and fund native BNB. Standalone `deploy.mjs` only registers the deployed adapter. The separately gated `launch.mjs` can create/fund the dedicated subscription and run deployment under one combined cap; see [LAUNCH.md](LAUNCH.md). The gas cap excludes this prior subscription funding. No subscription ID or funding amount is fabricated.
4. Verify authentic VRF fulfillment and callback gas on testnet, obtain contract review, and define subscription refill/monitoring responsibility before opening paid minting.
5. After authorized deployment, verify source/constructor arguments on the explorer and provide the three resulting addresses to the UI. Live deployment itself remains unperformed.

After all steps, the script reads back code, mint price, maximum supply, treasury, zero market fee, collection/adapter bindings, metadata base and funded consumer registration. It prints a frontend-compatible `frontendConfig` containing chain ID, contract addresses, runtime code hashes and HTTPS JPEG `assetBase`. Optional `NFT_FRONTEND_CONFIG_OUTPUT` writes that JSON to a new file (never overwrites an existing file). Output always has `enabled:false`; independent source/runtime-code verification, authentic VRF validation and hosting checks must precede a separately reviewed release that enables payments. The script never enables frontend transactions automatically.

## Proposed combined launch

[LAUNCH.md](LAUNCH.md) documents the check-only-by-default `scripts/launch.mjs` workflow, hard-pinned proposed payer, 0.02-BNB total cap including 0.01-BNB initial native VRF funding, verified public manifest/sample JPEGs, three-confirmation recovery, and exact execution gate. Funding-source/budget approval remains outstanding; preparation does not authorize execution.
