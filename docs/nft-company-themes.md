# Company-inspired butterfly collection

Approved scope: add company themes to the existing NFT collection and publish the independent Vercel site. No contract, funds, mint economics or official Swap changes.

- Frozen snapshot: `data/nft-companies.json`, retrieved 2026-09-18 from https://stockanalysis.com/list/biggest-companies/.
- Source covers US exchange-listed issuers, including foreign companies. It is not the S&P 500 or Fortune Global 500. Ranking and listing information are provider-reported, not independently audited. Identical issuer names are merged; first symbol retained. Source rows 1–503 yield 500 unique company names after three documented merges.
- IDs 1–7500: company index `(id-1) % 500`, edition `floor((id-1)/500)+1`. Each company has exactly 15 distinct nature artworks. IDs 7501–7777 are 277 Butterfly originals. Ranking does not set price or rarity.
- Company names and symbols appear in NFT names, JSON attributes, website cards and details; the existing original nature JPEGs stay free of third-party logos. Company themes do not confer equity, dividends, affiliation or endorsement.
- Current nature JPEG/SVG art remains unchanged. Company metadata and catalog are versioned by snapshot; do not reuse the old collection metadata validation as evidence for this release. No live mainnet tokens have been issued by this deployment.
- CSV/JSON downloads expose the full 500-company list. Search supports English names, available Chinese aliases, ticker, family and token ID. Series filter separates company and original editions, intersecting wallet/listing and family filters.
- Mainnet remains disabled pending its separate launch gate. Referral binding, 20% single-generation mint reward, batch quantity 1–20, mint price 0.01 BNB and zero secondary-market fee are unchanged.

Verification: `node scripts/verify-company-themes.mjs`, `npx vitest run src/nft`, `npx tsc --noEmit`. Deployment build runs full 7,777-image integrity and metadata verification before Vite publication.
