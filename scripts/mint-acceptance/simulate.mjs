import { pathToFileURL } from 'node:url';
import { decodeFunctionData, encodeEventTopics, encodeAbiParameters, keccak256 } from 'viem';
import * as C from './config.mjs';
import { freshJournal, stringify, inspect, nextAction, prepare, sendEntry, reconcile, predictedToken, requireThat } from './core.mjs';
import { initial, row, legacyRow, fakeClient } from './fixtures.mjs';

function eventLog(name, args) {
  const isFactory = name === 'CampaignCreated';
  const abi = (isFactory ? C.factoryAbi : C.campaignAbi).find(a => a.type === 'event' && a.name === name);
  const plain = abi.inputs.filter(i => !i.indexed);
  return { address: isFactory ? C.FACTORY : C.CAMPAIGN, topics: encodeEventTopics({ abi: [abi], eventName: name, args }), data: encodeAbiParameters(plain, plain.map(i => args[i.name])) };
}

export async function simulate({ loseBroadcastResponse = false, loseAt = 'deployFactory' } = {}) {
  const f = fakeClient({ ...initial(), stage: 'deployFactory' }), operations = [];
  f.latest = f.pending = 0;
  C.CHECKPOINTS.forEach((h, n) => f.receiptRows.set(h, legacyRow(n, n === 3 ? C.SHARE_PRICE : 0n)));
  let journal = freshJournal(), durable = '', writes = 0, simulatedLoss = false;
  const save = async j => { await Promise.resolve(); durable = stringify(j); writes++; };
  const account = { address: C.ACCOUNT, signTransaction: async t => '0x' + Buffer.from(stringify(t)).toString('hex') };
  f.sendRawTransaction = async ({ serializedTransaction }) => {
    const t = JSON.parse(Buffer.from(serializedTransaction.slice(2), 'hex').toString()), hash = keccak256(serializedTransaction);
    requireThat(JSON.parse(durable).entries.at(-1).hash === hash, '模拟失败：广播前没有远程哈希检查点。');
    requireThat(t.nonce === f.latest, '模拟失败：出现重复 nonce。');
    const decoded = !t.to ? { functionName: 'deployFactory' } : decodeFunctionData({ abi: t.to === C.FACTORY ? C.factoryAbi : C.campaignAbi, data: t.data }); let log;
    if (decoded.functionName === 'deployFactory') {
      requireThat(t.data === C.DEPLOY_DATA, 'Unexpected deployment bytecode'); f.state.stage = 'createCampaign';
    } else if (decoded.functionName === 'createCampaign') {
      delete f.state.stage;
      log = eventLog('CampaignCreated', { campaign: C.CAMPAIGN, creator: C.ACCOUNT, targetShares: 2n, deadline: BigInt(C.terms.deadline) });
    } else if (decoded.functionName === 'mint') {
      const shares = decoded.args[0]; f.state.total += shares; f.state.shares += shares;
      log = eventLog('Minted', { participant: C.ACCOUNT, shares, amount: BigInt(t.value) });
    } else if (decoded.functionName === 'launch') {
      f.state.launched = true; f.state.token = predictedToken(decoded.args[0]); f.state.claimable = [1000000n * 10n ** 18n, 0n];
      log = eventLog('Launched', { token: f.state.token, shares: 2n, spent: 2n * C.SHARE_PRICE, tokens: f.state.claimable[0], returnedBnb: 0n });
    } else if (decoded.functionName === 'claim') {
      log = eventLog('Claimed', { participant: C.ACCOUNT, receiver: decoded.args[0], shares: f.state.shares, tokens: f.state.claimable[0], bnb: 0n });
      f.state.tokenBalance = f.state.claimable[0] * 97n / 100n; f.state.claimed = f.state.shares; f.state.shares = 0n; f.state.claimable = [0n, 0n];
    } else throw Error('Unexpected simulated operation');
    operations.push(decoded.functionName);
    f.receiptRows.set(hash, { ...row(t.nonce, BigInt(t.value), true, BigInt(t.gasPrice) * 80000n), to: t.to || null, contractAddress: t.to ? null : C.FACTORY, data: t.data, gas: t.gas, gasPrice: t.gasPrice, gasUsed: 80000n, logs: log ? [log] : [] });
    f.latest++; f.pending = f.latest;
    if (loseBroadcastResponse && !simulatedLoss && decoded.functionName === loseAt) { simulatedLoss = true; throw Error('simulated response lost after inclusion'); }
    return hash;
  };
  for (let n = 0; n < 7; n++) {
    const ledger = await reconcile(f, journal, save), state = await inspect(f);
    if (nextAction(state) === 'done') break;
    const entry = await prepare(f, state, ledger, { saltFactory: async () => '0x96eea91af7a4e148e5913d1c843b4649110d8087449f1858d23a4f1fe44dbaa1' });
    journal.entries.push(entry); await save(journal);
    try { await sendEntry({ client: f, account, entry, ledger, save, journal }); }
    catch (error) {
      if (error.message !== 'simulated response lost after inclusion') throw error;
      journal = JSON.parse(durable); // A fresh Actions runner restores GitHub state after a hard interruption.
    }
  }
  const ledger = await reconcile(f, journal, save);
  requireThat(nextAction(await inspect(f)) === 'done' && operations.join(',') === 'deployFactory,createCampaign,mint,launch,claim', '模拟执行步骤缺失或发生重复。');
  return { mode: 'OFFLINE SIMULATION ONLY', networkBroadcasts: 0, privateKeysUsed: 0, operations, crashRecoveryExercised: simulatedLoss, durableWrites: writes,
    simulatedSpentWei: ledger.spent.toString(), maximumBudgetWei: C.BUDGET.toString(), journal };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    for (const loseBroadcastResponse of [false, true]) {
      const { journal, ...report } = await simulate({ loseBroadcastResponse }); console.log(stringify(report));
    }
  } catch { console.error('离线模拟失败；没有调用主网或读取私钥。'); process.exitCode = 1; }
}
