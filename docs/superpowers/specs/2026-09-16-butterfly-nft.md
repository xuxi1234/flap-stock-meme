# Butterfly 7777 — independent preview

User-approved scope: an original butterfly NFT collection and marketplace preview on Vercel, without changing app.gupiao.sh or sending mainnet transactions.

- Exactly 7777 unique, deterministic, original butterfly illustrations and ERC721 metadata; IDs 1–7777. Uniqueness must come from artwork, not the printed edition number.
- Mint price 0.01 BNB; treasury 0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF.
- Random allocation without replacement. Production contract uses externally verifiable randomness, reserves supply for pending requests, and prevents rerolls/duplicate allocation.
- Marketplace fixed-price listings, cancellation, purchase; NFT to buyer, 93% to seller, 7% to treasury. Fee applies to this marketplace's sales.
- Preview explicitly simulates ownership and payments locally. No wallet signing or real BNB transfer until contracts, randomness service, immutable asset hosting and independent security review are ready.
- Black/lime collectible card aesthetic inspired by publicly viewed Flap references; all butterfly artwork original. Desktop and mobile supported.
- Collection gallery, traits and rarity, reveal flow, collection management, listing, purchase confirmation, transaction history and asset downloads.
- Deliver Vercel preview link, tested source and honest deployment status. Production website unchanged.

Sources: https://x.com/flapdotsh/status/2098283071598669869 ; https://x.com/Oxdirss/status/2098283963458764985 ; https://github.com/HashLips/hashlips_art_engine (MIT, generative layer/DNA design inspiration, no copied artwork); https://docs.openzeppelin.com/contracts/5.x/erc721 ; https://docs.chain.link/vrf/v2-5/supported-networks .
