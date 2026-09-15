# Fixed 9,992-address airdrop

The user selected the delivered holders17-deduplicated-9992.txt list. It contains each of 17 tokens' top 600 holders at BSC block 122011886 (2026-09-15 10:15:02 UTC), merged in source order and deduplicated case-insensitively: 10,200 ranked rows become 9,992 addresses. VIRUS (0xa1ed61902f13e162305f59e1b2475e269e647777) is not included. This does not claim completion of the original 18-token collection.

The exact delivered list is pinned in scripts/mint-acceptance/data/holders18-recipients.txt, SHA256 50addc10eb955343f01f0d054d750bf570f42b6e6796766c368f402d592cbce2. The adjacent manifest records scope and evidence hashes. Its complete field refers to the selected 17-token scope; originalCollectionComplete remains false. Original top-600 evidence is retained under data/holders18/ on branch automation/holders18-34957676109.

Only duplicates were removed. Contract, pool and standard dead addresses remain included. The runner preserves the exact delivered list. Zero address, the sending wallet and distributor are not present.

Sender: 0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA.
Token: 0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777.
Amount: 1 token each, 9,992 total; 49 batches of 200, final batch of 192.

The manual workflow defaults to a read-only check. Select 执行或继续持仓名单, check the confirmation, then start on main to execute. One start queues the whole campaign. Each batch waits at least 1,800 seconds after the preceding confirmed batch; GitHub queueing and RPC checks can extend this interval. The earliest final batch is 24.5 hours after the first. Cancel the workflow to stop remaining jobs; resume the same workflow to continue using its recorded progress.

The 0.2 BNB cumulative spending cap preserves the previously confirmed accounting, including historical gas and charged spending. It does not reset on resume. Last verified historical charged spend was 0.099777690609141262 BNB. The specific owned-wallet return principal is separately reported, while its gas is included. Every preflight recalculates historical receipts.

The previous 71 completed old batches remain pinned and are revalidated. The old campaign's final batch is not resumed. New campaign IDs and automation/airdrop-holders18-ledger are separate. Transaction hashes are durably saved before broadcast; recovery checks nonce, calldata, receipt, exact per-address amount and onchain completion mapping before any further send. Restarting cannot resend completed batches.

Paid Alchemy BSC RPC is used with an independent node for verification. Signing keys are available only to the explicit execution step. Collection and read-only checks cannot sign or broadcast.
