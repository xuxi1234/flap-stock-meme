# Mint factory read-only research — 2026-09-11

## Conclusion

The existing mxsj.space Mint factory is **not controlled by the requested user address**. A frontend beneficiary change cannot transfer its administrator/upgrade authority. Do not present this as a user-owned factory or promise all platform revenue goes to the user. An independently deployed and reviewed factory, or an explicit ownership transfer from its actual owner, would be required to achieve that ownership condition. Exact revenue behavior remains unverified without implementation source.

## Observed chain state

BSC Chain 56 RPC: `https://bsc-dataseed.bnbchain.org`. Batched reads used `latest`; observed block-number response `0x73bb2a5` is a timestamp reference, not a pinned-block guarantee. Raw responses in `mint-rpc.json`.

| Field | Observed value |
|---|---|
| Factory | `0x42eA4D729181E9e8dE1A85eDcCfa172F87c00DE3` |
| owner() | `0x5c7aff98e20cc49362ff51f374a79354eba3c366` |
| implementation() | `0xf5e128f3bc81fed7cc4358e82d272a5caca02ffe` |
| vaultImplementation() | `0xa0a271bd9fd8efd3ffb0f157f33cbac8b882e8df` |
| deployFee() | `0` wei |
| vaultCount() | `4` |
| tradePortal() | `0xe2ce6ab80874fa9fa2aae65d277dd6b8e65c9de0` |
| vaultPortal() | `0x90497450f2a706f1951b5bdda52b4e5d16f34c06` |
| vaults(0) | `0x159066860b00d75c71004d97e6b98ff8d10a8306` |
| User requested administrator/revenue | `0x79F8b832DE72e81Ad34fd66EcbbF673613264072` |

Read-only `eth_call` of `upgradeTo(currentImplementation)` from the user address reverts with `0x5fc483c5`; the identical simulation from the returned factory owner succeeds (`0x`). This was a simulation only. **No transaction was signed or broadcast.** Raw responses in `mint-extra-rpc.json`.

Probed `feeRecipient()`, `feeReceiver()`, `treasury()`, `admin()`, `platformFeeRecipient()`, `platformFeeReceiver()` all reverted without data. These probes do not prove absence of a fee recipient, only that these getter signatures did not return one. Current deployFee=0 is not evidence of immutable zero fees or user ownership.

## ABI and frontend evidence

Source-served modules (not independently source-verified contracts):
- `https://mxsj.space/assets/flapMintConfig-B6SNcr-A.js`
- `https://mxsj.space/assets/flapMint-B2K9POgl.js`

The factory ABI includes `setVaultImplementation`, `upgradeVault`, `upgradeVaultTo`, `upgradeAllVaults`, `upgradeTo`, `upgradeToAndCall`, along with `createVault`. The latter accepts a separate `beneficiary` address, mechanism factory/data, quote token, taxes, and share target. Beneficiary is not factory owner.

The frontend creates a Mint vault by reading deployFee, preparing `createVault(params)`, and paying the returned fee. Its Portal preflight uses `commissionReceiver` = zero address, and uses `beneficiary` only in the no-tax-vault branch. The tax-vault branch passes `vaultFactory/vaultData`. This is frontend/preflight behavior; the actual Mint implementation may differ and must be verified before asserting payout routes.

Mint vault ABI supports `mint`, `refund`, `launch`, `claim`, `claimCreatorDust`, `abortMint`, `sweepNative`, `sweepQuote`, and mutable launch configuration. Access control and exact financial behavior of these methods were **not source-verified**.

## Source retrieval blockers

- Sourcify full_match and partial_match metadata endpoints returned404 for the factory proxy, factory implementation and vault implementation (implementation addresses also retried in checksum form).
- BscScan access was reported403 by parent investigator; no verified source was available locally for these particular contracts.
- Search engines yielded no relevant exact-address / FlapMintVault GitHub source.
- On-chain bytecode metadata IPFS CIDs were extracted (code persisted in `mint-code.json`):
  - Proxy: `Qmee1FDidRVKFFyuEfsY3KUWp3pj7LDcjBBRwNnAT3X1G3`
  - Factory impl: `QmRPqEHUmgxN7AyuuYm4TvhtaYS87vP7Pv1TycFKSrR5wf`
  - Vault impl: `QmY8mu6sxA3f66NMt8VfFkddcTJkKKLLQE4gXLtcYosw6B`
- Requests through `https://ipfs.io/ipfs/` and `https://flap.mypinata.cloud/ipfs/` returned403 for those CIDs. This is a retrieval failure, not proof that source does not exist.

## Delivery implications

Read-only monitoring can integrate these addresses with explicit provenance. Real transactional integration remains third-party-contract integration unless ownership changes. Do not relabel a third-party upgradable Mint factory as a butterfly-owned deployment, or replace `beneficiary` and claim all revenues have moved. A full deliverable requires implementation/source verification, parameter validation, transaction simulation, live receipts for the intended lifecycle, and owner/revenue state checks on the actual deployment.

## Existing vault example

Read-only checks of vaults(0) return creator and beneficiary both `0xef0e3689d96754d9532978671d9b5cdedd8d7cde`, factory=`0x42eA4D729181E9e8dE1A85eDcCfa172F87c00DE3`, implementation=`0xa0a271bd9fd8efd3ffb0f157f33cbac8b882e8df`, native quote, launched=true, aborted=false, target=raised=0.02BNB, token=`0x4a1da06a21621aa8a1e2df1b5489bbf5429c7777`, mktBps=10000. `owner()` reverted. These values establish a live source deployment exists; they do not establish that our frontend or user-owned deployment was tested. Raw data: `mint-vault-rpc.json`.
