# Butterfly Live Nature Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.
**Goal:** Replace simulated NFT experience with zero-fee real-chain integration and original nature-inspired art.
**Architecture:** ERC721 random mint with VRF adapter; atomic zero-fee marketplace; React/viem wallet client; deterministic art generation and JPEG metadata.
**Tech Stack:** Solidity/OpenZeppelin, ethers/Ganache, React/viem, Node SVG/JPEG.
**Spec:** docs/superpowers/specs/2026-09-16-nft-live-nature.md
## Global Constraints
Exact mint 0.01 BNB; 7777 IDs; treasury 0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF; market fee zero; no main site deployment; no secret disclosure or chain transaction by worker. Preserve existing swap and airdrop files.
### Task 1: Contracts and bounded deployment preparation
Files: contracts/nft/** only. No root/frontend changes.
- [ ] Replace marketplace with noncustodial on-chain listings, NFT remains seller-owned until buy. list(id,price), cancel(id), buy(id) payable exact price; seller gets all BNB. Keep FEE_BPS=0 getter and Sold(...,fee=0) compatibility. Expose isListingActive(id) view validating ownership and approval; stale listings must not resurrect when token leaves and returns. Add collection transfer nonce and listing snapshot if necessary. Tests exact 0.15777 BNB seller delta, rejects wrong price, approval revocation, stale transfer, failed payout rollback, receiver/reentrant attack, cancellation no NFT transfer.
- [ ] Extend collection with wallet-friendly ERC721 enumeration via OpenZeppelin Enumerable; owner/global enumerable interfaces; pending request discovery per payer bounded pages. Keep existing requestMint(), requests(id), claim(id,recipient), randomized assignment. Add collection-level contractURI derived from fixed base. No ERC2981 royalties.
- [ ] Change VRF adapter to native BNB subscription billing; update mocks/tests. Research official current BSC VRF coordinator/keyhash via official docs, store configuration with source URL; do not make outbound chain transactions.
- [ ] Prepare contracts/nft/scripts/deploy.mjs, check-only default: network56, explicit signer address, metadata absolute HTTPS/IPFS validated, oracle config validated, gas estimates, budget cap, receipt journal, source/compiler hash. Execute must require NFT-specific key, explicit max spend and confirmation; never reuse airdrop secret automatically. Prefer resumable deployment and fresh funded VRF subscription native BNB. Document concrete unresolved funding/hosting inputs rather than fabricate values.
- [ ] Run targeted Ganache tests and compile; full reserve-cap test only if allocation changed. Commit only owned files and report interface signatures and tests to .superpowers/sdd/2026-09-16-nft-live-nature/task-1-report.md.
### Task 2: Nature art and real wallet client
Files: scripts/generate-butterfly-nfts.mjs, scripts/verify-butterfly-nfts.mjs, src/nft/**, public/nft-assets/**, docs/nft-live.md.
- [ ] Generate original nature-inspired concept using image generator, implement varied species families and high-contrast palettes; rasterize JPEG, absolute metadata URL required for mainnet. Validate 7777 unique SHA256 and contiguous IDs.
- [ ] Implement wallet client against Task1 ABI: read deployed configuration, validate chain/contracts/economics, enumerate real owners/listings, request mint, track requests on chain, claim, approve single NFT/list, cancel, buy exact price. No fake ledger state in UI. Render inactive state until config verified.
- [ ] Test arithmetic, config fail closed and build; inspect mobile layout.
### Task 3: Review, publish and chain launch gate
- [ ] Review contract and frontend integration, no 7% text or implicit royalty remains.
- [ ] Push NFT branch only, preserve repository remote base tree and unrelated files. Use independent Vercel deployment.
- [ ] Perform read-only mainnet check. If NFT-specific signer, oracle funding or stable storage missing, report exact remaining setup and stop before charging users. Otherwise deploy within explicit cap, verify deployed bytecode/economics and publish real contract config.
