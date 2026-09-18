# Butterfly NFT collection and marketplace upgrade

Scope: improve the existing independent NFT site and deploy it to the existing Vercel project. Existing 7,777 artworks, 277 special IDs, company allocation, contract code, mint economics and launch gates are unchanged.

## User-facing changes

- Dedicated exchange landing with on-chain listing count, floor ask, distinct sellers and zero platform fee. Unavailable metrics render as dashes; no demo listings or fabricated sales statistics.
- Wishlist saved to the current browser with explicit distinction from wallet ownership; filters combine wishlist, collection theme, butterfly family and exact numeric ID search.
- Grid/list layouts, ascending/descending IDs, active-listing price range and exact wei price ordering. Invalid/reversed ranges display errors. Inactive listings never enter price-filtered results or statistics.
- Original editions shelf links to #1, #520, #1314 and #7777. Rules are expandable to keep browsing focused on the artwork.
- Artwork details link to the actual listing when one exists, show seller and exact price, and offer the correct buy/cancel/list action. Buyer confirmation separates seller proceeds, platform fee and network gas.
- Shareable artwork and marketplace URLs; language is included when sharing artwork. New copy, controls and accessible labels support Chinese/English.
- Responsive market cards, filter controls and list layout; controls sized for touch and animations disabled for reduced-motion preferences.

## Sources reviewed

- OpenSea metadata standards: https://docs.opensea.io/docs/metadata-standards — retain standard ERC-721 JSON media/traits links.
- Seaport source: https://github.com/ProjectOpenSea/seaport — reviewed the public protocol overview; no protocol replacement or copied source.
- W3C target sizes: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — touch targets and spacing reviewed; this is not a full accessibility certification.

## Verification

TypeScript check and the full NFT test suite cover existing payment gates plus exact price sorting/ranges, inactive orders, wishlist persistence, language preservation, deep-linked marketplace state and buyer confirmation arguments. The Vercel build regenerates and verifies all 7,777 image/metadata assets.

Paid minting and on-chain market activation remain disabled in deployment.json. This release does not spend BNB or deploy contracts. Free reveal remains an explicitly labeled browser experience.

## Release checks

- Functional source commit: `a0aa52de34f7acb83067377db1d518889a1efc2b`; mobile contrast/filter correction: `8ab3891cc5d575610409f7ff080f19352191c493`.
- TypeScript and 41 NFT tests passed, including an exact 0.157770000000000001 BNB purchase confirmation with its seller and listing version preserved.
- Initial deployment `dpl_GiuF8VTEMZnknixXM7WGsucCRivR` reached READY and served the public alias. Browser verified the direct market URL, unavailable metrics, English reversed-price warning, exact #1 search, wishlist filtering and language preservation.
- Browser checks at 390px and 320px confirmed equal scroll/client widths (375px/305px after scrollbar). Visual review caught cramped narrow-screen sorting and insufficient contrast in the rules summary. Corrected with a mobile filter grid and explicit dark-theme panel colors.
- Final UI-only deployment: `dpl_FjMK4m5b8zsH5gvDDyRHFRNNyc5n`. No chain configuration or transactions changed.
- Final deployment reached READY with the public alias. Final 320px English screenshot confirms readable dark rules panel, separated filter rows and a 241px × 44px sort control. Final document scroll/client widths match at both 320/390px outer viewports (305/375px after scrollbar). Restored the Chinese entry after QA.
