import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { pathToFileURL } from 'node:url';
import { ACCOUNT } from './config.mjs';
import { Stop, requireThat, equal } from './core.mjs';
import { runAcceptance } from './run.mjs';
import { githubApi, openGitHubStore, REPOSITORY } from './github-store.mjs';

export function actionsOptions(env) {
  requireThat(env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.GITHUB_REPOSITORY === REPOSITORY, '此入口只接受本仓库由用户手动启动的 workflow_dispatch。');
  requireThat(env.GITHUB_REF === 'refs/heads/main', '请选择 main 分支运行；预览或 PR 分支不能执行主网。');
  const mode = env.FLAP_MINT_MODE || 'check';
  requireThat(['check', 'execute'].includes(mode), '此入口只接受 check 或 execute。');
  if (mode === 'execute') requireThat(env.FLAP_MINT_CONFIRMATION === 'EXECUTE 0.1 BNB', '请在手动运行页面填写准确确认文字 EXECUTE 0.1 BNB。');
  const imports = (env.FLAP_MINT_IMPORT_HASHES || '').split(/[\s,]+/).filter(Boolean).map(h => h.toLowerCase());
  requireThat(imports.length <= 100 && imports.every(h => /^0x[0-9a-f]{64}$/.test(h)), '补录哈希格式无效（可用空格或换行分隔，最多 100 笔）。');
  return { execute: mode === 'execute', retry: env.FLAP_MINT_RETRY_FAILED === 'true', imports };
}

export function accountFromSecret(env, convert = privateKeyToAccount) {
  actionsOptions(env); requireThat(env.FLAP_MINT_MODE === 'execute', '只读模式不读取钱包 Secret。');
  let key = env.FLAP_MINT_PRIVATE_KEY || ''; delete env.FLAP_MINT_PRIVATE_KEY;
  key = key.trim(); if (key && !key.startsWith('0x')) key = '0x' + key;
  requireThat(/^0x[0-9a-fA-F]{64}$/.test(key), '请在 Actions Secrets 添加 FLAP_MINT_PRIVATE_KEY；不要放进运行输入框。');
  const account = convert(key); key = '';
  requireThat(equal(account.address, ACCOUNT), 'FLAP_MINT_PRIVATE_KEY 对应地址不匹配；只能使用已确认的 0x79F8…264072 验收钱包。');
  return account;
}

export async function main() {
  const opts = actionsOptions(process.env);
  const rpc = process.env.FLAP_BSC_RPC_URL || 'https://bsc-dataseed.bnbchain.org';
  requireThat(new URL(rpc).protocol === 'https:', '主网 RPC 必须为 HTTPS。');
  const client = createPublicClient({ chain: bsc, transport: http(rpc, { timeout: 20000, retryCount: 0 }) });
  const store = await openGitHubStore({ api: githubApi(process.env.GITHUB_TOKEN), readOnly: !opts.execute, reportDirectory: process.env.FLAP_MINT_REPORT_DIR });
  // The provider is called only after historical receipts, budget, nonce and on-chain terms pass.
  await runAcceptance({ client, store, opts, accountProvider: async () => accountFromSecret(process.env) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(error instanceof Stop ? error.message : '执行未完成，请保留 GitHub 检查点并重新运行 check。没有输出底层错误、签名请求或私钥。');
  process.exitCode = 1;
});
