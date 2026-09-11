# Butterfly vault preview

The existing homepage now links to 金库 between swap and presale. `/?view=vault` opens an isolated same-origin document so the reference black/gold CSS cannot change the existing homepage or swap styles.

Implementation lives under `public/vault`: editable HTML, CSS, JavaScript and the 31-template reference directory. The source layout, assets and template descriptions were inspected at https://mxsj.space/ on 2026-09-11. Source credit remains visible in the footer. The source's executable wallet/contract scripts are not used.

This branch is PREVIEW ONLY. Do not promote or merge as a live financial product. Buttons demonstrate configuration, validation and review; no provider connection, approval, signature or transaction submission exists in the vault document. Reference factory addresses are informational and unverified. Financial previews must not be described as deployed vaults. Optional monitor/shop views are sample browsing views; they are not replicas of the source backend.

All template images and fonts load locally. Four unavailable proxy images were recovered from their actual fallback image views, then cropped to their visible image bounds and stored as WebP. Template parameters are human-readable configuration drafts, not ABI encodings.

Validation evidence and accepted branding/preview changes: `design-qa.md` and `docs/vault-preview-qa/`.
