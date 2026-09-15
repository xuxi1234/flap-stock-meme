# 18-token holder snapshot and next airdrop

The collection workflow is read-only. It discovers candidate holders from every Transfer log from deployment through BSC block 122011886. It queries every candidate's balance at that block, requires their sum to equal totalSupply, then ranks each token's first 600 nonzero holders (balance descending, address as tie breaker).

Filtering happens after ranking; ranks 601+ never backfill exclusions. Zero, the standard dead address, the sending wallet, source token contracts and all addresses with deployed code at the snapshot are excluded. This includes deployed pools and contracts, but is not a claim about each wallet owner's identity. Eligible addresses are merged case-insensitively, sorted, and accompanied by per-token rank/balance provenance and excluded rows.

Collection outputs are stored under data/holders18 on the run's automation/holders18-RUN_ID branch. Each token has independent artifacts containing all candidate balances. The final job requires all 18 token results and validates nonoverlapping full log ranges and the common block hash. Incomplete data never produces a final recipient file.

Before enabling the airdrop, copy the complete status.json to scripts/mint-acceptance/data/holders18-manifest.json and recipients.txt to holders18-recipients.txt in that directory. Review and commit both together. The manifest's recipientSha256 binds the bytes of the fixed recipient file; modifying the list creates a different namespace and is rejected by an existing campaign checkpoint.

The manual airdrop workflow defaults to a readonly check. An explicit user-selected execution starts/continues the same fixed campaign: 1 token per recipient, 200 recipients per batch, at least 1800 seconds from the prior confirmed batch block. GitHub queueing and RPC checks can make the interval longer. The final batch may contain fewer than 200 addresses.

The 0.2 BNB lifetime cap includes the original full transaction history and every later campaign, including reverted transaction gas. The previously verified owned-wallet transfer principal remains separately reported; its gas is still included. Current historical charged spend is 0.099777690609141262 BNB. The prior 71/72 completed batches are pinned and revalidated; this workflow never completes the remaining old batch.

Every transaction hash must be durably acknowledged in automation/airdrop-holders18-ledger before broadcast. Recovery checks the saved transaction, nonce, receipt, per-recipient received amount and onchain completion mapping before proceeding. A lost RPC response does not create a second transfer. Collection and readonly validation have no wallet signing key.
