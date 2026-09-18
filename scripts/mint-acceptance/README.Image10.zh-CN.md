# 图片10代币：5774地址空投

沿用已成功完成的旧持仓任务，但使用独立的新任务ID和执行记录分支。

- 钱包：`0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA`
- 代币：蝴蝶股票 `0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777`
- 名单：`data/image10-recipients.txt`，精确对应已交付的5774地址CSV，仅去重，不再过滤。
- 每地址转出1枚；合约税费正常扣除，不补发。
- 29批：前28批各200地址，最后174地址，总5774枚。
- 每批成功上链后至少1200秒才允许下一批；不追赶补发。GitHub排队和确认可能导致实际间隔大于20分钟。
- 首批至末批至少9小时20分钟。每批独立job，避免单job超过6小时。
- 延续原累计0.2 BNB预算及原自有钱包调拨记账口径，不重置预算；每笔Gas最大预留0.002 BNB。
- 新记录分支：`automation/airdrop-image10-ledger`；旧记录不修改。

## 用户手动启动

进入 GitHub Actions 的“蝴蝶持仓空投｜5774地址·29批·每20分钟”，点击 Run workflow。
分支选 main，operation 选“执行或继续持仓名单”，勾选 confirm，再点击 Run workflow。
默认“只读检查”不会签名或发送，PR检查也只有只读权限且不会加载私钥。

失败后保留全部检查点；排除原因后用同一入口继续，禁止删除记录或修改名单来重跑。
该任务与同钱包旧任务共享串行锁，防止同时使用nonce。每次执行前核实旧任务已结束、历史交易、钱包nonce、双节点回执、余额和预算。
交易哈希在广播前持久化；广播响应丢失时按原哈希恢复，已确认批次不重新发送。

## 审计与测试

来源区块122433912，10个代币各600名，6000条去重为5774条。
`data/image10-manifest.json`保留来源、文件哈希和快照信息。
`data/image10-prior-holders18.json`固定旧50批完成记录，新任务从nonce183衔接；出现记录外交易时停止。

运行：`node --test scripts/mint-acceptance/image10-tests.mjs scripts/mint-acceptance/image10-recovery-tests.mjs scripts/mint-acceptance/holders18-budget-tests.mjs`
