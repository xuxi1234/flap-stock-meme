# GitHub Actions Secrets：蝴蝶 Mint 手动验收

你在 GitHub 设置页面保存专用钱包私钥，由你点击 **Run workflow** 启动。脚本自动完成本会话确认的新钱包部署、认购、满额发射和领取，并逐笔保存哈希。你不需要在电脑上安装 Node.js，也不需要逐笔复制哈希。

这份 PR 自包含，只添加 `scripts/mint-acceptance/` 及两个 Actions 工作流；不依赖先合并此前的金库页面/预览分支或 PR #46。运行所需 ABI、固定条款和测试数据均随脚本提供。只支持已经确认的钱包和项目，不接受任意合约或收款地址输入。

## 2026-09-12 钱包变更

新签名钱包、管理员、新 Mint 的平台佣金和领币地址统一为 **`0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA`**，Secret 名称仍是 **`FLAP_MINT_PRIVATE_KEY`**。你已在 Secrets 填写正确私钥时无需再次添加；代码作者不读取或导出私钥，运行时才校验派生地址。

旧 Mint 工厂 `0xA64186DB66bAed9fDC13678c4Cfb89B1e1E9cCa9` 和旧项目 `0xC7c1BcD4F0d25e04Ca3CA58139284B7E075B5eb1` 的收益参数不可修改。因此本次部署一套新合约；旧合约和此前普通回购金库的地址不会被这份脚本更改。新佣金地址不代表所有第三方模板收益归该地址。

下表新合约地址是由新钱包 nonce 0、工厂内部 CREATE nonce 1/2 推算的地址，**不代表已经部署**。交易范围仅限固定创建字节码、固定工厂的 createCampaign、新项目的 mint/launch/claim，不能传入其他合约或收款人。

旧 5 笔交易的 `0.010548475729141262 BNB` 仍计入 **累计 0.1 BNB（含 Gas）**，退款不抵扣。旧项目有未退份额、已发射，或新旧钱包有未知/待处理交易时停止。新钱包 nonce 0 若被其他操作或失败部署消耗，必须重新核对部署计划；不会擅自改 nonce 另建工厂。其他步骤失败后可在核对原因及原预算内选择 retry_failed。

继续使用原状态分支与并发组，避免新旧版本同时执行。v1 旧钱包记录只有预置检查点时自动留存旧快照并升级；若已有额外进口哈希或执行记录则停止，必须先核对后续旧交易，不能清空记录迁移。

## 第一步：合并 PR，使运行按钮可用

GitHub 官方要求：带 `workflow_dispatch` 的工作流文件必须先进入仓库默认分支，才能通过 Actions 页面手动启动。因此，新 PR 未合并到 `main` 时，没有可用的主网执行按钮属于预期行为，添加 Secret 也不会绕过这个要求。

合并此独立 PR 后，运行入口：

**https://github.com/xuxi1234/flap-stock-meme/actions/workflows/mint-acceptance.yml**

选择工作流 **Butterfly Mint - manual acceptance**，点击 **Run workflow**，分支选择 **main**。代码同时检查事件和分支，PR、push、定时任务及预览分支不会执行主网。PR 上另有自动离线 CI，没有私钥或主网广播。

本次交付不会自动合并 PR，不会代你点击执行。合并到 `main` 后，仓库既有 Vercel 集成可能触发一次构建；此 PR 不修改网站源代码或根目录依赖。

## 第二步：添加 Repository Secrets

设置入口：**https://github.com/xuxi1234/flap-stock-meme/settings/secrets/actions**

点击 **New repository secret**，准确填写：

| 名称 | 必填 | 值 |
| --- | --- | --- |
| `FLAP_MINT_PRIVATE_KEY` | 执行必填 | 地址 `0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA` 对应的私钥，可带 `0x` 前缀 |
| `FLAP_BSC_RPC_URL` | 可选 | BSC 主网 HTTPS RPC；不填使用 `https://bsc-dataseed.bnbchain.org` |

