# Mint campaign acceptance checkpoint

User-signed creation: 0x01a55b25cb4904f734b0f02f26c4d1e4a1ea716914d91db1096d32a2eca6111c, successful in block 121376728. Campaign 0xC7c1BcD4F0d25e04Ca3CA58139284B7E075B5eb1, created by 0x79F8b832DE72e81Ad34fd66EcbbF673613264072 via the verified Butterfly Mint factory. Actual gas fee 0.000028476960474616 BNB; transaction value zero.

Decoded creation input matches the live config. Factory membership, EIP-1167 implementation bytes, creator and commission receiver were verified. Snapshot: 0 of 2 shares, no token launched, no abort, campaign BNB balance zero. Deadline is September 19, 2026 at 10:49:15 Beijing time. This is a separate acceptance project, not the original presale.

Next authorized handoff: user reviews and signs one share (0.01 BNB plus gas). An eth_call and estimateGas on the deployed campaign passed. No subscription was sent by the agent. After its receipt, verify the user's share and prepare their full refund before completing the remaining funding/launch/claim checks. Do not duplicate completed factory or campaign creation.

Preview now selects the confirmed campaign by default and refreshes share data after wallet changes. Creation of other projects is a separate explicit action. 27 vault tests and the production build passed. All changes remain on the preview branch.

## Contribution confirmed; refund handoff

User transaction 0x7c2570e4ff063dc1c90f0d9524f0b2523b0c3b96317a9a39559abffb91ac06dd succeeded in block 121379903. Decoded call mint(1), value 0.01 BNB, matching Minted event for the requested user. Actual gas fee 0.000004676160077936 BNB. Fresh snapshot: campaign balance 0.01 BNB, total shares 1, user shares 1, launched false.

Read-only refund simulation from the user's wallet to their own address succeeded; transfer value zero, refund principal 0.01 BNB. Estimated gas 54,386 before UI padding. No refund has been submitted by the agent. Use the existing preview's “检查退回全部份额” button after connecting the same wallet. Verify the user-signed refund receipt and both balances/credits before preparing the next funding step.

## Refund confirmed; full funding handoff

User transaction 0x6e882e7a2609a4fec102948dcfbd08247355603fda66a0a9f11091d7cceaca5d succeeded in block 121380372. The decoded refund call and Refunded event match the participant and receiver 0x79F8b832DE72e81Ad34fd66EcbbF673613264072, one share, and 0.01 BNB returned. Gas cost was 0.000002479320041322 BNB. Latest reads confirm user shares zero, total shares zero, campaign balance zero, and no launch or abort. Public RPC historical wallet balance reads failed with missing trie node; historical wallet balance delta was not independently measured. Receipt, matching event, send-before-event contract logic, and cleared campaign state establish the refund checkpoint.

Next handoff is mint(2), 0.02 BNB plus wallet-displayed gas. Read-only eth_call succeeded and estimated gas was 84,354 before UI padding. No funding transaction was broadcast. The preview query mintShares=2 prefills two shares, with no automatic preparation or wallet request. User must connect the same wallet, inspect the funding transaction, and sign. Launch remains a separate transaction after funding confirmation, followed by claim verification. Commission receiver remains the specified wallet; actual revenue payout has not been validated.

28 vault tests passed, including the explicit two-share prefill and no-auto-prepare check. The build command exited successfully. Production remains unchanged; only the preview branch is updated.
