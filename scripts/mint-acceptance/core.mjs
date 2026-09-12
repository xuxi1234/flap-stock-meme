import { randomBytes } from 'node:crypto';
import { encodeFunctionData, decodeEventLog, keccak256, getContractAddress, formatEther } from 'viem';
import * as C from './config.mjs';

export class Stop extends Error {}
export function requireThat(ok, message) { if (!ok) throw new Stop(message); }
export const equal = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export const stringify = x => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
export const freshJournal = () => ({ version: 2, account: C.ACCOUNT, campaign: C.CAMPAIGN, imports: [], entries: [] });
export function validateJournal(j) {
  if (j.version === 1 && equal(j.account, C.LEGACY_ACCOUNT) && equal(j.campaign, C.LEGACY_CAMPAIGN)) {
    requireThat(j.entries?.length === 0 && j.imports?.length === 0, '旧钱包记录包含额外操作，需先核对旧交易，不能自动清空或迁移。');
    j.legacySnapshot = { account: j.account, campaign: j.campaign, results: j.results || [], spentWei: j.spentWei };
    j.version = 2; j.account = C.ACCOUNT; j.campaign = C.CAMPAIGN;
  }
  requireThat(j.version === 2 && equal(j.account, C.ACCOUNT) && equal(j.campaign, C.CAMPAIGN), '记录文件版本或固定地址不匹配。');
  requireThat(Array.isArray(j.entries) && Array.isArray(j.imports), '记录文件结构损坏；请恢复备份，勿删除后重试。');
  requireThat(j.entries.filter(e => !e.settled).length <= 1, '存在多笔未完成记录，请先人工核对。');
  requireThat(j.entries.every((e, i) => e.settled || i === j.entries.length - 1), '未完成交易必须位于记录末尾。');
}

export function calculateBudget(rows, reservation = 0n) {
  const wallets = new Map(); let spent = 0n;
  for (const r of rows) {
    const from = (r.from || C.ACCOUNT).toLowerCase();
    requireThat([C.ACCOUNT, C.LEGACY_ACCOUNT].some(a => equal(a, from)), '预算记录钱包不在固定范围内。');
    const nonces = wallets.get(from) || new Set();
    requireThat(Number.isSafeInteger(r.nonce) && r.nonce >= 0 && !nonces.has(r.nonce), '同一 nonce 存在不同交易记录，停止执行。');
    nonces.add(r.nonce); wallets.set(from, nonces);
    requireThat(BigInt(r.feeWei) >= 0n && BigInt(r.valueWei) >= 0n, '预算记录金额无效。');
    spent += BigInt(r.feeWei) + (r.success ? BigInt(r.valueWei) : 0n);
  }
  for (const nonces of wallets.values()) for (let n = 0; n < nonces.size; n++) requireThat(nonces.has(n), `缺少 nonce ${n} 的交易，请用 --import-hash 补齐。`);
  requireThat(spent + reservation <= C.BUDGET, '累计支出加最大网络费将超过 0.1 BNB，已停止。');
  return spent;
}

export async function receiptRecord(client, hash) {
  requireThat(/^0x[0-9a-fA-F]{64}$/.test(hash), '交易哈希格式错误。');
  const [tx, receipt] = await Promise.all([
    client.request({ method: 'eth_getTransactionByHash', params: [hash] }),
    client.request({ method: 'eth_getTransactionReceipt', params: [hash] }),
  ]);
  if (!receipt) return null;
  requireThat(tx && [C.ACCOUNT, C.LEGACY_ACCOUNT].some(a => equal(tx.from, a)) && BigInt(tx.chainId) === 56n, '回执的发起钱包或链不匹配。');
  requireThat(equal(tx.hash, hash) && equal(receipt.transactionHash, hash) && equal(tx.blockHash, receipt.blockHash), '交易和回执不匹配。');
  const [head, block] = await Promise.all([client.getBlockNumber(), client.getBlock({ blockNumber: BigInt(receipt.blockNumber) })]);
  requireThat(equal(block.hash, receipt.blockHash) && head - BigInt(receipt.blockNumber) + 1n >= C.CONFIRMATIONS, '交易尚未达到 12 个确认，或发生区块重组；稍后续跑。');
  const events = [];
  for (const log of receipt.logs.filter(l => equal(l.address, C.CAMPAIGN) || equal(l.address, C.FACTORY))) {
    try { const e = decodeEventLog({ abi: equal(log.address, C.FACTORY) ? C.factoryAbi : C.campaignAbi, data: log.data, topics: log.topics, strict: true }); events.push({ name: e.eventName, args: e.args }); } catch { /* Other logs are not used as acceptance evidence. */ }
  }
  return { hash, from: tx.from, contractAddress: receipt.contractAddress, nonce: Number(BigInt(tx.nonce)), to: tx.to, data: tx.input, valueWei: BigInt(tx.value).toString(), gas: BigInt(tx.gas).toString(), gasPrice: BigInt(tx.gasPrice).toString(),
    success: receipt.status === '0x1', feeWei: (BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)).toString(), block: BigInt(receipt.blockNumber).toString(), blockHash: receipt.blockHash, events };
}

