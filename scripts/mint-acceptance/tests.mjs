// Run with node --test; deliberately outside Vitest's *.test.* discovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { keccak256 } from 'viem';
import * as C from './config.mjs';
import { calculateBudget, assertReservation, nextAction, checkNonce, prepare, sendEntry, reconcile, freshJournal, receiptRecord, inspect, verifyEntry, transactionForSigning } from './core.mjs';
import { openStore, hiddenKeyPrompt } from './storage.mjs';

import { initial, row, fakeClient } from './fixtures.mjs';

test('gross budget counts refunded principal and historical/reverted gas', () => {
  assert.equal(calculateBudget([row(0, C.SHARE_PRICE), row(1, 0n), row(2, C.SHARE_PRICE, false)]), C.SHARE_PRICE + 300n);
  assert.throws(() => calculateBudget([row(0, C.BUDGET)], 1n), /超过/);
});
test('budget requires complete unique nonce history even if journal was deleted', () => {
  assert.throws(() => calculateBudget([row(0), row(2)]), /nonce 1/);
  assert.throws(() => calculateBudget([row(0), row(0)]), /同一 nonce/);
});
test('maximum gas reservation included and equality at cap is allowed', () => {
  const t = { gas: 100000n, gasPrice: 50000000n, value: 2n * C.SHARE_PRICE };
  const reserve = t.gas * t.gasPrice + t.value;
  assert.equal(assertReservation(C.BUDGET - reserve, t), reserve);
  assert.throws(() => assertReservation(C.BUDGET - reserve + 1n, t), /累计/);
  assert.throws(() => assertReservation(0n, { ...t, gasPrice: C.GAS_CAP }), /Gas/);
});
test('state machine handles zero, partial, funded, launched and claimed', () => {
  const s = initial(); assert.equal(nextAction(s), 'mint');
  s.total = s.shares = 1n; assert.equal(nextAction(s), 'mint');
  s.total = s.shares = 2n; assert.equal(nextAction(s), 'launch');
  s.launched = true; s.claimable = [100000n, 0n]; assert.equal(nextAction(s), 'claim');
  s.shares = 0n; s.claimed = 2n; assert.equal(nextAction(s), 'done');
});
test('expired, aborted, foreign shares and unproven claim block progression', () => {
  assert.throws(() => nextAction({ ...initial(), timestamp: BigInt(C.terms.deadline) }), /到期/);
  assert.throws(() => nextAction({ ...initial(), aborted: true }), /取消/);
  assert.throws(() => nextAction({ ...initial(), total: 1n }), /其他参与者/);
  assert.throws(() => nextAction({ ...initial(), launched: true }), /领取验收/);
});
test('nonce guard stops unknown confirmed or pending wallet transactions', async () => {
  const f = fakeClient(); await checkNonce(f, 5);
  f.pending = 6; await assert.rejects(checkNonce(f, 5), /nonce/); await checkNonce(f, 5, true);
  f.latest = 6; await assert.rejects(checkNonce(f, 5, true), /nonce/);
});
test('inspect rejects wrong chain, code or fixed recipient', async () => {
  const f = fakeClient(); await inspect(f); f.chainId = 97; await assert.rejects(inspect(f), /主网/);
  f.chainId = 56; f.getCode = async () => '0x12'; await assert.rejects(inspect(f), /字节码/);
  const g = fakeClient(), original = g.readContract;
  g.readContract = async p => p.functionName === 'commissionReceiver' ? C.FACTORY : original(p);
  await assert.rejects(inspect(g), /收益地址/);
});
test('prepare fills only missing shares and never broadcasts', async () => {
  const s = { ...initial(), total: 1n, shares: 1n }, f = fakeClient(s);
  const entry = await prepare(f, s, { nonce: 5, spent: C.SHARE_PRICE });
  assert.equal(entry.transaction.value, C.SHARE_PRICE); assert.equal(entry.transaction.to, C.CAMPAIGN); assert.equal(f.broadcasts, 0);
  f.gasPrice = 1000000000000n; await assert.rejects(prepare(f, s, { nonce: 5, spent: 0n }), /Gas/);
});
test('hash is saved before broadcast; network failure resumes the identical signed transaction', async () => {
  const f = fakeClient(), ledger = { nonce: 5, spent: C.SHARE_PRICE }, journal = freshJournal();
  const entry = await prepare(f, f.state, ledger); journal.entries.push(entry);
  const raw = '0x1234', signed = [], saved = [];
  const account = { address: C.ACCOUNT, signTransaction: async t => { signed.push(t); return raw; } };
  const save = j => saved.push(JSON.parse(JSON.stringify(j, (_, v) => typeof v === 'bigint' ? v.toString() : v)));
  f.sendRawTransaction = async () => { assert.equal(saved.at(-1).entries[0].hash, keccak256(raw)); throw Error('timeout after broadcast'); };
  await assert.rejects(sendEntry({ client: f, account, ledger, journal, entry, save }), /timeout/);
  assert.equal(entry.hash, keccak256(raw));
  f.sendRawTransaction = async ({ serializedTransaction }) => keccak256(serializedTransaction);
  await sendEntry({ client: f, account, ledger, journal, entry, save });
  assert.deepEqual(signed[0], signed[1]);
  assert.ok(!JSON.stringify(saved).includes(raw));
});
test('journal persistence failure prevents any broadcast', async () => {
  const f = fakeClient(), ledger = { nonce: 5, spent: 0n }, entry = await prepare(f, f.state, ledger);
  await assert.rejects(sendEntry({ client: f, ledger, entry, journal: freshJournal(), account: { address: C.ACCOUNT, signTransaction: async () => '0x12' }, save: () => { throw Error('disk full'); } }), /disk full/);
  assert.equal(f.broadcasts, 0);
});
test('wrong signer, tampered recipient and changed funding state cannot sign', async () => {
  const f = fakeClient(), ledger = { nonce: 5, spent: 0n }, entry = await prepare(f, f.state, ledger);
  let signs = 0; const account = { address: C.FACTORY, signTransaction: async () => { signs++; return '0x12'; } };
  const args = { client: f, account, entry, ledger, journal: freshJournal(), save: () => {} };
  await assert.rejects(sendEntry(args), /钱包/); account.address = C.ACCOUNT;
  entry.transaction.to = C.FACTORY; await assert.rejects(sendEntry(args), /操作范围/);
  entry.transaction.to = C.CAMPAIGN; f.state.total = f.state.shares = 1n; await assert.rejects(sendEntry(args), /操作范围/);
  assert.equal(signs, 0);
});
test('receipt verification rejects wrong wallet, insufficient confirmations and reorg', async () => {
  const f = fakeClient(), hash = C.CHECKPOINTS[0]; f.receiptRows.set(hash, row(0));
  assert.equal((await receiptRecord(f, hash)).feeWei, '100');
  f.receiptRows.get(hash).from = C.FACTORY; await assert.rejects(receiptRecord(f, hash), /发起钱包/);
  f.receiptRows.get(hash).from = C.ACCOUNT; f.getBlockNumber = async () => 100n; await assert.rejects(receiptRecord(f, hash), /确认/);
  f.getBlockNumber = async () => 112n; f.getBlock = async () => ({ hash: '0xdef' }); await assert.rejects(receiptRecord(f, hash), /重组/);
});
test('missing checkpoint or RPC error cannot be treated as an unsent transaction', async () => {
  const f = fakeClient(); await assert.rejects(reconcile(f, freshJournal(), () => {}), /回执暂不可用/);
  f.rpcError = true; await assert.rejects(reconcile(f, freshJournal(), () => {}), /HTTP failure/);
});
test('reconcile rechecks all five checkpoints and recovers confirmed transaction after crash', async () => {
  const f = fakeClient(); C.CHECKPOINTS.forEach((hash, n) => f.receiptRows.set(hash, row(n, n === 3 ? C.SHARE_PRICE : 0n)));
  const journal = freshJournal(), ledger = await reconcile(f, journal, () => {});
  assert.equal(ledger.nonce, 5); assert.equal(ledger.spent, C.SHARE_PRICE + 500n);
  const hash = '0x' + 'ab'.repeat(32), entry = { action: 'mint', hash, settled: false, transaction: { nonce: 5, to: C.CAMPAIGN, data: '0x12', value: '0', gas: '100', gasPrice: '10' } };
  journal.entries.push(entry); f.receiptRows.set(hash, { ...row(5, 0n, false), data: '0x12' });
  const recovered = await reconcile(f, journal, () => {});
  assert.equal(recovered.nonce, 6); assert.equal(entry.settled, true); assert.equal(entry.success, false); assert.equal(recovered.spent, C.SHARE_PRICE + 600n);
});
test('successful receipt needs matching event, target and payment', () => {
  const entry = { action: 'claim', transaction: { nonce: 5, to: C.CAMPAIGN, data: '0x12', value: '0', gas: '100', gasPrice: '10' } };
  const r = { ...row(5), to: C.CAMPAIGN, data: '0x12', gas: '100', gasPrice: '10' };
  assert.throws(() => verifyEntry(entry, r), /缺少预期事件/);
  r.events = [{ name: 'Claimed', args: { participant: C.ACCOUNT, receiver: C.FACTORY, tokens: 1n } }];
  assert.throws(() => verifyEntry(entry, r), /领取事件/);
  r.events[0].args.receiver = C.ACCOUNT; verifyEntry(entry, r);
});
test('store persists BigInts atomically, blocks concurrent runs, reloads pending hash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flap-runner-test-'));
  try {
    const first = openStore(dir), journal = freshJournal(); journal.entries.push({ action: 'mint', hash: C.CHECKPOINTS[0], transaction: { value: 2n * C.SHARE_PRICE }, settled: false });
    first.save(journal); assert.throws(() => openStore(dir), /执行锁/); first.close();
    const second = openStore(dir); assert.equal(second.journal.entries[0].hash, C.CHECKPOINTS[0]); assert.equal(second.journal.entries[0].transaction.value, '20000000000000000'); second.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('signing conversion accepts only the explicit legacy transaction fields', () => {
  const t = transactionForSigning({ to: C.CAMPAIGN, data: '0x12', value: '0', gas: '100', gasPrice: '10', nonce: 5, unrelated: 'do not forward' });
  assert.equal(t.chainId, 56); assert.equal(t.type, 'legacy'); assert.equal(t.unrelated, undefined);
});
test('non-interactive input cannot provide a private key', () => {
  if (!process.stdin.isTTY) assert.throws(() => hiddenKeyPrompt(), /交互终端/);
});
