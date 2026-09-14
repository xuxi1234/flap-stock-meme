# 蝴蝶兑换：代币登记与路由范围

蝴蝶股票固定合约：`0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777`，BSC 主网，18 位精度。
首页及兑换页使用项目提供的买入税 3%、卖出税 3%；默认 BNB → 蝴蝶股票，使用本站头像。登记只影响本站代币列表，不改变第三方钱包的白名单或代币合约。

## 报价与发送

- 同一区块读取 PancakeSwap V2 与 V3 的候选路径，按预计收到代币数量排序；未扣除 BNB 网络费，不承诺全市场最优。
- 桥接资产固定 WBNB、USDT、USDC；V2 最多三跳，V3 最多两跳，V3 查询 0.01%、0.05%、0.25%、1% 费率池。
- 不拆单，不混用 V2/V3，不执行 Infinity 或其他 DEX 路由。外部行情不能提供交易 calldata。
- 蝴蝶股票因买卖税使用 V2 SupportingFeeOnTransferTokens 方法；报价先扣相应方向的 3% 税，再计算最低到账滑点。税率来自项目配置，实际到账取决于链上执行。
- V3 使用官方独立 SwapRouter：`0x1b81D678ffb9C0263b24A97847620C99d213eB14`。仅精确授权当前输入数量；原生 BNB 输入附带 value 与退款调用，原生输出由 router 解包并直接发送到签名账户。
- 自动刷新等待当前查询完成，切换资产或金额立即使旧报价失效，防止慢节点反复取消报价。
- 签名前再次检查账户、网络、报价有效期、最低到账、余额、价格影响，并模拟交易。报价过期或模拟失败均停止。
- 不加载项目私钥。真实兑换由访问者的钱包确认。

## 行情参考池

DEX Screener 返回的 PancakeSwap、THENA、Uniswap、Biswap、ApeSwap 池仅用于价格参考与外链查看。限定 BSC、已收录代币和 USDT/USDC/WBNB 计价资产，最多保留八个池，按单池流动性排序。V3 与 Infinity 分开标记。行情接口失败时不阻止独立链上报价。

官方 V3 部署资料：https://developer.pancakeswap.finance/contracts/v3/addresses
官方 ABI 来源：https://github.com/pancakeswap/pancake-v3-contracts/tree/main/projects/v3-periphery/contracts

## 验证

```bash
npm ci --ignore-scripts
npx vitest run --maxWorkers=2
npm run build
# 可选主网只读检查：不需要私钥，也不发送交易
VITE_SWAP_ROUTING_SMOKE=1 npx vitest run src/swap/routing-live.test.ts
```

自动测试覆盖默认资产登记、3% 买税/卖税、V3-only 流动性、授权目标、原生 BNB 解包/退款、禁止含税代币 V3 调用和多池行情保留。主网只读检查验证蝴蝶股票元数据、BNB→蝴蝶股票报价及 USDT→苹果 bStock 的 V3 报价；不等同于真实资金成交测试。
