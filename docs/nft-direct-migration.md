# Butterfly stock NFT: direct-funded VRF migration (2026-10-20)

Status: prepared; NOT deployed or opened. Existing approved total remains 0.021 BNB. New paid execution requires explicit approval of TOTAL 0.033 BNB.

The replacement uses the same official BSC direct-funding wrapper as the deployed Butterfly Sheep project: 0x471506e6ADED0b9811D05B8cAc8Db25eE839Ac94. The adapter funds each request separately. Its 100,000-gas callback only stores a seed. Permissionless finalize processes the earliest ready request, one batch at a time, preventing claim-order selection. The original collection and zero-fee market source/economics remain unchanged. There is no administrator seed override, reroll, fee withdrawal, or mutable oracle.

Preserved terms: 7,777 NFTs, 0.01 BNB each, 1–20 per request, mandatory permanent single inviter, 20% pull credit on completed claim, 80% treasury. Mint funds remain in the collection until claim; oracle funds reside separately in the adapter. Requests still have no cancellation/refund mechanism. A stalled earliest oracle request blocks FIFO allocation; do not open public mint until authentic fulfillment is confirmed. Initial oracle deposit is not guaranteed to cover all supply.

## Old deployment — never reset journals or repeat this mint
- Collection: 0x4c751e8b555F1C72cf572789CcFF05e0e118Fc8f
- Adapter: 0x0843825446108b5d7F3C7e6f01676e66208e1f31
- Market: 0x24c088F5Fc0c266e9ec2D954B779673628713f09
- Original subscription: 7752766845231422688186724392588981744567870866350784400960866134053864325923
- Pending request: 103802155601717079762219619182970600567020980371426818064906224458216881034266
- Paid request tx: 0x34ac5727cb5e74f85f64493322c01274a6fb14542c255294be75a9fbaff94bbb
- Confirmed block: 128678823
- Recovery run: 39364782136; artifact 12238683059.
- First-mint run: 39367452546; artifact 12240228444; timed out awaiting VRF after successful payment.
- Actual cumulative wallet outflow: 0.0202349867 BNB, including 0.01 BNB in the old subscription and 0.01 BNB locked in the old collection. No refund has happened. No old treasury/referral payout has happened while claim remains incomplete.

The 0.704 BNB figure previously discussed is a conservative subscription formula estimate, NOT a confirmed quote or an authorized top-up. No top-up is requested by this migration. Old immutable contracts cannot be switched to the wrapper. Replacement does not recover old funds. Retain old subscription and pending request while investigating; do not cancel the subscription to force a refund because it may prevent fulfillment.

## Prepared budget and execution
- Prior outflow: 0.0202349867 BNB.
- New adapter oracle reserve: 0.001 BNB.
- New collection paid verification mint: 0.01 BNB, owned by original payer.
- All new gas bounded by 10,000,000 units at <=0.1 gwei: <=0.001 BNB.
- Combined upper bound: 0.0322349867 BNB. Proposed total cap: 0.033 BNB.
- Payer: 0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA.
- Previously selected inviter: 0xCe1e5D01DF016630F732c798d983FA0db86b38A8.

`contracts/nft/scripts/launch-direct.mjs` is read-only by default. Paid execution additionally requires `DIRECT_APPROVAL=APPROVE_TOTAL_0.033_BNB`, a one-time branch reservation, original signer, idle wallet nonce and cumulative cap. No subscription creation/funding/cancellation exists in this script. Preserve `direct-output` artifacts on any failure; do not rerun a paid run. Recover hashes and reconcile first.

Output remains disabled. Before public release independently verify deployed creation/runtime bytecode, actual callback/finalize/claim, ownership/referral, current oracle balance/quote, and image hosting. Publish only the independent NFT Vercel project, never shared swap production.
