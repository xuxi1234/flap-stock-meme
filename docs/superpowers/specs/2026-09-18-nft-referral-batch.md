# NFT referral and batch mint design

User delegates product decisions and authorizes updating the independent Vercel site. Mainnet contracts are not deployed; prior funding-source question remains unanswered. Do not spend BNB or enable deployment.json in this task.

## Product
Require a valid inviter before mint participation. Recommend and implement one-generation 20% rewards: exactly0.002BNB per claimed NFT to inviter credit,0.008BNB to existing treasury0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF. Mint price0.01BNB,7777 supply,market fee0 remain fixed. No second-generation rewards or NFT ownership requirement for inviter. No automatic platform inviter: an absent invite is visibly incomplete. Forbid zero,self,collection,0xdead inviters. Binding immutable; first mint may bind atomically after explicit user confirmation, avoiding a separate binding transaction. Existing bound inviter cannot be overwritten by URL/manual input.

Batch quantity integer1–20, presets1/5/10/20, total in exact wei. One request and one principal payment per batch. One VRF fulfillment assigns all distinct IDs without external receiver/payment calls; raise callback gas limit to2000000 and test full20 worst case within this limit. Claim mints entire batch atomically. Token assignment occurs only at fulfillment, never selectable claim ordering. One claimant transaction reveals/receives whole batch; do not imply synchronous randomness or gas-free claim. Failed receivers leave claims retriable. No cancellation/reroll/refund introduced.

Referral reward accrues once on successful full batch claim. Use pull withdrawal (inviter chooses a payable recipient) so a rejecting inviter cannot block mint/claim. Treasury payment remains atomic with claim. Track invitedCount,referralMintCount,lifetime referralEarned and available referralRewards. Binding does not prove unique humans; don't promise Sybil prevention.

## Interfaces
Preserve legacy requestMint() only for already-bound accounts. New requestMint(uint256 quantity,address inviter) payable returns requestId; exact inviter must match stored referrer when already bound. bindReferrer(address inviter). referrers(address),REFERRAL_BPS()=2000,MAX_BATCH()=20. requests(id) returns payer,tokenId,claimed,quantity,referrer (first three unchanged); requestTokenIds(id) returns uint256[]. claim(id,recipient) claims all. withdrawReferralRewards(address payable recipient). Stats getters above.

Frontend uses on-chain binding as authoritative, incoming ?ref= address as a draft only, clear irreversible confirmation before first payment, copyable invite URL from connected wallet, batch quote/remaining capacity validation, chain-backed request/reveal arrays and one full-batch claim. Disabled deployment permits inspecting binding draft, quantities and transparent quotes but NEVER simulates actual ownership, rewards or payment. Keep desktop/mobile accessibility, reduced motion, clear waiting/claim stages and no casino/profit odds language. Metadata/art stay unchanged.

## Verification and hosting
Contract behavior tests for all payment arithmetic, binding, repeats,duplicates,capacity,full20 callback gas,claim retry,reentrancy,reward withdraw,and market100% seller regression. Frontend tests for invalid inviter/self/missing,immutable bound account,quantity edges,exact quotes and disabled chain. Verify live browser desktop/mobile and Vercel READY. Public assets must use https://flap-stock-butterfly-7777.vercel.app; team alias is protected. Preserve official swap production site.

Sources: https://docs.chain.link/vrf/v2-5/security and /best-practices (read2026-09-18), especially request identity, no re-roll and bounded no-external-call callback.
