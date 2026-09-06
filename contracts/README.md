# FLAP presale contract operations

This directory contains the self-contained, non-upgradeable `FlapPresale` and its BSC-mainnet-only deployment script. The contract records one `0.05 BNB` participation per address, up to `10,000` participants, and forwards each successful payment to the fixed treasury. It does **not** distribute FLAP automatically and it has **no refund mechanism**.

## Binding deployment terms

| Item | Required value |
| --- | --- |
| Network | BSC mainnet, chain ID `56` |
| Participation fee | `0.05 BNB` (`50000000000000000` wei) |
| Capacity | `10,000` |
| Initial deadline | `1788969599` |
| Admin / owner | `0xbE37AB912De351B9312FA593C9f99e3279FDB0a2` |
| Treasury | `0xc46fC8D76Ad6Db1a0f88d97EbF5Aa3c405d177C2` |

`DeployFlapPresale.s.sol` rejects every chain ID other than `56`. Immediately after creation it checks that runtime code exists, all values above match, `endTime` equals `1788969599`, owner equals the admin, and `participantCount` is zero. It also checks that the deployment is unpaused.

Important: the constructor deploys **unpaused**. A successful deployment therefore opens on-chain participation immediately, even while the website is disabled. Keep `projectConfig.presale.contractAddress` set to `null` until the deployment receipt, runtime bytecode, constants, and verified source have all been independently confirmed. If operational timing requires a closed launch, the fixed admin should call `pause()` immediately after deployment and only call `unpause()` when launch is approved.

## Local and CI checks

Use an audited Foundry installation. From this directory:

```sh
forge fmt --check
forge build --sizes
forge test --gas-report -vvv
```

The repository's `Contracts` GitHub Actions workflow runs exactly those non-deploying checks on contract changes. It has no secrets, RPC endpoint, signer, script execution, or broadcast step. This is the required verification path when Foundry is unavailable locally; CI can test and compile, but cannot deploy mainnet on push.

## Secret handling

Copy the repository `.env.example` to the ignored `.env` only on the deployment workstation. Disable shell tracing before loading it:

```sh
set +x
set -a
. ../.env
set +a
```

Never store, print, paste into logs, or commit a private key or credentialed RPC URL. Import the deployment signer into Foundry's encrypted keystore and set `DEPLOYER_ACCOUNT` to that account name; do not create a `PRIVATE_KEY` environment variable. `DEPLOYER_ADDRESS` must be reviewed against the keystore account. Set `ADMIN_ACCOUNT` to the encrypted-keystore name for the fixed admin only on an authorized admin workstation. The admin address is fixed in bytecode and does not become the deployer automatically.

## Preflight and gas cap

1. Confirm the endpoint reports BSC mainnet. The first command must print `56`; stop if it does not.

   ```sh
   cast chain-id --rpc-url bsc
   ```

2. Re-run all local checks, then simulate the exact deployment without `--broadcast`. This executes `run()`, including the chain gate and post-deployment assertions, but sends no transaction.

   ```sh
   forge script script/DeployFlapPresale.s.sol:DeployFlapPresale \
     --rpc-url bsc \
     --sender "$DEPLOYER_ADDRESS" \
     -vvvv
   ```

3. Record the simulation's gas estimate. Separately review the current network gas price:

   ```sh
   cast gas-price --rpc-url bsc
   ```

   Set `MAX_GAS_PRICE_WEI` and `DEPLOY_GAS_ESTIMATE_MULTIPLIER` to explicitly approved upper bounds. The multiplier is a percentage applied to Forge's transaction gas estimate (for example, `120` means 120%). Calculate and approve the maximum deployment cost as `simulation gas estimate × DEPLOY_GAS_ESTIMATE_MULTIPLIER / 100 × MAX_GAS_PRICE_WEI`, plus a documented margin for any admin action. Stop if the live gas price exceeds the cap or if the simulation changes after review.

## Manual broadcast

There is intentionally no CI or push-triggered deployment. A human operator may broadcast only after the simulation, bytecode, signer, balance, gas estimate, and gas-price cap receive the required approvals. The encrypted keystore prompts for its password interactively.

```sh
forge script script/DeployFlapPresale.s.sol:DeployFlapPresale \
  --rpc-url bsc \
  --account "$DEPLOYER_ACCOUNT" \
  --sender "$DEPLOYER_ADDRESS" \
  --with-gas-price "$MAX_GAS_PRICE_WEI" \
  --gas-estimate-multiplier "$DEPLOY_GAS_ESTIMATE_MULTIPLIER" \
  --broadcast \
  --slow \
  -vvvv
```

Do not add `--broadcast` to aliases, package scripts, CI, or automated hooks. Preserve `broadcast/DeployFlapPresale.s.sol/56/run-latest.json` as the deployment record and obtain the transaction hash, block number, and contract address from the successful receipt. A failed or reverted receipt is not a deployment.

## Receipt, bytecode, state, and source verification

Set `PRESALE_ADDRESS` and `DEPLOY_BLOCK` locally from the confirmed receipt. First require a successful receipt and non-empty runtime bytecode:

