# Proposed mainnet launch — execution remains gated

This is a concrete preparation, **not approval to spend**. The proposed funding source is only `0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA` on BNB Chain (56). The combined ceiling is **0.02 BNB**, including **0.01 BNB initial native VRF subscription funding** and **all subscription-creation, funding and deployment gas**. The treasury is not the proposed payer. No other existing wallet or airdrop credential is discovered or selected by the script.

`node scripts/launch.mjs` defaults to check-only. With missing inputs it prints the exact proposal and missing public fields; with complete public inputs it verifies the RPC, coordinator configuration, compiler, gas bounds and public assets. It never reads a key, writes a journal or sends a transaction in check-only mode.

## Reviewed public inputs

Set these explicitly in the operator environment or manual-only workflow:

| Variable | Proposed value |
| --- | --- |
| `NFT_SIGNER_ADDRESS` | `0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA` |
| `NFT_LAUNCH_MAX_SPEND_BNB` | `0.02` |
| `NFT_VRF_INITIAL_FUND_BNB` | `0.01` |
| `NFT_RPC_URL` | Operator-provided BNB Chain RPC |
| `NFT_METADATA_BASE` | `https://flap-stock-butterfly-7777.vercel.app/nft/metadata/` |
| `NFT_ASSET_BASE` | `https://flap-stock-butterfly-7777.vercel.app/nft/` |
| `NFT_LAUNCH_JOURNAL` | Absolute path, for example `/operator-output/launch-56.json` |
| `NFT_DEPLOY_JOURNAL` | Different absolute path, for example `/operator-output/deployment-56.json` |
| `NFT_FRONTEND_CONFIG_OUTPUT` | Optional new path, for example `/operator-output/frontend-disabled.json` |

The output directory must already exist. Persist **both** journals after every run, including failures. Preserve the launch `.lock` file if the process is interrupted; it records the launch identity. JSON journals contain public transaction intents and receipts, not a key. Keep them private to the operator workflow anyway. Do not print environment variables or the key.

Before any funding, the launcher requests `manifest.json`, metadata `1.json` and `7777.json`, their exact `art/1.jpg` and `art/7777.jpg` URLs, and `collection.json`. Requests have a 12-second timeout, reject redirects/HTML/auth pages, and enforce response-size limits. Metadata IDs, names, image/artwork hashes and absolute image paths must match the pinned proposal; JPEG bytes must hash to the reviewed sample hashes. Public manifest collection/image aggregate hashes must match `config/launch-proposal.json`:

- Artwork: `fc6cbb6132de8a32de271c9282c43b61fb76274df2394742c281fcae18f875f7`
- JPEG collection: `83147df7915b2dbdb1bb69f1e50c19f9be72c1d3b61eeb5edfd9ee173cf300c6`

This confirms the manifest and sampled content. It does not re-download all 7,777 images or guarantee future HTTPS-host permanence. A failed availability/hash check stops before key access or a transaction.

## Exact execution gate

Only after explicit approval of the above payer, 0.02-BNB combined cap and 0.01-BNB subscription funding, the operator may supply the dedicated `NFT_DEPLOY_PRIVATE_KEY`, matching exactly that payer, and set:

```text
NFT_LAUNCH_CONFIRM=APPROVE_BUTTERFLY_56:0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA:MAX_0.02_BNB:VRF_0.01_BNB
```

Then the approved invocation is `node scripts/launch.mjs --execute`. Changing payer, funding amount, cap or hosting requires a separately reviewed proposal; the launcher rejects alternatives. It does not read a dotenv file or fall back to shared secrets. Mapping an existing secret to `NFT_DEPLOY_PRIVATE_KEY` is an explicit operator action only after funding-source approval.

Because this payer also has existing wallet workflows, a GitHub operator workflow must use the existing shared concurrency group **`flap-mint-acceptance-bsc56-79f8`**, with `cancel-in-progress: false`, and must be manual-only. The script also refuses new bootstrap transactions while that signer has a pending nonce. The local `.lock` file serializes launcher processes; it cannot coordinate unrelated machines, so shared workflow concurrency remains necessary. Do not run other transactions from this wallet concurrently.

