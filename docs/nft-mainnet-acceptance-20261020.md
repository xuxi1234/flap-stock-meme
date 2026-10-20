# NFT mainnet acceptance — 2026-10-20

Workflow: https://github.com/xuxi1234/flap-stock-meme/actions/runs/39392610013

Approved cumulative cap: 0.033 BNB. Actual cumulative wallet outflow including the previous attempt: 0.0315000032 BNB.

- Collection: `0xAdB01BC76a6d9eF707297744777E77528B6013BA`
- Zero-fee market: `0xBe65bC99d6E42050A3B560960Eda36543Bc29AF3`
- Direct VRF adapter: `0x786a110c5228EaAfDcbBB988e508058C19b1e43F`
- Test NFT: #2032, owned by the original payer `0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA`.
- Mint: `0x406293966a649a6f12e9a096d39317c9e64c232e7842438c2501fe24ad065ae0`
- Claim: `0xbbf0b2abc69ac119684324955850d7adb56d50fed141f9e4076764ea284a60e0`

Independent public RPC verification matched all eight transaction receipts and compiled runtime bytecode (immutable locations excluded, immutable values separately read). Verified price 0.01 BNB, supply 7777, batch cap 20, referral 20%, treasury address, market fee 0, adapter binding, wrapper address, callback gas 100000, confirmations 10, fee cap 0.0001 BNB, NFT ownership and token URI. Workflow checked metadata/image availability and referral credit.

Oracle funded with 0.001 BNB; first request cost 0.0000166648 BNB. Remaining 0.0009833352 BNB is finite and does not fund the full collection. Frontend checks balance and quoted fee before minting; additional funding needs separate authorization.

The earlier collection's 0.01 BNB mint deposit remains pending and was not refunded. The previous VRF subscription funds were not moved. Preserve old journal and request ID; never repeat that mint to recover it.

Production frontend source: 6a0550c37ab29740dba53d3b314e318e4eaf4717. Independent NFT Vercel project only; shared swap/main website is not replaced.
