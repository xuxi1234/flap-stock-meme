import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256, decodeFunctionData, decodeAbiParameters } from 'viem';
import * as C from './config.mjs';
import { checkCompilation } from './compile-check.mjs';
import { inspect, nextAction, calculateBudget, reconcile, freshJournal, validateJournal, prepare, callFor, verifyEntry, sendEntry } from './core.mjs';
import { initial, row, legacyRow, fakeClient } from './fixtures.mjs';
import { simulate } from './simulate.mjs';

test('pinned compiler reproduces deployment bytecode, runtime templates and complete ABI', checkCompilation);
test('immutable patches reproduce the independently observed legacy runtime hashes', () => {
  const old = { account: C.LEGACY_ACCOUNT, factory: C.LEGACY_FACTORY, implementation: C.LEGACY_IMPLEMENTATION, portal: C.VAULT_PORTAL };
  assert.equal(keccak256(C.runtimeCode('factory', old)), C.LEGACY_FACTORY_CODE_HASH);
  assert.equal(keccak256(C.runtimeCode('implementation', old)), C.LEGACY_IMPLEMENTATION_CODE_HASH);
  const args = decodeAbiParameters(C.factoryAbi.find(a => a.type === 'constructor').inputs, '0x' + C.DEPLOY_DATA.slice(C.deployment.bytecode.length));
  assert.deepEqual(args, [C.ACCOUNT, C.ACCOUNT, C.VAULT_PORTAL]);
});
test('both wallets share one budget while their nonce sequences remain independent', () => {
  const rows = [legacyRow(0, C.SHARE_PRICE), row(0, 2n * C.SHARE_PRICE)];
  assert.equal(calculateBudget(rows), 3n * C.SHARE_PRICE + 200n);
  assert.throws(() => calculateBudget(rows, C.BUDGET - 3n * C.SHARE_PRICE), /超过/);
  assert.throws(() => calculateBudget([...rows, { ...row(2) }]), /nonce 1/);
  assert.throws(() => calculateBudget([...rows, legacyRow(0)]), /同一 nonce/);
});
test('migration preserves old checkpoints but refuses to discard additional old operations', () => {
  const old = { version: 1, account: C.LEGACY_ACCOUNT, campaign: C.LEGACY_CAMPAIGN, entries: [], imports: [], spentWei: '10548475729141262' };
  const migrated = structuredClone(old); validateJournal(migrated);
  assert.equal(migrated.version, 2); assert.equal(migrated.account, C.ACCOUNT);
  assert.equal(migrated.legacySnapshot.spentWei, old.spentWei);
  assert.throws(() => validateJournal({ ...old, entries: [{ hash: C.CHECKPOINTS[0] }] }), /不能自动清空/);
  assert.throws(() => validateJournal({ ...old, imports: [C.CHECKPOINTS[0]] }), /不能自动清空/);
});
test('legacy unknown or pending transactions cannot disappear from the total budget', async () => {
  const f = fakeClient(); C.CHECKPOINTS.forEach((h, n) => f.receiptRows.set(h, legacyRow(n)));
  f.legacyPending = 6; await assert.rejects(reconcile(f, freshJournal(), () => {}), /旧钱包/);
  f.legacyNonce = 6; await assert.rejects(reconcile(f, freshJournal(), () => {}), /旧钱包/);
});
test('legacy funded or launched escrow blocks new deployment', async () => {
  const f = fakeClient({ ...initial(), stage: 'deployFactory' }); f.legacyTotal = 1n;
  await assert.rejects(inspect(f), /旧项目/); f.legacyTotal = 0n; f.legacyLaunched = true;
  await assert.rejects(inspect(f), /旧项目/);
});
test('new deployment uses nonce zero, exact constructor arguments and zero BNB value', async () => {
  const f = fakeClient({ ...initial(), stage: 'deployFactory' }); f.latest = f.pending = 0;
  const s = await inspect(f); assert.equal(nextAction(s), 'deployFactory');
  const entry = await prepare(f, s, { nonce: 0, spent: C.SHARE_PRICE });
  assert.equal(entry.transaction.data, C.DEPLOY_DATA); assert.equal(entry.transaction.to, undefined); assert.equal(entry.transaction.value, 0n);
  await assert.rejects(prepare(f, s, { nonce: 1, spent: 0n }), /nonce 0/);
  await assert.rejects(prepare(f, s, { nonce: 0, spent: C.BUDGET }), /累计/);
  const receipt = { ...row(0), to: null, contractAddress: C.FACTORY, data: C.DEPLOY_DATA, gas: entry.transaction.gas, gasPrice: entry.transaction.gasPrice };
  verifyEntry(entry, receipt); receipt.contractAddress = C.LEGACY_FACTORY;
  assert.throws(() => verifyEntry(entry, receipt), /部署回执/);
});
test('createCampaign is fixed and cannot run after another factory creation or near expiry', async () => {
  const f = fakeClient({ ...initial(), stage: 'createCampaign' });
  const state = await inspect(f); assert.equal(nextAction(state), 'createCampaign');
  const call = callFor('createCampaign', state); assert.equal(call.to, C.FACTORY); assert.equal(call.value, 0n);
  const decoded = decodeFunctionData({ abi: C.factoryAbi, data: call.data });
  assert.equal(decoded.functionName, 'createCampaign'); assert.equal(decoded.args[0].deadline, BigInt(C.terms.deadline));
  f.getTransactionCount = async () => 3; await assert.rejects(inspect(f), /其他项目/);
  assert.throws(() => nextAction({ ...state, timestamp: BigInt(C.terms.deadline) - 3599n }), /不足一小时/);
});
test('constructor tampering cannot sign even with the correct wallet', async () => {
  const f = fakeClient({ ...initial(), stage: 'deployFactory' }); f.latest = f.pending = 0;
  const ledger = { nonce: 0, spent: 0n }, entry = await prepare(f, await inspect(f), ledger);
  entry.transaction.data = entry.transaction.data.slice(0, -2) + 'ff'; let signed = 0;
  await assert.rejects(sendEntry({ client: f, ledger, entry, journal: freshJournal(), save: () => {}, account: { address: C.ACCOUNT, signTransaction: async () => { signed++; } } }), /操作范围/);
  assert.equal(signed, 0); assert.equal(f.broadcasts, 0);
});
for (const loseAt of ['deployFactory', 'createCampaign', 'mint', 'launch', 'claim']) test(`durable recovery after ${loseAt} avoids duplicate deployment and payments`, async () => {
  const report = await simulate({ loseBroadcastResponse: true, loseAt });
  assert.deepEqual(report.operations, ['deployFactory', 'createCampaign', 'mint', 'launch', 'claim']);
  assert.equal(report.journal.results.length, 10); assert.equal(report.crashRecoveryExercised, true);
  assert.equal(report.journal.entries.length, 5); assert.ok(report.journal.entries.every(e => e.settled && e.success));
  assert.ok(report.journal.results.slice(0, 5).every(r => r.from === C.LEGACY_ACCOUNT));
});