## Transactions and cumulative budget

The launcher creates one dedicated subscription, derives its ID only from the confirmed coordinator `SubscriptionCreated` event owned by the payer, verifies it is fresh, and funds it with exactly 0.01 BNB. It never reuses a supplied subscription ID. It then runs the existing deployment script to deploy adapter, collection and market, bind the collection, and register the adapter consumer.

Before each send, gas is estimated with 20% headroom and constrained by a reviewed upper bound. Creation is bounded to 500,000 gas, funding to 200,000, and deployment to the existing 8,350,000 total gas bound. At the read-only observed quote of 50,000,000 wei/gas (0.05 gwei), the all-gas bound is **0.0004525 BNB**, making the proposed initial all-in bound **0.0104525 BNB**. The script reads a fresh quote; these figures are not a guaranteed execution price. It stops when the bound exceeds the cap.

After bootstrap receipts are confirmed, the child deployment allowance is calculated exactly:

```text
remaining deployment cap = 0.02 BNB
  - actual native funding (0.01 BNB)
  - actual confirmed subscription creation gas
  - actual confirmed subscription funding gas
```

The child receives this allowance as `NFT_MAX_SPEND_BNB`; it counts all of its own previously recorded gas on resume. The launcher does **not** subtract deployment gas twice. Final reporting adds bootstrap funding/gas and all deployment gas, and checks the same overall cap. No automatic subscription refills, mint transactions, paid test purchases or frontend enablement are included. Remaining VRF balance stays in the subscription; it is not a platform fee. Future VRF top-ups require separate authorization.

## Recovery and confirmations

Every transaction must be successful and canonical with at least **three confirmations**, with a canonical receipt re-read before advancing. Source/compiler/configuration hashes, payer, cap, hosting and journal paths form the immutable launch identity. Changed code/configuration fails closed on resume.

Before a bootstrap broadcast, the script persists its complete public intent (sender, target, calldata, value, chain, nonce, gas price and gas limit). It saves the hash immediately after broadcast. On resume it verifies the actual transaction against that intent, recomputes actual cost from confirmed receipts, and does not recreate or refund a completed subscription. A creation/funding broadcast interrupted before its hash is saved stops for manual nonce reconciliation; it never blindly retries. If an operator recovers that hash, the script checks it against the full intent. A failed/replaced transaction or reorg stops for review rather than allocating more budget.

On crash, verify the original process/workflow is no longer active, recover both journals, reconcile on-chain nonces/receipts, and only then remove a stale `.lock`. Never delete a journal, change its identity, or clear an unresolved intent to force a retry. A frontend output path is written only once; for a resume after an already-created output, use a new output filename or omit the optional output variable and retain the prior disabled config.

The revised collection requires immutable valid inviters, batches of 1–20 at 0.01 BNB each, 20% one-generation pull rewards and 80% treasury payment on full claim. The configured callback limit is 2,000,000 gas. Deployment readbacks verify referral rate, batch cap and callback limit along with existing economics. This change invalidates older source/configuration journal identities; do not reuse an old identity to bypass review.

Final output stays `enabled:false` even after successful deployment. The separate release decision must verify compiled runtime code/source, contract economics, genuine VRF fulfillment and hosting. This launcher was exercised with offline mocked providers/fetchers; no mainnet transaction or actual secret was used during preparation.

The bootstrap ABI is pinned to the official [Chainlink SubscriptionAPI source](https://github.com/smartcontractkit/chainlink/blob/contracts-v1.3.0/contracts/src/v0.8/vrf/dev/SubscriptionAPI.sol), including `createSubscription`, `fundSubscriptionWithNative(uint256)` and `SubscriptionCreated(uint256 indexed subId,address owner)`. The official [subscription guide](https://docs.chain.link/vrf/v2-5/subscription/create-manage) explains subscription ownership and separate native-token funding.

