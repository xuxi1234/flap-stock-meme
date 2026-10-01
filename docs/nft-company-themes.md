# Company-inspired butterfly collection

Approved scope: add company themes to the existing NFT collection and publish the independent Vercel site. No contract, funds, mint economics or official Swap changes.

- Frozen snapshot: `data/nft-companies.json`, retrieved 2026-09-18 from https://stockanalysis.com/list/biggest-companies/.
- Source covers US exchange-listed issuers, including foreign companies. It is not the S&P 500 or Fortune Global 500. Ranking and listing information are provider-reported, not independently audited. Identical issuer names are merged; first symbol retained. Source rows 1–503 yield 500 unique company names after three documented merges.
- Mapping `lucky-277-v1` supersedes the original contiguous allocation: the 277 fixed special IDs in `/nft/special-ids.json` are Butterfly Originals. All user-requested IDs are included after deduplication. Remaining candidates are ordered by repeated digits, sequences, palindromes and round numbers using a fixed score and ascending-ID tie break. The other 7,500 IDs are sorted ascending; their zero-based ordinal maps to company `ordinal % 500`, edition `floor(ordinal / 500)+1`. Every company still has exactly 15 artworks. This mapping does not alter draw probabilities.
- Company names and symbols appear in NFT names, JSON attributes, website cards and details; the existing original nature JPEGs stay free of third-party logos. Company themes do not confer equity, dividends, affiliation or endorsement.
- Current nature JPEG/SVG art remains unchanged. Company metadata and catalog are versioned by snapshot; do not reuse the old collection metadata validation as evidence for this release. No live mainnet tokens have been issued by this deployment.
- CSV/JSON downloads expose the full 500-company list. Search supports English names, available Chinese aliases, ticker, family and token ID. Series filter separates company and original editions, intersecting wallet/listing and family filters.
- Mainnet remains disabled pending its separate launch gate. Referral binding, 20% single-generation mint reward, batch quantity 1–20, mint price 0.01 BNB and zero secondary-market fee are unchanged.

Verification: `node scripts/verify-company-themes.mjs`, `npx vitest run src/nft`, `npx tsc --noEmit`. Deployment build runs full 7,777-image integrity and metadata verification before Vite publication.

## Published verification

- Public site: https://flap-stock-butterfly-7777.vercel.app/
- Final deployment: `dpl_AXZ11qLetRuqYST95ZZ5fseVcxzh`, READY; public alias assigned without error. Runtime source commit: `3b98f41be2efe04d83892efbcdc649cbbf4a2e95`.
- Final build passed all 7,777 unique art/JPEG, ID and metadata checks. Artwork hashes are unchanged; company names/traits are new metadata.
- Browser found and fixed stale cached catalogs: catalog requests now include a snapshot version and `cache: no-cache`; asset responses revalidate. Returning visitor search then displayed all 15 NVDA editions.
- Live filters: 7,500 company editions, 277 originals; NVDA and AAPL searches each show 15. Mobile frames at 390/320 outer pixels had equal document scroll/client widths (375/305 after scrollbar), and the narrow gallery was visually checked.
- Public company JSON contains 500 companies; CSV has 501 lines including its header. Sample metadata IDs 1 and 7777 expose the expected company/original themes.
- No mainnet transaction was performed; paid minting remains disabled.

## Special IDs and bilingual experience

The UI supports persisted Chinese/English switching, including company titles, family names, forms and dialogs. Metadata exposes both names under `properties.localization`; original artwork remains unchanged. The free-reveal dialog uses browser randomness without replacement within a batch of 1–20. It never connects a wallet, pays, reserves chain supply, changes holdings, or creates a marketplace listing. Experience results are explicitly not on-chain NFTs. Paid minting remains disabled.

### 2026-09-18 special-number release checks

- Runtime source: `bc202b0d7fd6f70e927d00b9ce57a33804300fc0` (includes narrow-dialog correction).
- Special allocation verifier passed: 277 distinct originals, all requested IDs included, 500 company themes with exactly 15 editions each.
- TypeScript and all 35 NFT tests passed, including language/filter preservation and free draws without replacement.
- Initial release `dpl_JAujxUeuSKwLE6p2T3PQ3JxLX7aL` reached READY. Production build passed all 7,777 artwork/JPEG/ID/metadata checks.
- Public `special-ids.json` returned 200 with 277 IDs; metadata 1 and 7777 returned original themes and both Chinese/English localized names.
- Live Chinese and English free draws each produced five distinct results with no wallet or chain interaction. Chinese/English switching updates navigation, card names, filters and dialogs.
- Mobile QA found preset overflow in the English 320px dialog; preset columns now use zero-minimum grid tracks, result figures shrink, and narrow result cards use one column.
- Final deployment `dpl_J2oUr8X9gn4UaN3YkhXfGQw55oHw` reached READY with the public alias. Final 320px English free-reveal dialog has equal client/scroll widths (254px), and all five result images loaded at 208px width. Screenshot confirmed presets and artwork fit without horizontal scrolling.
