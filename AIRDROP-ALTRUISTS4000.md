# Altruists 固定 4,000 地址空投

此工作流只有用户在 main 手动选择「启动或继续空投」并勾选确认后才会签名和广播。提交代码只运行离线测试与 Secret 是否存在的检查。

- BSC / chain ID 56
- 发送钱包：`0x1dAA59D86A032014a88321F2CE39d89ead2C3163`
- 代币：`0x3805e1ce7edde3eb2f3613485cc6f42a7a3d7777`
- 名单：`scripts/altruists4000/data/altruists4000-recipients.csv`，原 CSV 字节完整保留。
- SHA-256：`82f549e1f8767267d1cfec81baa5bbe5ccf2648350037e81e16ccaa223ef29ca`
- 4,000 个唯一地址，20 批，每批 200，每地址转出 1 枚，共 4,000 枚。若代币征税，以实际到账为准，不补发。
- 上一批经双节点核对并达到 12 确认后，至少间隔 180 秒；GitHub 排队及启动时间可能使间隔更长。
- 无累计 Gas 金额上限；仍检查 BNB 是否足够支付当前交易最大费用。

## 使用

打开 Actions → Altruists空投 → Run workflow。选择 main，先可选择「只读检查」。正式开始时选择「启动或继续空投」并勾选确认。一次启动后，20 个串行步骤自动推进，无需逐批确认。

需要本仓库 Secret：`BSC_PRIVATE_KEY`、`FLAP_BSC_RPC_URL`（沿用已有付费 RPC）。私钥必须对应上方钱包，RPC 必须是 BSC HTTPS 节点。Secret 只在 GitHub runner 使用，不会写入报告。Secret 值不能由 GitHub 读取或跨仓库复制；其他仓库中同名 Secret 不会自动生效。

遇到失败、节点分歧、未知待处理交易、检查点故障时停止。恢复时再次以同样方式运行，读取原检查点继续，禁止删除状态分支或更改名单。不是失败后无限重试，也不会自动替换价格不够的旧交易。

## 交易与恢复

使用已有分发合约 `0x369890cb7a233be14d33fd4265b26afadce00bc0`，每次运行先核对完整 runtime 字节码。按剩余数量授权，不做无限授权。每批一个分发交易，首次另有授权交易；必要时先清零旧授权。

批次 ID 绑定钱包、代币、名单哈希、数量、间隔和版本。链上 completed 映射防止同批重复。签名前保存交易参数，广播前持久保存交易哈希；恢复时核对回执及 nonce，仅重建相同签名交易。双节点校验交易、区块、12 确认、批次事件及逐地址到账。交易失败时停止，不跳过收款人。

检查点存于独立分支 `automation/airdrop-altruists4000-ledger`；不保存私钥或可广播的签名原文。每步 Summary 显示批次、状态及 BscScan 链接，Artifacts 保存 journal.json 和 deliveries.csv。

## 钱包排队范围

本仓库同钱包任务统一使用 concurrency group `flap-mint-acceptance-bsc56-79f8`，不取消正在运行的任务，并启用 queue:max。与参考旧任务使用相同排队组，即使钱包不同也串行等待。旧任务可能长时间占用队列，不会抢占或取消旧任务。

GitHub concurrency 只在同一仓库有效。MEME站仓库旧入口已停用。其他仓库或钱包软件不会自动遵守此锁，不能宣称实现跨仓库锁。若之后增加同钱包任务，必须放在本仓库并使用此 group；发现未知 pending nonce 时本任务会停止，而不是争抢序号。

## 验证

`npm ci --ignore-scripts --prefix scripts/altruists4000`

`node --test scripts/altruists4000/altruists4000-tests.mjs`

离线测试不会用真实私钥或广播交易。只读检查也不授权、不转币。未经过用户手动启动前，不执行主网转账测试。
