# Butterfly 7777 — nature edition and zero-fee market

## Current state
Source includes real BSC wallet transactions; simulation and demo inventory have been removed. `src/nft/deployment.json` deliberately remains disabled until mainnet contracts, oracle subscription, public metadata and bytecode hashes are verified. This is not a completed chain launch.

## Economics
- Fixed 7,777 ERC-721 IDs, 1–7777, random assignment without replacement via Chainlink VRF v2.5 native-BNB subscription.
- Exact mint payment 0.01 BNB. On claim, the entire mint payment goes to `0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF`.
- Marketplace fee permanently zero. Asking 0.15777 BNB pays seller exactly 0.15777 BNB. Gas is paid separately by the transaction sender.
- Noncustodial listings: NFT remains with seller until purchase. Ownership transfer nonce invalidates old orders even if ownership later returns. Revoked approval stops purchase. ERC-2981 royalties are not configured.
- Mint requires request + oracle allocation + claim. Unfulfilled oracle requests cannot currently be cancelled or refunded. Funding and monitoring the oracle is essential.

## Art and wallet format
Twelve natural butterfly inspirations, not 7,777 actual species. Original deterministic wing geometry, patterns and color palettes. Images are 640×640 JPEG, each separately hashed; 7,777 unique art hashes and image hashes validated. AI-generated naturalist concept image is labelled as concept, not the actual NFT render.
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