**必须是本次确认的新钱包 `0x74a7…69aA`。** 若 Secret 对应其他钱包，脚本会因地址不符停止。不能把助记词填入此字段。私钥只填 GitHub Secrets 的值，不要放进代码、Issues、PR 评论或 Run workflow 输入框。

`GITHUB_TOKEN` 由 GitHub 自动提供，不需要你新增 PAT。执行 job 请求 `contents: write`，用于保存独立状态分支；检查和模拟 job 只有 `contents: read`。如仓库/组织规则禁止写状态分支，工作流会在广播之前停止并报告 GitHub HTTP 错误，不会跳过保存继续花钱。

钱包 Secret 仅注入真实 `execute` 的一个 Node.js 步骤，安装依赖、离线测试、模拟及 `check` 均不会获得它。Action 固定到完整提交 SHA；依赖固定在独立 lockfile，安装时禁用生命周期脚本。程序不输出私钥、原始签名交易或 SDK 原始错误，也不会把私钥写入状态分支或结果附件。

## 第三步：检查、模拟、执行

| Run workflow 字段 | 填法 |
| --- | --- |
| `mode` | 首次选 `check`；可选 `simulate`；真实执行选 `execute` |
| `confirmation` | 只有执行时填 **`EXECUTE 0.1 BNB`** |
| `import_hashes` | 通常留空；若之前通过页面或本机脚本操作过，填写尚未录入的完整哈希，多笔用空格分隔 |
| `retry_failed` | 默认不勾选；核实上次失败原因后才勾选重试 |

- **check**：读取远程检查点及真实 BSC 状态、历史交易、预算和份额，生成结果附件，不签名、不广播、不写远程状态。没有钱包 Secret 也能运行。此模式补录的哈希仅体现在本次附件；正式执行时请再次填写这些哈希。
- **simulate**：完全离线，运行正常流程及断网恢复模型；不用钱包 Secret，不请求主网，不保存真实状态。显示的模拟金额、交易和到账不代表真实主网结果。
- **execute**：先通过离线检查，再在独立 job 核验真实链上记录，随后读取 Secret 并执行缺少的步骤。每笔先模拟、限制最大费用、保存检查点，再签名/广播，等待 12 个区块确认后核对事件并继续。一个工作流内无需逐笔确认。

旧项目已退款清零、新工厂未创建时，会执行：

1. 用新钱包 nonce 0 部署新工厂和实现，只付 Gas。
2. 在该工厂创建固定条款的新项目，只付 Gas。
3. 认购 2 份，转入项目 **0.02 BNB + Gas**。
4. 满额发射：项目内部使用已存入的 0.02 BNB 创建代币和首购，钱包另付 Gas；最低输出 100,000 枚。
5. 向同一个固定钱包领取代币及合约可退余款，钱包另付 Gas。

发射后不能再走此前的认购退款流程。这是独立的 **Butterfly Mint Check（MINTCHK）** 验收项目，不处理蝴蝶股票原私募、不自动买卖或提取其他金库、不重新部署已经完成的工厂或项目。实际收益分配到账仍需另行验收。

## 固定合约与累计预算

| 项目 | 固定值 |
| --- | --- |
| 链 | BSC 主网，56 |
| 签名钱包、管理员、平台佣金/领币接收人 | `0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA` |
| 新 Mint 工厂（预测地址） | `0xF3331327bCd1718d7254799e71374Bd338d165d2` |
| 新 Mint 实现（预测地址） | `0xC8dA16293dF06eB1caae4698977778ee19559C20` |
| 新 Mint 项目（预测地址） | `0xF395E8008FD1730d2ACB53ed2Df42d18820fBe78` |
| Flap VaultPortal（项目内部调用） | `0x90497450f2a706f1951b5bdda52B4E5d16f34C06` |
| 回购金库模板工厂 | `0xfd2437DFFB8EBe9F96125b30c85Be22f99Fdddf3` |
| 募集截止 | 北京时间 2026-09-19 10:49:15；过期停止投入 |
| 预算上限 | **累计 0.1 BNB，包含所有 Gas** |
| 单笔最大 Gas | 0.002 BNB |