export function verifyEntry(entry, row) {
  const t = entry.transaction;
  requireThat(row.nonce === t.nonce && (row.to == null && t.to == null || equal(row.to, t.to)) && equal(row.data, t.data) && BigInt(row.valueWei) === BigInt(t.value) && BigInt(row.gas) === BigInt(t.gas) && BigInt(row.gasPrice) === BigInt(t.gasPrice), '已确认交易与本机签名前记录不一致。');
  requireThat(equal(row.from, C.ACCOUNT), '执行回执不是新钱包。');
  if (!row.success) return;
  if (entry.action === 'deployFactory') {
    requireThat(t.nonce === 0 && !row.to && equal(row.contractAddress, C.FACTORY) && equal(row.data, C.DEPLOY_DATA) && BigInt(row.valueWei) === 0n, '工厂部署回执不匹配。'); return;
  }
  const expected = { createCampaign: 'CampaignCreated', mint: 'Minted', launch: 'Launched', claim: 'Claimed' }[entry.action];
  const event = row.events.find(e => e.name === expected);
  requireThat(event, '成功回执缺少预期事件，请核对后继续。');
  if (entry.action === 'createCampaign') requireThat(equal(event.args.campaign, C.CAMPAIGN) && equal(event.args.creator, C.ACCOUNT) && BigInt(event.args.targetShares) === 2n && BigInt(event.args.deadline) === BigInt(C.terms.deadline), '新项目创建事件不匹配。');
  if (entry.action === 'mint') requireThat(equal(event.args.participant, C.ACCOUNT) && BigInt(event.args.amount) === BigInt(t.value), '认购事件金额或参与者不匹配。');
  if (entry.action === 'launch') requireThat(equal(event.args.token, entry.predicted) && BigInt(event.args.spent) === 2n * C.SHARE_PRICE && BigInt(event.args.tokens) >= BigInt(C.terms.minimumTokensOut), '发射事件不符合固定条款。');
  if (entry.action === 'claim') requireThat(equal(event.args.participant, C.ACCOUNT) && equal(event.args.receiver, C.ACCOUNT) && BigInt(event.args.tokens) > 0n, '领取事件地址或金额不匹配。');
}

export async function reconcile(client, journal, save) {
  validateJournal(journal);
  const hashes = [...new Set([...C.CHECKPOINTS, ...journal.imports, ...journal.entries.map(e => e.hash).filter(Boolean)])];
  const rows = [];
  for (const hash of hashes) {
    const row = await receiptRecord(client, hash);
    if (!row) {
      requireThat(journal.entries.some(e => equal(e.hash, hash) && !e.settled), '历史交易回执暂不可用，停止而不重发。'); continue;
    }
    const checkpoint = C.CHECKPOINTS.indexOf(hash);
    if (checkpoint >= 0) requireThat(row.success && equal(row.from, C.LEGACY_ACCOUNT) && row.nonce === checkpoint, '固定历史检查点核验失败。');
    const entry = journal.entries.find(e => equal(e.hash, hash));
    if (entry) { verifyEntry(entry, row); entry.settled = true; entry.success = row.success; }
    rows.push(row);
  }
  const spent = calculateBudget(rows);
  journal.results = rows; journal.spentWei = spent.toString(); await save(journal);
  const legacyNonce = rows.filter(r => equal(r.from, C.LEGACY_ACCOUNT)).length;
  const legacyCounts = await Promise.all(['latest', 'pending'].map(blockTag => client.getTransactionCount({ address: C.LEGACY_ACCOUNT, blockTag })));
  requireThat(legacyCounts.every(n => n === legacyNonce), '旧钱包有未计入预算或待处理的交易，请补录哈希后再执行。');
  return { rows, spent, nonce: rows.filter(r => equal(r.from, C.ACCOUNT)).length };
}

