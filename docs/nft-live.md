# Butterfly 7777 — nature edition and zero-fee market

## Current state
Source includes real BSC wallet transactions; simulation and demo inventory have been removed. `src/nft/deployment.json` deliberately remains disabled until mainnet contracts, oracle subscription, public metadata and bytecode hashes are verified. This is not a completed chain launch.

## Economics
- Fixed 7,777 ERC-721 IDs, 1–7777, random assignment without replacement via Chainlink VRF v2.5 native-BNB subscription.
- Exact mint payment 0.01 BNB per NFT, quantity 1–20 per paid request. On successful full-batch claim, 0.008 BNB per NFT goes to `0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF` and 0.002 BNB becomes the inviter’s withdrawable credit.
- Marketplace fee permanently zero. Asking 0.15777 BNB pays seller exactly 0.15777 BNB. Gas is paid separately by the transaction sender.
- Noncustodial listings: NFT remains with seller until purchase. Ownership transfer nonce invalidates old orders even if ownership later returns. Revoked approval stops purchase. ERC-2981 royalties are not configured.
- A valid one-generation inviter must be bound permanently, separately or in the first paid batch request. Zero, self, collection and `0xdead` are rejected. There is no default inviter and no second-generation reward. Binding does not demonstrate unique human participation. Inviter rewards use pull withdrawals to a chosen recipient, so an inviter rejecting BNB cannot block claims.
- Mint requires one batch request + oracle allocation + one atomic full-batch claim. VRF assigns all distinct IDs before claim, with a 2,000,000 callback gas limit. Failed recipient or treasury calls leave claims retriable without accruing rewards. Unfulfilled oracle requests cannot currently be cancelled or refunded. Funding and monitoring the oracle is essential.

## Art and wallet format
Twelve natural butterfly inspirations, not 7,777 actual species. Original deterministic wing geometry, patterns and color palettes. Images are 640×640 JPEG, each separately hashed; 7,777 unique art hashes and image hashes validated. Actual NFT artwork #7777 is displayed and labelled as the actual work, matching the gallery and metadata.
`tokenURI(id)` resolves `{fixedMetadataBase}{id}.json`, with absolute image URL, name, description, attributes. `contractURI()` resolves `collection.json`, zero fee metadata. Production metadata base must be fixed before deploying (the contract has no base-URI setter). Public HTTPS hosting still requires ongoing maintenance; this is not claimed as permanent decentralized storage.
Set `NFT_ASSET_BASE_URL=https://<stable-public-host>/nft` during build. Without it deployment-local URLs are generated only for review; the chain deployment gate remains disabled.
TokenPocket supports adding a custom NFT by contract address. Format compliance does not guarantee immediate wallet indexing or automatic logo inclusion. Verify BscScan source and actual TP import before advertising wallet display as tested.

## Deployment
`npm run build:nft` creates standalone site. Normal `npm run build` preserves the original site routes. Do not promote the NFT branch on the shared Vercel project, because its production aliases are the official swap domains.
`contracts/nft/scripts/preflight-public.mjs` only reads network, balances and gas estimates. Its GitHub workflow never reads a private key or sends a transaction.
`contracts/nft/scripts/deploy.mjs` defaults to check-only and requires an explicit signer, NFT-specific key for execute, owned funded VRF subscription, metadata base and cumulative spend cap. Gas budget is distinct from oracle funding. Existing airdrop budget is not reused.
Mainnet launch needs: identified authorized gas-paying wallet and cap; a native-BNB-funded VRF subscription owned by that signer; stable public image and metadata hosting. Once complete, verify deployed runtime hashes/economics and populate deployment.json. No user should pay before these gates pass.

## Sources checked 2026-09-16
- https://help.tokenpocket.pro/cn/developer/nft — collection information/logo submission, distinct from per-NFT metadata.
- https://help.tokenpocket.pro/cn/wallet-operation/about-nft/set-nft — adding by NFT contract address.
- https://eips.ethereum.org/EIPS/eip-721 — ERC-721 tokenURI JSON schema.
- https://docs.opensea.io/docs/metadata-standards — metadata fields and image URIs.
- https://docs.chain.link/vrf/v2-5/supported-networks — BSC coordinator, keyhash and native payment.
- https://www.nhm.ac.uk/discover/butterflies-moths.html — natural butterfly inspiration.
- https://www.nhm.ac.uk/discover/butterfly-wings-science-behind-the-colour.html — pigment and structural coloration.

## Verified mainnet preflight
GitHub run [35069675599](https://github.com/xuxi1234/flap-stock-meme/actions/runs/35069675599) completed read-only at block122183178 (2026-09-16T07:40:14Z). Gas price0.05gwei; adapter estimate606083gas (0.00003030415BNB); conservative all-deployment bound0.0004175BNB, excludes subscription funding. Wallet0x74a7…69aA held0.09190260835097736BNB; treasury held0BNB. Estimates vary with gas price. No keys loaded or transactions sent.
Proposed launch budget, **not yet authorized**: use the0x74a7…69aA wallet with a cumulative0.02BNB cap including0.01BNB initial VRF funding. Subscription must be monitored/refilled as supply mints; initial funding is not a promise to cover all7777requests. Reuse the wallet's existing GitHub concurrency group to avoid collision with airdrops.

## Published website verification
Standalone website: https://flap-stock-butterfly-7777.vercel.app (independent from the official swap). Browser checks confirmed the 7,777-item gallery, 637 Morpho-inspired items after filtering, no invented market orders, and disabled payment until chain deployment. 390px and320px test frames had no horizontal overflow. GitHub UI test/build run35070859409 passed.

The long team-scoped Vercel alias requires authentication even though the short production alias is public. All metadata, image URLs and the launch proposal therefore use only the short public alias. Never deploy immutable tokenURI using the protected team alias. A metadata-host correction is being published; recheck public token metadata and image accessibility before any on-chain funding.

