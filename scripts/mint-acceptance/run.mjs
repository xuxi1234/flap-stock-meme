#!/usr/bin/env node
import { createPublicClient, http, formatEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { createInterface } from 'node:readline/promises';
import { ACCOUNT, CAMPAIGN, CONFIRMATIONS } from './config.mjs';
import { Stop, requireThat, equal, inspect, nextAction, reconcile, receiptRecord, checkNonce, prepare, sendEntry, summary } from './core.mjs';
import { openStore, hiddenKeyPrompt } from './storage.mjs';

const help = `蝴蝶 Mint 本机验收（Node.js 22+）
  node scripts/mint-acceptance/run.mjs --check
  node scripts/mint-acceptance/run.mjs --execute
  node scripts/mint-acceptance/run.mjs --check --import-hash 0x交易哈希
  node scripts/mint-acceptance/run.mjs --execute --retry-failed

默认 --check：只读链上并更新本机记录，不接收私钥、不签名。
--execute：一次本机确认后依次完成缺少份额认购、满额发射、领取。
--retry-failed：你核对失败原因后才可使用；失败 Gas 仍累计计费。
总上限 0.1 BNB，含此前全部 Gas 和成功转出金额；退款不抵扣。
只支持固定钱包 ${ACCOUNT}，固定项目 ${CAMPAIGN}。
可选 FLAP_BSC_RPC_URL 指定 HTTPS RPC，不在输出中显示。
禁止在 GitHub Actions、Vercel、共享云终端或录屏终端输入私钥。`;

function options(args) {
  const result = { execute: false, retry: false, imports: [] }; let mode;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') { console.log(help); return null; }
    if (arg === '--execute' || arg === '--check') { requireThat(!mode, '只可指定一种执行模式。'); mode = arg; result.execute = arg === '--execute'; }
    else if (arg === '--retry-failed') result.retry = true;
    else if (arg === '--import-hash') { const hash = args[++i]; requireThat(/^0x[0-9a-fA-F]{64}$/.test(hash ?? ''), '请在 --import-hash 后填写交易哈希。'); result.imports.push(hash.toLowerCase()); }
    else throw new Stop('未知参数；使用 --help 查看说明。不要通过参数传入私钥。');
  }
  return result;
}

async function confirmLocally() {
  requireThat(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI && !process.env.VERCEL && !process.env.GITHUB_ACTIONS, '执行模式仅支持你自己电脑的交互终端。');
  console.log(`固定钱包/领取/平台佣金地址：${ACCOUNT}\n固定项目：${CAMPAIGN}\n将依次认购剩余份额（最多 0.02 BNB）、用项目资金发射，然后领取。累计 0.1 BNB 含全部 Gas；退款不恢复预算。发射后认购款不能按原退款流程退回。`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let answer; try { answer = await rl.question('确认条款后输入 EXECUTE 0.1 BNB（本次进程只确认一次）：'); } finally { rl.close(); }
  requireThat(answer === 'EXECUTE 0.1 BNB', '未确认，已停止。');
  let key = await hiddenKeyPrompt();
  if (!key.startsWith('0x')) key = '0x' + key;
  requireThat(/^0x[0-9a-fA-F]{64}$/.test(key), '私钥格式无效。');
  const account = privateKeyToAccount(key); key = ''; // JS cannot guarantee memory erasure; never persist it.
  requireThat(equal(account.address, ACCOUNT), '私钥对应钱包不匹配；未发送交易。请使用此前验收的钱包。');
  return account;
}

async function complete(client, store, state) {
  const balance = await client.readContract({ address: state.token, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [ACCOUNT] });
  requireThat(balance > 0n, '份额已领取但当前钱包代币余额为零，请人工核对是否另行转出。');
  requireThat(store.journal.results.some(r => r.success && r.events.some(e => e.name === 'Claimed' && equal(e.args.receiver, ACCOUNT))), '缺少该钱包的领取回执，请导入领取哈希。');
  store.journal.acceptance = { token: state.token, observedTokenBalanceWei: balance.toString(), block: state.block.toString(), completed: true, scope: 'fund-launch-claim; revenue payout not tested' };
  store.save(store.journal);
  console.log(`认购 → 发射 → 领取验收完成。代币：${state.token}；当前钱包余额 ${formatEther(balance)} 枚。收益分配实际到账仍未验收。`);
}

async function main() {
  const opts = options(process.argv.slice(2)); if (!opts) return;
  const rpc = process.env.FLAP_BSC_RPC_URL || 'https://bsc-dataseed.bnbchain.org';
  requireThat(new URL(rpc).protocol === 'https:', '主网 RPC 必须使用 HTTPS。');
  const client = createPublicClient({ chain: bsc, transport: http(rpc, { timeout: 20000, retryCount: 0 }) });
  const store = openStore(); const { journal, save } = store;
  const onSignal = () => { if (process.stdin.isRaw) process.stdin.setRawMode(false); store.close(); process.exit(130); };
  process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
  try {
    await inspect(client); // Validate chain, code and all fixed terms before even importing records.
    for (const hash of opts.imports) {
      requireThat(await receiptRecord(client, hash), '导入交易未确认；请等待至少 12 个确认。');
      if (!journal.imports.includes(hash)) journal.imports.push(hash);
    }
    save(journal);
    let account;
    for (let count = 0; count < 5; count++) {
      const ledger = await reconcile(client, journal, save), state = await inspect(client);
      const pending = journal.entries.find(e => !e.settled);
      await checkNonce(client, ledger.nonce, Boolean(pending?.hash));
      console.log(summary(ledger, state));
      console.log(`记录文件：${store.journalPath}`);
      if (nextAction(state) === 'done') { await complete(client, store, state); return; }
      if (!opts.execute) {
        console.log(pending ? `有未完成交易，续跑只会处理原 nonce/原哈希：${pending.hash || '尚未签名'}` : '只读检查通过。使用 --execute 后才会请求本机私钥并执行。'); return;
      }
      const last = journal.entries.at(-1);
      requireThat(opts.retry || !last?.settled || last.success, '上次交易失败。核对原因后使用 --retry-failed；不会自动反复花费 Gas。');
      if (!account) account = await confirmLocally();
      const entry = pending || await prepare(client, state, ledger);
      if (!pending) { journal.entries.push(entry); save(journal); }
      console.log(`准备 ${entry.action}；转入 ${formatEther(BigInt(entry.transaction.value))} BNB；最大 Gas ${formatEther(BigInt(entry.transaction.gas) * BigInt(entry.transaction.gasPrice))} BNB。`);
      const hash = await sendEntry({ client, account, entry, ledger, save, journal });
      console.log(`已发送：${hash}；等待 ${CONFIRMATIONS} 个确认。`);
      // Do not automatically replace a pending transaction or bump its fee/nonce.
      await client.waitForTransactionReceipt({ hash, confirmations: Number(CONFIRMATIONS), timeout: 180000, pollingInterval: 3000 });
      const after = await reconcile(client, journal, save);
      requireThat(entry.success, '交易执行失败，结果和 Gas 已保存；请核对后再决定是否重试。');
      console.log(`确认成功；累计支出 ${formatEther(after.spent)} BNB。`);
    }
    throw new Stop('达到单次执行步数上限；请检查记录后续跑。');
  } finally { process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal); store.close(); }
}

main().catch(error => {
  // Never print SDK errors, request bodies, raw signed transactions, key input or stack traces.
  console.error(error instanceof Stop ? error.message : '网络、签名或文件操作未完成。已保存的交易可能已广播；保留记录，用 --check 核对后续跑。为避免泄露签名数据，未输出底层错误。');
  process.exitCode = 1;
});
