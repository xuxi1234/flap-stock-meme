# Chang’e Fairies / 蝴蝶中秋嫦娥 NFT

7777 ERC-721 NFTs on BNB Smart Chain (56); fixed 0.001 BNB per mint.
Revenue: `0x23898F0866E4D5fa5C9B97645239eD635EA93cDC`.
Authorized gas wallet: `0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA`.
Maximum deployment gas expense: 0.003 BNB. No token approvals, purchases or transfers are needed for deployment.

The collection consists of original generative vector portraits rendered to 512×512 PNG, not thousands of independently generated photorealistic portraits. Each image was checked for unique SHA-256. Assets and metadata are HTTPS-hosted; their manifest SHA-256 is constructor-locked. This commitment detects modifications but does not make web hosting permanent or decentralized.

## Commands
`npm ci --ignore-scripts`; `npm test`; `npm run compile`; `npm run generate` (website checkout); `npm run deploy:check` (published artwork required).

Mint quantity is 1–50 per transaction; larger purchases use separate transactions. Allocation is sequential, not randomized. ERC-721 transfer/approval/metadata are standard OpenZeppelin implementations. No owner, upgrade, admin mint, price change, recipient change or metadata URI change functions exist.

The GitHub workflow is manual only. Its check mode does not receive the private-key secret. Deploy mode requires the explicit checkbox and validates the secret's derived signer against the authorized wallet. It saves a public deployment checkpoint before broadcasting and refuses a second deployment. A separate concurrency group protects this deployment without evicting queued airdrops. The signer check refuses to proceed while another airdrop or mint workflow is active or queued. Never cancel an unrelated airdrop to deploy this project.

After deployment, the website reads the public deployment receipt, verifies chain ID, expected bytecode hash, mint terms and manifest commitment, then enables minting. A failing read always disables purchase. No server-side private key is exposed to the website.

## TokenPocket
Standard ERC-721 + tokenURI JSON with name, description, image, attributes, external_url. PNG artwork; 256×256 `logo.png` prepared. This is compatibility-oriented implementation, not TP certification. Live wallet rendering and indexing need post-deployment verification.
TP instructions: https://help.tokenpocket.pro/en/developer/nft
TP code repository: https://github.com/TP-Lab/tokens/tree/master/NFT/bsc
The published NFT listing guide requests a separate TPT donation and verification transaction; these are not included in BNB deployment authorization and have not been paid.

## Sources
- https://github.com/OpenZeppelin/openzeppelin-contracts (MIT), pinned 5.0.2 for a conservative Paris EVM target; no proxy.
- https://github.com/ethers-io/ethers.js (MIT)
- https://github.com/lovell/sharp (Apache-2.0), used to rasterize original code-native SVG.
- https://eips.ethereum.org/EIPS/eip-721

Local tests verify fixed terms, exact payment, direct revenue transfer, arbitrary batch amounts, supply boundary, metadata queries, transfers, receiver rollback and reentrancy protection. Local simulation is not an independent external security audit.
