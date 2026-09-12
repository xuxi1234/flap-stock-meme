# Butterfly vault live integration — current acceptance

The preview branch now contains actual EIP-6963 wallet connection, BSC chain checks, factory schema discovery, ABI parameter encoding, metadata upload, CREATE2 salt mining, Flap V6 simulation and wallet-signed transaction submission. Thirty non-Mint reference factories returned their schemas from BSC. The catalog routes to `/?view=vault-live` instead of the previous simulated configuration form. Sample wallet balances and snapshot transaction feeds were removed from the catalog runtime.

Project administrator and commission receiver: `0x79F8b832DE72e81Ad34fd66EcbbF673613264072`. The actual V6 calldata includes this commissionReceiver. Marketing/community/ops fields default to that address and remain visible. This is not a transfer of third-party factory ownership; immutable author charges still belong to the original factory contracts. The connected wallet is the creation caller. Flap Guardian and any factory-specific privileges still follow the actual deployed code.

## What was verified

- 30 factory schemas were read from BSC; evidence includes raw field types, ordering and precision.
- A zero-initial-buy V6 launch using the user's address and percent-buyback factory `0xfd2437DFFB8EBe9F96125b30c85Be22f99Fdddf3` passed `eth_call` and `eth_estimateGas`.
- Simulation returned predicted token `0x62706fB71796C0Bf762C4F31eaaF49E665017777`; estimate 6,319,796 gas at observed 0.05 gwei. Application margin (125% gas, 120% gas price plus 1 wei) yields max 0.000473984707899745 BNB at that observation.
- No mainnet transaction was signed or sent; the predicted token is NOT a deployed token. Metadata CID in this read-only simulation was a reference asset, not a new metadata upload.
- Strict encoding and wallet rejection, stale identity/reviews, fee caps, pending transaction deduplication and reverted receipts are tested.
- Local journal tracks this browser's transactions, with a cumulative 0.1 BNB cap per account; it is not a cross-device or on-chain spending policy. Pending hashes are stored before receipt polling; timeouts never cause automatic rebroadcast.

## Current limits

- The independent Mint factory is not deployed. Reference factory `0x42eA4D729181E9e8dE1A85eDcCfa172F87c00DE3` is owned by `0x5c7aff98e20cc49362ff51f374a79354eba3c366` and can upgrade vault implementations. User address cannot exercise its upgrade permission. Verified implementation source was not obtained; do not route new fundraises through it as a user-owned factory. Evidence is in `vault-live-evidence/mint-research.md`.
- Launches currently use zero initial purchase. ERC-20 bottom assets are still selected in the form and validated by the actual factory/Portal simulation. The existing stock directory is a discovery list, not proof every asset is accepted by every factory.
- Contract management follows `vaultUISchema`. Unrecognized field types, unsupported approval types and array-input approval flows are rejected explicitly. Payable BNB deposit methods are not exposed by this generic nonpayable method adapter.
- No full end-to-end mainnet receipt has been obtained. Wallet submission requires the user to review and sign the concrete transaction. Metadata upload is implemented but not accepted as verified: a deployed endpoint upload probe was interrupted when network approval was cancelled. No successful upload result was obtained. An existing valid Flap metadata CID can be supplied explicitly.
- Source factories' contract code has not received a new security audit. Schema retrieval or simulation is not an audit and not proof that all mechanisms will function after launch.

## Sources

- https://github.com/flap-sh/FlapVaultExample/blob/main/src/flap/IVaultPortal.sol
- https://github.com/flap-sh/FlapVaultExample/blob/main/src/flap/IVaultSchemasV1.sol
- https://github.com/flap-sh/flap-skills/tree/main/launch-bnb-token-on-flap/references
- https://mxsj.space/ (reference directory and factory addresses; third-party source)

Production, presale and existing swap funds were not modified. This supersedes the earlier frontend-only preview documentation only for functionality actually implemented above.

## Deployed UI acceptance (2026-09-12)

- Desktop live page loaded all 30 template choices and read percent-buyback schema through the deployed RPC endpoint.
- Existing reference vault `0xD623Dfe99c58172ff39b78549BdC5B721F7F75A7` loaded its canonical management methods. Calling `vaultConfigView` returned `[9900,100,1000,30,1]` from BSC, not a fixture. This vault belongs to a reference token, not to the user.
- A browser without a wallet extension displays the installation/DApp-browser instructions; no fake wallet fallback exists.
- Catalog navigation reached the real management route. Obsolete preview counters and snapshot headings were removed in the follow-up.
- Mobile verification uses the authored 390 × 844 iframe fixture at `/vault-layout-check.html`. See the final QA record for the observed result after deployment.

Mobile QA found the host site’s global mobile `nav` styles creating an absolute menu over the title. The live vault explicitly resets position, inset, margin, padding, border, shadow and background within `.vl-header nav`. A 390px fixture checks the correction.
