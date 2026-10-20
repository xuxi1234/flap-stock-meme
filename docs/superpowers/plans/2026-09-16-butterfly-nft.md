# Butterfly NFT implementation plan

Spec: ../specs/2026-09-16-butterfly-nft.md

## Global constraints
7777 unique original artworks, IDs 1–7777; 0.01 BNB mint price; 7% marketplace fee, 93% seller proceeds; treasury 0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF. Preview only; no mainnet writes, no production deployment. Work on isolated feat/butterfly-nft-market-preview.

## Task 1: Production-oriented contracts
Create contracts/nft as a self-contained package with standard OpenZeppelin ERC721 collection, verifiable-randomness adapter and fixed-price escrow marketplace. No changes to existing airdrop/swap contracts. All configuration must fail closed; no insecure timestamp RNG. Collection maximum 7777, token IDs 1–7777, price exactly 0.01 BNB, no replacement allocation; treasury fixed as above. Pending mints reserve capacity. Safe transfer and treasury payments must not break randomness callbacks: fulfill assigns, authorized claim mints to chosen recipient and pays treasury atomically. Marketplace seller 93%, treasury 7%, NFT buyer; explicit seller-only cancellation, no self-purchase, exact price, nonReentrant transfers, no arbitrary NFT collection. Include meaningful tests and deployment/runbook explaining unconfigured preview. Use available compiler/network safely, never existing signer secrets or mainnet. Report tested behavior and limitations.

## Task 2: Original generative artwork
Create scripts/generate-butterfly-nfts.mjs. Deterministically generate public/nft/art/1.svg..7777.svg and metadata, compact catalog, verification manifest. Use distinct palettes, wing geometry, vein patterns, halos and foil treatments. SHA256 artwork uniqueness excluding edition text and valid supply/attributes tests. Build regenerates artifacts; source committed, generated files served on preview. Inspect actual rendered art.

## Task 3: Marketplace preview
Create src/nft modules scoped CSS, gallery/reveal/collection/market/history dialogs. Browser crypto unbiased random draw and local demo ledger with atomic state transitions. Label simulated data and no real payment. Fees use integer wei. Responsive layout and keyboard/accessibility. Route preview /?view=nft (and /nft). Root production components untouched except lazy route entry. Build generates collection assets.

## Task 4: Verification and Vercel preview
Run meaningful collection and state tests plus typecheck/build and contract tests. Review source. Push only intended NFT changes to isolated GitHub preview branch, inspect Vercel deployment and browser desktop/mobile. Verify reveal, unique ownership, listing/buy/cancel, fee split and downloads. Do not merge main or deploy production.
