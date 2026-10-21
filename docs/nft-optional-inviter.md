# Optional inviter release proposal — not deployed

The existing BSC collection `0xAdB01BC76a6d9eF707297744777E77528B6013BA` is immutable. Empty inviters cannot be enabled on that contract. This change prepares a separate collection and market, with direct-funded VRF. Do not point the optional UI at the old collection or substitute a hidden default inviter.

## Rules
- 0.01 BNB per NFT; batches 1–20; zero marketplace fee.
- Unbound wallet + empty inviter: no binding, no referral credit, 100% to the existing treasury at claim.
- Unbound wallet + valid inviter: bind once; 20% reward / 80% treasury at claim.
- Wallet already bound in that collection + empty input: retain the binding and reward. A different inviter reverts.
- A later binding never changes an earlier request's payout.
- Empty-address rewards, invitation counts and reward events are never created.

## Existing assets and release decision
The original collection, its pending requests, rewards, bindings and market remain unchanged. `nftVersion=legacy` selects a pinned copy of the old deployment. Existing NFTs do not automatically migrate. This proposal creates a separate 7,777-token collection; token numbers may match across collections and the combined count is not capped at 7,777. Existing bindings are retained in the old collection, not imported into the new collection. This consequence must be included in the deployment approval; do not present the new contract as an in-place upgrade.

## Proposed spending
Original payer: `0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA`.
Previously reported cumulative spend: 0.0315000032 BNB (reconcile with prior launch journal before execution).
New oracle funding: 0.001 BNB. One real no-inviter mint: 0.01 BNB. New gas bound: 10,000,000 gas at no more than 0.1 gwei = 0.001 BNB.
Cumulative worst-case bound: 0.0435000032 BNB. Proposed cumulative ceiling: 0.045 BNB. This is a spending ceiling, not a current gas quote. The previous 0.033 BNB authorization does not authorize this deployment.

`butterfly-optional-launch.yml` defaults to read-only. Execute only after explicit revised approval, with `APPROVE_OPTIONAL_TOTAL_0.045_BNB`. It uses a separate journal and one-time reservation marker, existing approved payer secret mapping, and the shared wallet concurrency group. Never restart after a partial send without reconciling artifacts.

The new source restores contracts/nft from the previously deployed, workflow-pinned commit c1ff830319aecc6214a26e457d7df191c02e95c7. Existing launch workflows remain pinned to their prior code.

## Release checks
1. Confirm new-collection consequence and budget approval; re-read prior spend, old holdings, pending requests and live oracle quote.
2. Run the new manual workflow. Confirm no-inviter test receives VRF, claims one NFT and pays the full mint price to treasury. Keep all receipts.
3. Independently compare deployed runtime/source and immutable settings.
4. Install generated config with optionalReferrer=true only after acceptance; default output is disabled.
5. Release both official domains and standalone page together. Verify mobile/desktop and Chinese/English, empty inviter, valid inviter, old-market link and existing assets.

Current mainnet config remains unchanged; this branch does not enable optional minting against the old contract.

Validation: 23 contract tests passed (collection, direct VRF, optional inviter); TypeScript passed; optional-inviter UI/model tests passed. No live transactions were sent for this change.
