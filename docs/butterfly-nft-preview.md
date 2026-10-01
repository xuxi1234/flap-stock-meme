# Butterfly 7777 preview handover

This feature lives on `feat/butterfly-nft-market-preview`. Do not merge or promote it to production as part of the preview task. Existing app.gupiao.sh and airdrop workflows are outside this feature.

## What is implemented

- Original butterfly illustrations, IDs 1–7777, served at `/nft/art/{id}.svg`.
- Paired ERC721-style metadata `/nft/metadata/{id}.json`, a searchable catalog and SHA-256 manifest. Generation is deterministic; no edition numbers are embedded in artwork and all artwork hashes are unique.
- Preview route `/?view=nft` or `/nft`: gallery, rarity/search/sort, random reveal, local collection, listing/cancel/buy, exact integer-wei 93%/7% breakdown, history, image download and metadata inspection.
- Browser-wallet connection reads the public account only. The preview does not sign, approve, request payment or submit transactions. Local demo entries are not real NFTs and not shared between users. Use a single tab for the local ledger.
- Isolated OpenZeppelin ERC721, Chainlink VRF v2.5 adapter and escrow marketplace source in `contracts/nft`, with a separate package and local EVM tests.

## Economics

- Mint: exactly 0.01 BNB, one randomly allocated unused ID.
- Marketplace sale: 93% to seller, 7% to treasury, NFT to buyer. Fractional fee wei rounds down; remainder to seller.
- Treasury: `0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF`.
- No additional 7% fee on the mint. No guaranteed fees on external marketplaces.

## Reproduce

```sh
npm ci
node scripts/generate-butterfly-nfts.mjs
node scripts/verify-butterfly-nfts.mjs
npx vitest run src/nft/model.test.ts
npm run build
cd contracts/nft
npm ci --ignore-scripts --no-audit --no-fund
npm run compile
npm test
```

Generated art is rebuilt during the Vercel build; the entire generated folder is intentionally not committed. The generator and original concept WebP are versioned. The collection hash after review fixes is `9e534a1a62f66b8c283ce633615178a55b7059292f096f96798b2a5ef30fb180`.

## Validation evidence

- All 7777 artwork hashes unique; contiguous IDs and paired metadata verified; no numeric artwork text or executable SVG elements.
- Six focused frontend state tests pass, including supply end, invalid IDs, ownership/list/cancel, stale-price/duplicate purchase, exact wei splits, malformed persisted-ledger recovery.
- TypeScript and Vite production build pass.
- Seven initial local EVM cases pass across runs; exhaustive 7777 pending reservations reject the 7778th. Four targeted post-review EVM cases pass for metadata/configuration and hostile claim/seller/payout behavior. See contract README for exact limitations; mocks do not validate a real VRF oracle proof.
- Browser preview exercised mint, list at 0.03 BNB (seller 0.0279, fee 0.0021), buy at 0.012 BNB (seller 0.01116, fee 0.00084), cancellation and reload persistence. Responsive helper `/nft-layout-check.html` supports 320/375/390/768/1280 widths.

## Before accepting real BNB

The source is not audited and no contracts are deployed. Complete independent review, immutable content-addressed storage (replace preview-relative metadata image URLs with permanent absolute URIs), genuine BNB testnet VRF lifecycle and operational funding checks. Then deploy verified contracts and add a real on-chain frontend/indexer. Current UI intentionally remains simulated and cannot be enabled for real payments merely by changing a label or adding a treasury address.

Unfulfilled VRF requests in this contract design lock deposits/capacity without refunds or rerolls; assess and resolve operational policy before launch. The contract README documents the deployment order and further failure modes.

## Research / attribution

Viewed Flap's public [Wrapped video](https://x.com/flapdotsh/status/2098283071598669869) and [collector card](https://x.com/Oxdirss/status/2098283963458764985) for visual direction: dark collectible surfaces, lime accent, specimen hierarchy and reveal. No Flap artwork or logo was copied. [HashLips Art Engine](https://github.com/HashLips/hashlips_art_engine), MIT, informed generative DNA/trait thinking; this project's SVG generator is original and does not depend on HashLips. Contracts use [OpenZeppelin ERC721](https://docs.openzeppelin.com/contracts/5.x/erc721) and the [Chainlink VRF v2.5 request interface](https://docs.chain.link/vrf/v2-5/getting-started).