export async function inspect(client) {
  requireThat(await client.getChainId() === 56, 'RPC 不是 BSC 主网（56）。');
  const block = await client.getBlock();
  const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args, blockNumber: block.number });
  // Existing immutable receivers stay unchanged. Do not abandon funded legacy escrow.
  const [legacyCode, legacyImpl, legacyTotal, legacyLaunched, legacyShares] = await Promise.all([
    client.getCode({ address: C.LEGACY_FACTORY, blockNumber: block.number }), client.getCode({ address: C.LEGACY_IMPLEMENTATION, blockNumber: block.number }),
    read(C.LEGACY_CAMPAIGN, C.campaignAbi, 'totalShares'), read(C.LEGACY_CAMPAIGN, C.campaignAbi, 'launched'), read(C.LEGACY_CAMPAIGN, C.campaignAbi, 'sharesOf', [C.LEGACY_ACCOUNT]),
  ]);
  requireThat(legacyCode && legacyImpl && keccak256(legacyCode) === C.LEGACY_FACTORY_CODE_HASH && keccak256(legacyImpl) === C.LEGACY_IMPLEMENTATION_CODE_HASH, '旧工厂字节码不匹配。');
  requireThat(legacyTotal === 0n && legacyShares === 0n && !legacyLaunched, '旧项目仍有认购或已发射，请先核对，不能重复投入新项目。');
  const [fc, ic, cc] = await Promise.all([C.FACTORY, C.IMPLEMENTATION, C.CAMPAIGN].map(address => client.getCode({ address, blockNumber: block.number })));
  const exists = code => code && code !== '0x';
  const empty = { total: 0n, shares: 0n, timestamp: block.timestamp, block: block.number };
  if (!exists(fc)) {
    requireThat(!exists(ic) && !exists(cc), '预定部署地址存在异常字节码。');
    requireThat(exists(await client.getCode({ address: C.VAULT_PORTAL, blockNumber: block.number })), 'Flap 入口无代码。');
    return { ...empty, stage: 'deployFactory' };
  }
  requireThat(exists(ic) && keccak256(fc) === C.FACTORY_CODE_HASH && keccak256(ic) === C.IMPLEMENTATION_CODE_HASH, '工厂、实现字节码不匹配。');
  for (const [name, expected] of Object.entries({ owner: C.ACCOUNT, commissionReceiver: C.ACCOUNT, vaultPortal: C.VAULT_PORTAL, implementation: C.IMPLEMENTATION }))
    requireThat(equal(await read(C.FACTORY, C.factoryAbi, name), expected), '新工厂管理员或收益地址不匹配。');
  if (!exists(cc)) {
    requireThat(await read(C.FACTORY, C.factoryAbi, 'campaignCount') === 0n && await client.getTransactionCount({ address: C.FACTORY, blockTag: 'latest' }) === 2, '工厂已创建其他项目，不能重复创建。');
    requireThat(!await read(C.FACTORY, C.factoryAbi, 'creationPaused'), '工厂已暂停创建。');
    return { ...empty, stage: 'createCampaign' };
  }
  const clone = '0x363d3d373d3d3d363d73' + C.IMPLEMENTATION.slice(2).toLowerCase() + '5af43d82803e903d91602b57fd5bf3';
  requireThat(equal(cc, clone) && await read(C.FACTORY, C.factoryAbi, 'campaignCount') === 1n, '项目字节码或数量不匹配。');
  const f = name => read(C.FACTORY, C.factoryAbi, name);
  const c = (name, args) => read(C.CAMPAIGN, C.campaignAbi, name, args);
  const [owner, revenue, portal, implementation, registered, creator, factory, receiver, config] = await Promise.all([
    f('owner'), f('commissionReceiver'), f('vaultPortal'), f('implementation'), read(C.FACTORY, C.factoryAbi, 'isCampaign', [C.CAMPAIGN]),
    c('creator'), c('factory'), c('commissionReceiver'), c('config'),
  ]);
  requireThat(equal(owner, C.ACCOUNT) && equal(revenue, C.ACCOUNT) && equal(receiver, C.ACCOUNT) && equal(creator, C.ACCOUNT) && equal(portal, C.VAULT_PORTAL) && equal(implementation, C.IMPLEMENTATION) && equal(factory, C.FACTORY) && registered, '固定合约关系、管理员或收益地址不匹配。');
  for (const [key, value] of Object.entries(C.terms)) requireThat(equal(config[key], value), `固定募集条款 ${key} 不匹配。`);
  const [total, shares, claimed, launched, aborted, token, claimable] = await Promise.all([
    c('totalShares'), c('sharesOf', [C.ACCOUNT]), c('claimedShares'), c('launched'), c('aborted'), c('token'), c('claimable', [C.ACCOUNT]),
  ]);
  return { total, shares, claimed, launched, aborted, token, claimable, timestamp: block.timestamp, block: block.number };
}