```sh
cast receipt --rpc-url bsc <DEPLOYMENT_TX_HASH>
cast code --rpc-url bsc "$PRESALE_ADDRESS"
```

Compile with the committed Foundry settings and compare the on-chain runtime bytecode hash to the local deployed bytecode hash. Both commands must produce the same hash:

```sh
forge inspect FlapPresale deployedBytecode | cast keccak
cast code --rpc-url bsc "$PRESALE_ADDRESS" | cast keccak
```

Read every deployment invariant directly from BSC mainnet:

```sh
cast call --rpc-url bsc "$PRESALE_ADDRESS" "PARTICIPATION_FEE()(uint256)"
cast call --rpc-url bsc "$PRESALE_ADDRESS" "MAX_PARTICIPANTS()(uint256)"
cast call --rpc-url bsc "$PRESALE_ADDRESS" "INITIAL_END_TIME()(uint64)"
cast call --rpc-url bsc "$PRESALE_ADDRESS" "endTime()(uint64)"
cast call --rpc-url bsc "$PRESALE_ADDRESS" "ADMIN()(address)"
cast call --rpc-url bsc "$PRESALE_ADDRESS" "owner()(address)"
cast call --rpc-url bsc "$PRESALE_ADDRESS" "TREASURY()(address)"
cast call --rpc-url bsc "$PRESALE_ADDRESS" "participantCount()(uint256)"
cast call --rpc-url bsc "$PRESALE_ADDRESS" "paused()(bool)"
```

The results must be, in order: `50000000000000000`, `10000`, `1788969599`, `1788969599`, `0xbE37AB912De351B9312FA593C9f99e3279FDB0a2`, that same admin/owner address, `0xc46fC8D76Ad6Db1a0f88d97EbF5Aa3c405d177C2`, `0`, and `false`.

Verify the exact committed source after deployment. Foundry reads `ETHERSCAN_API_KEY` from the local environment:

```sh
forge verify-contract \
  --chain-id 56 \
  --compiler-version 0.8.24 \
  --num-of-optimizations 200 \
  --evm-version paris \
  --watch \
  "$PRESALE_ADDRESS" \
  src/FlapPresale.sol:FlapPresale
```

Keep the website disabled if any receipt, bytecode, state, or source-verification check is missing or mismatched. Enabling the address is a separate reviewed frontend change after all checks pass.

## Admin actions

Only `0xbE37AB912De351B9312FA593C9f99e3279FDB0a2` can perform these actions. Each action must be simulated, approved, broadcast manually from that address's encrypted keystore, and confirmed by receipt and a follow-up state read.

```sh
cast send --rpc-url bsc --account "$ADMIN_ACCOUNT" --gas-price "$MAX_GAS_PRICE_WEI" "$PRESALE_ADDRESS" "pause()"
cast send --rpc-url bsc --account "$ADMIN_ACCOUNT" --gas-price "$MAX_GAS_PRICE_WEI" "$PRESALE_ADDRESS" "unpause()"
cast send --rpc-url bsc --account "$ADMIN_ACCOUNT" --gas-price "$MAX_GAS_PRICE_WEI" "$PRESALE_ADDRESS" "setEndTime(uint64)" <NEW_UNIX_TIMESTAMP>
```

Use `cast call` for `paused()` or `endTime()` after the receipt. Changing `endTime` can extend or shorten participation and has no refund effect. Pausing prevents new participation but does not move funds or distribute tokens.

## Participation export and manual FLAP distribution

Export the complete event record from the deployment block through a fixed, confirmed snapshot block:

```sh
cast logs \
  --rpc-url bsc \
  --from-block "$DEPLOY_BLOCK" \
  --to-block <CONFIRMED_SNAPSHOT_BLOCK> \
  --address "$PRESALE_ADDRESS" \
  --json \
  "Participated(address indexed participant,uint256 amount,uint64 timestamp,uint256 participantNumber)" \
  > participated.json
```

The event fields required for the distribution ledger are indexed `participant`, `amount`, `timestamp`, and `participantNumber`. Before distributing:

1. Freeze and record the confirmed snapshot block; pause first if the sale is meant to close before `endTime`.
2. Decode all `Participated` logs, retain transaction hash and log index, reject removed/orphaned logs, and deduplicate by participant and event identity.
3. Require every amount to equal `0.05 BNB`, participant numbers to be unique and sequential, and the final event count to equal on-chain `participantCount` at the same block.
4. Reconcile successful participation transaction values and the treasury's receipts. The presale contract forwards BNB immediately and should not retain participation funds.
5. Apply the separately approved FLAP allocation policy to the reconciled ledger. This contract defines no token amount or distribution formula.
6. Have a second operator review the recipient/allocation file and total before manually sending FLAP from the authorized distributor.
7. Record each FLAP distribution transaction hash against the source participation event and independently reconcile delivered token balances.

There is no automatic token distribution and no refunds. Never infer a refund entitlement or send one from this contract workflow.
