# Butterfly vault preview

The existing homepage now links to 金库 between swap and presale. `/?view=vault` opens an isolated same-origin document so the reference black/gold CSS cannot change the existing homepage or swap styles.

Implementation lives under `public/vault`: editable HTML, CSS, JavaScript and the 31-template reference directory. The source layout, assets and template descriptions were inspected at https://mxsj.space/ on 2026-09-11. Source credit remains visible in the footer. The source's executable wallet/contract scripts are not used.

This branch is PREVIEW ONLY. Do not promote or merge as a live financial product. Buttons demonstrate configuration, validation and review; no provider connection, approval, signature or transaction submission exists in the vault document. Reference factory addresses are informational and unverified. Financial previews must not be described as deployed vaults. Optional monitor/shop views are sample browsing views; they are not replicas of the source backend.

All template images and fonts load locally. Four unavailable proxy images were recovered from their actual fallback image views, then cropped to their visible image bounds and stored as WebP. Template parameters are human-readable configuration drafts, not ABI encodings.

Validation evidence and accepted branding/preview changes: `design-qa.md` and `docs/vault-preview-qa/`.

## Owner and platform revenue instruction

The user specified `0x79F8b832DE72e81Ad34fd66EcbbF673613264072` for both the project's vault administrator and platform revenue recipient. The shared public configuration is `public/vault/project-config.json`; configuration review and draft exports use it. The execution budget ceiling is 0.1 BNB, not an automatic payment or a deployment cost estimate. No private key belongs in the repository.

This instruction applies to revenue payable to the Butterfly platform. It does not redirect depositor principal, holder dividends, redemption proceeds, or third-party protocol fees. Do not replace arbitrary wallet fields in reference templates: their roles must first be verified against contract source and ABI. A reference factory with a fixed third-party beneficiary cannot be made to pay this address by changing frontend configuration. Such templates need a compatible deployment or must remain unavailable for that operation.

`onchainConfigured: false` explicitly records that no vault ownership or revenue routing has been changed on chain. Real deployment must map these addresses into the verified constructor/factory arguments, then read back the deployed administrator and revenue recipient and record successful transaction receipts. The existing presale and production website are outside this address change.
