# NFT Referral and Batch Mint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add immutable one-generation referrals and1–20 batch mint to independent NFT site.
**Architecture:** Extend undeployed ERC721 contract while preserving market API. UI integrates exact versioned economics and on-chain batches; public deploy stays disabled pending separately authorized chain funding.
**Tech Stack:** Solidity0.8.30/OpenZeppelin5.4,React19,viem,Vite,Node/Ganache.
**Spec:** docs/superpowers/specs/2026-09-18-nft-referral-batch.md

## Global Constraints
- Price0.01BNB each,supply7777,IDs1–7777,market fee0,treasury0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF.
- One-generation20% referral reward,80% treasury; immutable inviter; no automatic default inviter; reject zero,self,collection,0xdead.
- Quantity1–20 integers; one paid request and one claim for entire batch; do not fake chain state.
- Do not spend BNB or enable deployment.json. Publish independent https://flap-stock-butterfly-7777.vercel.app only.
- Preserve metadata/art hashes and original official swap.

### Task 1: Contracts, exact economics and safe batch allocation
**Files:** contracts/nft/src/ButterflyNFT.sol,contracts/nft/test/{nft.test.mjs,Fixtures.sol},contracts/nft/config/bsc-vrf.json,contracts/nft/scripts/deploy.mjs,contracts/nft/{README.md,LAUNCH.md},docs/nft-live.md.
**Interfaces:** consumes existing VRF request/fulfill ABI and ERC721 market; produces requestMint(uint256,address),bindReferrer(address),referrers(address),REFERRAL_BPS=2000,MAX_BATCH=20,requests(id)->(payer,tokenId,claimed,quantity,referrer),requestTokenIds(id)->uint256[],withdrawReferralRewards(address),invitedCount/referralMintCount/referralEarned/referralRewards(address). Legacy requestMint() requires existing binding. claim(id,recipient) claims entire batch.
- [ ] Add failing behavioral tests using existing Ganache fixture: c.requestMint(5,inviter,{value:parseEther('0.05')}); assert reserved5,fulfill creates5distinct IDs,claim increases balance5,treasury delta0.04,reward credit0.01; assert repeat claim rejected; withdraw pays0.01once. Reject invalid inviter,changing binding,invalid qty0/21 and nonexact payment. Test20 callback gas <2000000,duplicate VRF,capacity at7777,receiver rejection and rejecting/reentrant inviter. Update legacy fixture setup to bind before old noarg requests; retain full-seller market test.
- [ ] Implement checked batch reservations,immutable binding,keccak-derived per-index draws with existing Fisher-Yates mapping,full-batch claim and pull-based rewards. Keep fulfill no external calls. Update callback config and deployment readback to verify economics/batch cap. No execution side effects.
- [ ] Run relevant contract/deploy/launch tests, compile, inspect max-batch gas. Commit changes and record exact commands/results plus ABI in task report.

### Task 2: Wallet binding, batch UI and live chain adapter
**Files:** src/nft/{chain.ts,model.ts,NFTPage.tsx,nft.css,model.test.ts,NFTPage.test.tsx},new focused mint/referral components or tests as needed.
**Interfaces:** consumes Task1 ABI exactly; produces validated quote helper,referral binding draft/checks,batch request/claim state and invite dashboard. readState returns real binding/stats and pending{requestId,quantity,tokenIds}; transact('mint',account,{quantity,referrer},onHash) sends exactquantity*price; withdraw action invokes contract withdrawal to current account.
- [ ] Tests: expect quote5 total50000000000000000n,reward10000000000000000n,treasury40000000000000000n; reject empty/zero/fractional/21 qty; invalid/self/zero/burn inviter; wrong URL never overrides stored binding; deployment disabled never enables pay or shows fake rewards.
- [ ] Implement visually polished mint dialog with stepper,presets,input,live exact quote,binding card and explicit first-bind acknowledgment. URL ?ref imports draft, persisted locally only as draft, connected on-chain binding authoritative. Include invitation panel with copy link and real reward withdrawal. Batch pending and reveal show all IDs, honor reduced motion. Headline/detail/rules retain zero market fees and explain separate gas for claim.
- [ ] Update chain ABI,version/economics validation and refresh handling. No fake local ledger and no enabling contract config. Replace missing old concept image with existing actual NFT artwork without changing art generator. Fix standalone packager to collect nested NFT components and omit unrestored concept binary.
- [ ] Run targeted frontend tests and tsc/build; commit and report.

### Task 3: Independent deploy and verification
**Files:** scripts/package-nft-vercel.mjs,docs/nft-live.md,publication report.
- [ ] Package standalone sources with fixed public asset origin and unchanged generated art, push only changed files to existing NFT feature branch via GitHub connector (partial restored repo must not delete other remote files).
- [ ] Deploy separate Vercel project flap-stock-butterfly-7777,inspect build logs until READY. Existing official website untouched.
- [ ] Browser-check quantity/referrer forms,disabled real payment,desktop/mobile,invite rules and batch totals. Verify public metadata remains accessible. Report site link and clear chain launch status.
