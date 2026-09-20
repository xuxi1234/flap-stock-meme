# 图片12代币：7018地址，每地址0.1枚

固定使用已交付 CSV 的全部7018地址，仅跨币去重，不额外过滤池子、合约或黑洞地址。

- 发送钱包：`0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA`
- 蝴蝶股票：`0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777`
- 分发合约：`0x369890cb7a233be14d33fd4265b26afadce00bc0`
- 前35批各200地址，末批18地址，共36批、701.8枚。
- 每地址转出0.1枚，税费按合约扣除，不补发、不重发。
- 上批成功上链后至少1800秒才能发送下一批。GitHub排队及链上确认可能使间隔更长；不会追赶补发。首批至末批至少17小时30分钟。
- 沿用累计0.2 BNB预算（含旧任务），不重置额度。单笔最大Gas预留0.002 BNB；余额或预算不足即停止。
- 保留原自有钱包调拨本金单独记账口径，全部Gas计入预算。对应记录见 holders18-budget.mjs。

## 手动启动

打开 Actions → “蝴蝶持仓空投｜7018地址·36批·每30分钟”。
点击 Run workflow，分支 main，operation 选择“执行或继续持仓名单”，核对参数后勾选 confirm，再点击 Run workflow。
默认“只读检查”不加载私钥、不签名、不发送。只有用户手动启动执行模式后才会发币；提交代码和PR不会启动转账。

暂停可在运行页面点击 Cancel workflow。中断后仍使用同一入口继续；不得删除执行记录或另建任务ID来重发。
执行记录分支为 `automation/airdrop-image12-ledger`，与旧任务共用串行锁。每批核对两节点回执、nonce、预算及链上完成标记。广播前持久化交易哈希，响应丢失时按原哈希恢复。
旧 image10 任务必须完整完成且与固定快照一致，起始nonce为213；出现记录外交易时停止，不自动绕过。

## 来源与验证

来源快照：BSC区块122971420，12代币各600名，7200条去重为7018地址。
原CSV SHA-256：`5caf6e066a6b03347ab24fe3090f8ca2eaf6edf6a09788db7c1f3b1888ed20c8`。
名单、来源摘要和上轮记录均固定在 `data/image12-*`。

测试：`node --test scripts/mint-acceptance/image12-tests.mjs scripts/mint-acceptance/image12-integration-tests.mjs scripts/mint-acceptance/holders18-budget-tests.mjs`。