脚本每次都重新验证工厂/实现/克隆字节码、合约关联及 `data/terms.json` 的每一项条款。所选第三方模板的作者费用仍按模板执行，不因平台佣金地址固定而全部归入你的收益。

累计费用对旧钱包和新钱包分别从 nonce 0 开始核对，再合并计算：**成功转出的 BNB + 成功及失败交易实际 Gas**，发送前再加本笔金额和最大 Gas 预留。退款及后续入账不抵扣额度，不会每次 Run workflow 重置预算。发射内部使用的认购款已经计入，不重复加算本金。

预置旧钱包 `0x79F8b832DE72e81Ad34fd66EcbbF673613264072` 此前 5 笔已确认交易（普通金库创建、Mint 工厂、项目、认购 1 份、退款）。先前只读核验计费累计为 `0.010548475729141262 BNB`，本次使用实时回执重算。钱包出现任何额外 nonce，包括失败交易，必须通过 `import_hashes` 补齐，否则停止。不要同时用本机脚本、页面或其他工作流操作这两个钱包。

## 跨运行持久化与恢复

真实执行的检查点保存在独立、无父提交的状态分支：

**`automation/mint-acceptance-ledger` / `journal.json`**

首次由你启动 `execute` 时自动创建。此分支只保存公开交易状态及关闭该分支自动 Vercel 部署的配置，不包含网站代码或私钥。它是长期恢复依据，不依赖临时 runner、缓存或会过期的附件。

发送顺序：

1. 保存固定交易参数和 nonce 到 GitHub。
2. 在 runner 内存中签名，计算哈希，把哈希保存到 GitHub。
3. 收到 GitHub 对准确内容的确认后才广播。
4. 确认回执及事件，再保存真实结果和累计费用。

更新检查点必须带原文件 SHA；并发或过期状态会失败。工作流使用跨分支相同的并发组，且不取消正在执行的运行。GitHub 保存失败或响应丢失时不会继续广播；如果状态实际上已保存，下次从远程状态恢复。

若广播响应丢失或运行超时，重新运行 `check`，再运行 `execute`。程序查询原哈希，必要时重新生成并广播**相同 nonce、相同参数、相同哈希**，不会自动加价换交易。若你手动替换过交易，程序会停止，需先核对原哈希与替换哈希。

每次运行还上传 `journal.json` 为 Actions artifact（90 天），内含哈希、结果、事件、累计费用。该附件只作方便下载的副本。不要删除/改写长期状态分支来重置额度；即使状态丢失，钱包 nonce 不连续也会阻止继续，需要补齐全部交易历史。

## 当前验证范围

已做离线预算、nonce、持久化、异步保存失败、Secret 隔离、错误输出和完整流程/断网恢复模拟。模拟用替身 RPC 与签名器，没有使用真实钱包或网络广播。提交后 PR 的自动 CI 也只运行这些离线检查。

作者未读取你的钱包 Secret，尚未启动真实主网工作流；真实资金结果仍以你执行后的链上回执为准。测试通过不等于独立合约审计。Secret 可在验收完成后由你删除。

## 参考与数据来源

- [GitHub 手动工作流与默认分支要求](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub Secrets 使用方式](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [GitHub 文件更新 API 与 SHA 参数](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)
- [Vercel 分支部署开关](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled)
- 原合约及核验来源：仓库提交 `35ea332f755f3129f454197aae367362b91fb03f` 的 `contracts/src/ButterflyMint.sol`、`src/vault/mint-artifacts.json` 和 `docs/vault-live-evidence/mint-campaign-decoded.json`。本目录 `data/` 固定复制其 ABI、条款及测试所需链上代码。
