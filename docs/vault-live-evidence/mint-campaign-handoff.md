# Mint campaign acceptance checkpoint

User-signed creation: 0x01a55b25cb4904f734b0f02f26c4d1e4a1ea716914d91db1096d32a2eca6111c, successful in block 121376728. Campaign 0xC7c1BcD4F0d25e04Ca3CA58139284B7E075B5eb1, created by 0x79F8b832DE72e81Ad34fd66EcbbF673613264072 via the verified Butterfly Mint factory. Actual gas fee 0.000028476960474616 BNB; transaction value zero.

Decoded creation input matches the live config. Factory membership, EIP-1167 implementation bytes, creator and commission receiver were verified. Snapshot: 0 of 2 shares, no token launched, no abort, campaign BNB balance zero. Deadline is September 19, 2026 at 10:49:15 Beijing time. This is a separate acceptance project, not the original presale.

Next authorized handoff: user reviews and signs one share (0.01 BNB plus gas). An eth_call and estimateGas on the deployed campaign passed. No subscription was sent by the agent. After its receipt, verify the user's share and prepare their full refund before completing the remaining funding/launch/claim checks. Do not duplicate completed factory or campaign creation.

Preview now selects the confirmed campaign by default and refreshes share data after wallet changes. Creation of other projects is a separate explicit action. 27 vault tests and the production build passed. All changes remain on the preview branch.
