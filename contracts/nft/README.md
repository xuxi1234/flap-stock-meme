# Butterfly Genesis contracts — preview, not deployed

This is an isolated package. No RPC URL, signer, deployment script, deployed address, or mainnet write is included. Existing airdrop/swap contracts are unrelated.

## Fixed economics

- OpenZeppelin ERC721, 7,777 maximum, token IDs 1–7,777, one token per request, exactly **0.01 BNB** on BNB Chain (the Solidity `ether` denomination is 10^18 native-token wei).
- Mint proceeds and market fees go only to **0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF**. No owner withdrawal or treasury setter.
- Market escrow supports only the collection chosen once at construction. Sale price must be exact. Seller receives 93%, treasury 7%; fee rounds down to whole wei, remainder goes to seller. No self-purchases. Only the seller can cancel.
- No upgrades, mutable metadata base, supply expansion, administrative mint, timestamp RNG, or user-controlled randomness.

## Lifecycle and integration

1. `requestMint()` with `10^16` wei reserves capacity immediately and asks the adapter for VRF. Failed requests revert the reservation/payment atomically.
2. `MintRequested(requestId,payer)` identifies the request. Read `requests(requestId)`; zero `tokenId` means pending.
3. The immutable Chainlink coordinator calls the adapter's `rawFulfillRandomWords`. The adapter authenticates sender/request and calls collection `fulfill`. A sparse Fisher–Yates draw assigns an unused ID in constant time. Modulo reduction introduces negligible (<7777/2^256) statistical bias. Fulfillment order, not submission order, determines draw order.
4. `MintAssigned` signals readiness. Only the payer calls `claim(requestId,recipient)`. NFT receiver acceptance and treasury payment are atomic; failure leaves the claim retriable with a different recipient. Fulfillment itself never calls recipient or treasury.
5. Approve the market for a token, then `list(tokenId,priceWei)`. Escrow receives the NFT. `buy(tokenId)` transfers NFT and pays seller/treasury atomically; rejected transfer/payment restores the listing. `cancel(tokenId)` returns it to the seller.

`reserved` counts all accepted requests permanently (pending + assigned + claimed), `assigned` counts fulfilled randomness, `minted` counts successful claims. No request cancellations, rerolls, or admin-selected outcomes. Pending/failed VRF can lock funds and capacity indefinitely: this deliberately avoids a refund/reroll mechanism that could undermine allocation fairness. Monitor funding and gas limits before opening minting. A seller contract that rejects BNB cannot complete sales; cancel and transfer to a receiving wallet first. ERC721 `transferFrom` can forcibly send unlisted tokens into any contract; only normal `list` deposits are supported and there is no privileged rescue.

## Reproduce locally

Use Node 22+ (also tested with Node 24):

```sh
cd contracts/nft
npm ci --ignore-scripts --no-audit --no-fund
npm run compile
npm test
```

Pinned OpenZeppelin 5.4.0, solc 0.8.30, ethers 6.15.0, Ganache 7.9.2; optimizer 200 runs, Shanghai EVM target. Tests use only an in-process EVM and ephemeral generated accounts. The coordinator fixture supplies deterministic words solely to exercise the real adapter/collection/market; it is not a VRF proof-verification test or production randomness source. Ganache may print a native µWS compatibility warning and use its JS fallback on newer Node.

## Deployment runbook — future explicit approval required

1. Obtain independent smart-contract review/audit. Decide and publish metadata for all 7,777 IDs and an immutable content-addressed base URI; upload/pin it before construction. Token URI is base URI + decimal token ID + `.json`, matching the generated metadata filenames. The base URI must end with `/`.
2. Verify the intended chain, current official Chainlink VRF v2.5 coordinator address, key hash/gas lane, coordinator confirmation bounds and maximum callback gas. Create/fund a LINK subscription. These values are intentionally absent from preview configuration.
3. Deploy `ButterflyVRF(coordinator,keyHash,subscriptionId,confirmations,callbackGasLimit)` first. Constructor rejects a non-contract coordinator, zero key/subscription, fewer than 3 confirmations, or less than 200,000 callback gas. These minimums do not replace network-specific validation. Coordinator is immutable; no migration/admin redirection.
4. Deploy `ButterflyNFT(adapter,baseURI)`, then use the adapter deployer to `bindCollection(collection)` once. Binding validates the collection's adapter reference; it cannot be changed. Register the **adapter** as the VRF subscription consumer. Until binding/funding/consumer registration are valid, minting fails closed or fulfillment remains pending according to coordinator behavior.
5. Deploy `ButterflyMarket(collection)`. Independently verify constructor args, exact treasury, all bytecode and source on the explorer. Deployment of a malicious or wrong coordinator/adapter cannot be made safe by constructor code-length checks.
6. Complete a BNB testnet lifecycle: request, oracle fulfillment, claim, receiver rejection/retry, list, buy, cancel; measure real callback gas and keep a margin. Test authentic VRF fulfillment, subscription accounting and operational recovery/monitoring. This package's local fixture does not establish those properties.
7. Only after explicit production authorization, configure the frontend with verified addresses and chain ID. Until then, leave live transaction controls disabled and label all artwork/mints/listings as simulations. Never use fixtures for deployment.

Chainlink request ABI and extra-args encoding follow [VRF v2.5 documentation](https://docs.chain.link/vrf/v2-5/getting-started) and [VRFV2PlusClient](https://github.com/smartcontractkit/chainlink/blob/contracts-v1.3.0/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol). The small local interface avoids bundling unrelated Chainlink packages; live coordinator compatibility remains a testnet deployment gate. Source is production-oriented, **not audited or approved for mainnet**.