export function nextAction(s) {
  if (s.stage === 'deployFactory' || s.stage === 'createCampaign') {
    requireThat(s.timestamp + 3600n <= BigInt(C.terms.deadline), '固定截止时间不足一小时，停止创建。'); return s.stage;
  }
  if (s.launched) {
    if (s.shares === 0n) { requireThat(s.claimed === 2n, '没有可领取份额，但领取验收尚未完成。'); return 'done'; }
    requireThat(s.shares === 2n && s.total === 2n && s.claimable[0] > 0n, '发射后份额或可领取金额异常。'); return 'claim';
  }
  requireThat(!s.aborted && s.timestamp < BigInt(C.terms.deadline), '项目已取消或到期；不会自动另建项目或继续投入，可通过页面检查退款。');
  requireThat(s.total === s.shares && s.total >= 0n && s.total <= 2n, '出现其他参与者或异常份额，停止自动验收。');
  return s.total === 2n ? 'launch' : 'mint';
}

export function predictedToken(salt) {
  return getContractAddress({ from: C.PORTAL, salt, opcode: 'CREATE2', bytecode: '0x3d602d80600a3d3981f3363d3d373d3d3d363d73' + C.TAX_IMPL.slice(2).toLowerCase() + '5af43d82803e903d91602b57fd5bf3' });
}
async function mineSalt() {
  let salt = '0x' + randomBytes(32).toString('hex');
  for (let n = 0; n < 2000000; n++) {
    if (predictedToken(salt).toLowerCase().endsWith('7777')) return salt;
    salt = keccak256(salt);
    if (n % 2000 === 0) await new Promise(resolve => setImmediate(resolve));
  }
  throw new Stop('7777 地址计算超时，未签名，请重新运行。');
}
export function callFor(action, state, salt) {
  if (action === 'deployFactory') return { data: C.DEPLOY_DATA, value: 0n };
  if (action === 'createCampaign') return { to: C.FACTORY, data: encodeFunctionData({ abi: C.factoryAbi, functionName: 'createCampaign', args: [C.terms] }), value: 0n };
  const args = action === 'mint' ? [2n - state.total] : action === 'claim' ? [C.ACCOUNT] : [salt];
  return { to: C.CAMPAIGN, data: encodeFunctionData({ abi: C.campaignAbi, functionName: action, args }), value: action === 'mint' ? (2n - state.total) * C.SHARE_PRICE : 0n };
}
export async function checkNonce(client, nonce, hasPending = false) {
  const [latest, pending] = await Promise.all(['latest', 'pending'].map(blockTag => client.getTransactionCount({ address: C.ACCOUNT, blockTag })));
  requireThat(latest === nonce && (pending === nonce || (hasPending && pending === nonce + 1)), `钱包 nonce 与已核验记录不一致（预期 ${nonce}，链上 ${latest}，待处理 ${pending}）。请导入遗漏哈希或等待已有交易，勿删除记录重跑。`);
}
export function assertReservation(spent, t) {
  const gasFee = BigInt(t.gas) * BigInt(t.gasPrice);
  requireThat(gasFee > 0n && gasFee <= C.GAS_CAP, '单笔最大 Gas 超过 0.002 BNB 或参数无效。');
  requireThat(BigInt(t.value) >= 0n && spent + BigInt(t.value) + gasFee <= C.BUDGET, '本笔金额加最大 Gas 将超过累计 0.1 BNB 上限。');
  return BigInt(t.value) + gasFee;
}
export async function prepare(client, state, ledger, { saltFactory = mineSalt } = {}) {
  const action = nextAction(state); requireThat(action !== 'done', '验收已经完成。');
  requireThat(action !== 'deployFactory' || ledger.nonce === 0, '部署固定使用新钱包 nonce 0；该 nonce 已消耗，需重新核对部署计划。');
  const salt = action === 'launch' ? await saltFactory() : undefined;
  if (salt) { const code = await client.getCode({ address: predictedToken(salt) }); requireThat(!code || code === '0x', '预测代币地址已有代码，停止。'); }
  const call = callFor(action, state, salt);
  await client.call({ account: C.ACCOUNT, ...call });
  const [estimate, gasPrice] = await Promise.all([client.estimateGas({ account: C.ACCOUNT, ...call }), client.getGasPrice()]);
  const transaction = { ...call, type: 'legacy', chainId: 56, nonce: ledger.nonce, gas: (estimate * 125n + 99n) / 100n, gasPrice: (gasPrice * 120n + 99n) / 100n };
  assertReservation(ledger.spent, transaction);
  return { action, salt, predicted: salt ? predictedToken(salt) : undefined, transaction, settled: false };
}
export function transactionForSigning(t) {
  return { to: t.to, data: t.data, value: BigInt(t.value), type: 'legacy', chainId: 56, nonce: t.nonce, gas: BigInt(t.gas), gasPrice: BigInt(t.gasPrice) };
}
export async function sendEntry({ client, account, entry, ledger, save, journal }) {
  requireThat(equal(account.address, C.ACCOUNT), '输入私钥对应的钱包不是固定验收钱包。');
  const s = await inspect(client), expected = nextAction(s);
  requireThat(entry.action === expected && entry.transaction.nonce === ledger.nonce && entry.transaction.chainId === 56 && entry.transaction.type === 'legacy', '待处理步骤、nonce 或交易类型不匹配。');
  requireThat(expected !== 'deployFactory' || ledger.nonce === 0, '固定部署 nonce 已消耗。');
  const call = callFor(expected, s, entry.salt), t = transactionForSigning(entry.transaction);
  requireThat(equal(t.to, call.to) && equal(t.data, call.data) && t.value === call.value, '待处理交易不在固定操作范围内。');
  if (entry.action === 'launch') requireThat(equal(entry.predicted, predictedToken(entry.salt)) && entry.predicted.toLowerCase().endsWith('7777'), '发射地址计算不匹配。');
  const reservation = assertReservation(ledger.spent, t);
  await checkNonce(client, ledger.nonce, Boolean(entry.hash));
  requireThat(await client.getBalance({ address: C.ACCOUNT }) >= reservation, '钱包余额不足以覆盖本笔金额和最大 Gas。');
  await client.call({ account: C.ACCOUNT, to: t.to, data: t.data, value: t.value, gas: t.gas });
  const raw = await account.signTransaction(t); // Kept only in process memory, never written to journal/logs.
  const hash = keccak256(raw);
  requireThat(!entry.hash || equal(entry.hash, hash), '重新签名结果与原交易哈希不一致，停止。');
  entry.hash = hash; await save(journal); // Local disk OR remote durable checkpoint must acknowledge before broadcast.
  const returnedHash = await client.sendRawTransaction({ serializedTransaction: raw });
  requireThat(equal(returnedHash, hash), 'RPC 返回哈希不匹配，请按已保存哈希核对。');
  return hash;
}

export const summary = (ledger, state) => `已核验 ${ledger.rows.length} 笔交易；累计支出（退款不抵扣、含 Gas）${formatEther(ledger.spent)} / 0.1 BNB；份额 ${state.total}/2；下一步 ${nextAction(state)}。`;
