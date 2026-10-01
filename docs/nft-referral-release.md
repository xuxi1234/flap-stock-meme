# NFT referral and batch release — 2026-09-18

Website: https://flap-stock-butterfly-7777.vercel.app

Independent Vercel production deployment `dpl_48etrZ4FB1MtSCunb4WFRRkKj8zg` reached READY and the public alias was verified. Runtime source corresponds to GitHub commit `e66df632eb52a43a3caaa9358f9cc8f668f10c05`. The official swap deployment was not promoted.

## Rules implemented

- Each NFT costs 0.01 BNB. Collection supply remains 7,777 unique IDs and images.
- First mint requires a valid, immutable direct inviter, with explicit confirmation. A URL supplies only a draft; chain binding is authoritative.
- One-generation reward is 20%: 0.002 BNB per NFT credits the inviter after a successful full-batch claim. The inviter withdraws the credit. The fixed treasury receives 0.008 BNB per NFT.
- Quantity is an integer from 1 to 20. One principal payment requests all IDs; VRF assigns without replacement, followed by one atomic full-batch claim. Request and claim have separate network Gas.
- Secondary-market fee remains zero; the seller receives the full price.

The delegated design choices are 20% rewards, a 20-NFT batch cap, immutable binding and pull withdrawals. These can be revised before mainnet launch. After deployment, changing immutable rules requires a new contract and corresponding integration.

## Verification

- Final functional tree: 35/35 contract tests and 31/31 NFT frontend tests passed. TypeScript and standalone Vite builds passed.
- Full 20-NFT callback consumed 1,100,633 gas under the configured 2,000,000 limit in local contract tests.
- Independent contract, frontend and final reviews passed. Corrected replacement/cancellation receipt handling prevents false claim success; equivalent repricing is checked against the intended operation.
- Vercel build verified all 7,777 unique artwork/JPEG hashes, IDs and metadata. Both collection hashes remain unchanged.
- Published desktop checks: five NFTs quote 0.05/0.01/0.04 BNB; seven quote 0.07/0.014/0.056 BNB. Quantity 21 and burn inviters are rejected. Payment remains disabled, and unavailable rewards are explicitly unavailable.
- Published 390- and 320-pixel mobile frames showed no horizontal overflow. New dark-panel background/text were inspected in screenshots and computed styles. The temporary invitation draft used for testing was restored empty.
- Public-host manifest and edition 7777 metadata returned HTTP 200 through the Vercel fetch tool with the correct image URL. Browser raw-JSON navigation and general web retrieval were unavailable, so those were not counted as successful checks.
- Vercel's available runtime-error scan found no errors in the inspected 15-minute range. This does not establish absence of all browser or chain errors.

## Chain status

Mainnet contracts are not deployed and `deployment.json` remains disabled. No signing key was loaded and no BNB was spent. Real paid minting, withdrawals, resale and TokenPocket import have not been accepted on mainnet. The existing separate funding approval gate remains in place; see `contracts/nft/LAUNCH.md`.

Pending VRF requests currently have no cancellation/refund path. Oracle funding/monitoring and maintained HTTPS metadata hosting remain launch responsibilities. Local tests and code review are not an external security audit.
