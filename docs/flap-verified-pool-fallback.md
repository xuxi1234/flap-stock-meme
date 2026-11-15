# Verified original-pool market fallback (review branch)

Problem observed 2026-11-15: the token endpoint can return a different pool while
DEX Screener's exact Portal pool endpoint still has market data. 牛来 was one
verified example. Missing market values must not mean zero or justify selecting
another pool.

After the normal token batch lookup, only graduated Portal-verified records with
missing prices and valid nonzero token/pool addresses are queried at the fixed
BSC pair endpoint. Response chain, base token and pool must all match. Invalid,
negative USD values, nulls, unavailable pairs and transport failures stay unknown.
Existing metrics are never overwritten by fallback nulls. Bonding rows are not
queried, and no alternate pool is selected.

Fallback limits per cycle: sequential requests, 250 ms spacing, at most 30
requests, 15 second overall budget, at most 4 seconds per request, 256 KB response
limit, at most 100 returned pairs. HTTP 429 ends the cycle's fallback immediately.
Diagnostic counts record eligible/requested/filled/missing/failed/deferred and
rate limiting. Deferred rows remain unknown. Normal next-cycle collection retries
without signed transactions or persistent credentials in this helper.

No workflow, signer, production branch or deployment configuration is changed.
This branch must not be dispatched as a collector before review and authorization.
