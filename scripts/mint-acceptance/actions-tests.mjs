import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from './config.mjs';
import { actionsOptions, accountFromSecret } from './actions-run.mjs';
import { openGitHubStore, githubApi, blobSha, STATE_BRANCH, REPOSITORY } from './github-store.mjs';
import { freshJournal, stringify, sendEntry, prepare } from './core.mjs';
import { fakeClient } from './fixtures.mjs';
import { simulate } from './simulate.mjs';

const context = () => ({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: REPOSITORY, GITHUB_REF: 'refs/heads/main', FLAP_MINT_MODE: 'execute', FLAP_MINT_CONFIRMATION: 'EXECUTE 0.1 BNB' });
function remoteFixture(journal = null) {
  let text = journal ? stringify(journal) + '\n' : null, draft;
  const calls = [];
  const file = () => text === null ? null : ({ encoding: 'base64', content: Buffer.from(text).toString('base64'), sha: blobSha(text), size: Buffer.byteLength(text) });
  const api = async (method, endpoint, body) => {
    calls.push({ method, endpoint, body });
    if (method === 'GET') return file();
    if (endpoint === '/git/trees') { draft = body.tree.find(x => x.path === 'journal.json').content; return { sha: 'tree' }; }
    if (endpoint === '/git/commits') { assert.deepEqual(body.parents, []); return { sha: 'commit' }; }
    if (endpoint === '/git/refs') { assert.equal(body.ref, `refs/heads/${STATE_BRANCH}`); assert.equal(text, null); text = draft; return { object: { sha: 'commit' } }; }
    if (method === 'PUT') { assert.equal(body.branch, STATE_BRANCH); if (body.sha !== file().sha) throw Error('CAS conflict'); text = Buffer.from(body.content, 'base64').toString(); return { content: { sha: blobSha(text) } }; }
    throw Error('Unexpected API request');
  };
  return { api, calls, current: () => text };
}

test('only manual dispatch in the fixed repo and main branch can execute', () => {
  assert.equal(actionsOptions(context()).execute, true);
  for (const [key, value] of [['GITHUB_EVENT_NAME', 'push'], ['GITHUB_EVENT_NAME', 'pull_request'], ['GITHUB_REPOSITORY', 'another/repo'], ['GITHUB_REF', 'refs/heads/preview'], ['FLAP_MINT_CONFIRMATION', 'yes']]) {
    assert.throws(() => actionsOptions({ ...context(), [key]: value }));
  }
});
test('check mode never accesses the private-key Secret', () => {
  const env = { ...context(), FLAP_MINT_MODE: 'check' };
  Object.defineProperty(env, 'FLAP_MINT_PRIVATE_KEY', { get() { throw Error('Secret accessed in check mode'); } });
  assert.equal(actionsOptions(env).execute, false); assert.throws(() => accountFromSecret(env), /只读模式/);
});
test('Secret is consumed in memory and wrong wallet is rejected', () => {
  const env = { ...context(), FLAP_MINT_PRIVATE_KEY: 'f'.repeat(64) }; // Format-only sentinel; converter is mocked, no key is used.
  const account = accountFromSecret(env, () => ({ address: C.ACCOUNT })); assert.equal(account.address, C.ACCOUNT); assert.equal(env.FLAP_MINT_PRIVATE_KEY, undefined);
  assert.throws(() => accountFromSecret({ ...context(), FLAP_MINT_PRIVATE_KEY: 'f'.repeat(64) }, () => ({ address: C.FACTORY })), /对应地址不匹配/);
});
test('import input cannot inject shell commands or wallet parameters', () => {
  assert.throws(() => actionsOptions({ ...context(), FLAP_MINT_IMPORT_HASHES: '$(execute)' }), /格式无效/);
  assert.deepEqual(actionsOptions({ ...context(), FLAP_MINT_IMPORT_HASHES: C.CHECKPOINTS.slice(0, 2).join('\n') }).imports, C.CHECKPOINTS.slice(0, 2));
});
test('read-only GitHub check does not create or update a state branch', async () => {
  const remote = remoteFixture(), store = await openGitHubStore({ api: remote.api });
  await store.save(store.journal); assert.deepEqual(remote.calls.map(c => c.method), ['GET']);
});
test('new durable state uses an orphan branch and acknowledges exact content', async () => {
  const remote = remoteFixture(), store = await openGitHubStore({ api: remote.api, readOnly: false });
  await store.save(store.journal);
  assert.equal(remote.calls.find(c => c.endpoint === '/git/trees').body.tree.find(f => f.path === 'vercel.json').content, '{"git":{"deploymentEnabled":false}}\n');
  assert.equal(JSON.parse(remote.current()).account, C.ACCOUNT);
  assert.ok(remote.calls.every(c => !JSON.stringify(c).includes('FLAP_MINT_PRIVATE_KEY')));
});
test('fresh runner restores pending hash and concurrent state updates fail', async () => {
  const remote = remoteFixture(freshJournal());
  const first = await openGitHubStore({ api: remote.api, readOnly: false }), stale = await openGitHubStore({ api: remote.api, readOnly: false });
  first.journal.entries.push({ action: 'mint', hash: C.CHECKPOINTS[0], settled: false }); await first.save(first.journal);
  const resumed = await openGitHubStore({ api: remote.api, readOnly: false }); assert.equal(resumed.journal.entries[0].hash, C.CHECKPOINTS[0]);
  stale.journal.imports.push(C.CHECKPOINTS[1]); await assert.rejects(stale.save(stale.journal), /CAS conflict/);
});
test('remote corruption or unacknowledged content stops execution', async () => {
  const remote = remoteFixture(freshJournal());
  await assert.rejects(openGitHubStore({ api: async (...args) => ({ ...await remote.api(...args), sha: 'wrong' }) }), /blob 哈希/);
  const store = await openGitHubStore({ api: async (method, ...rest) => method === 'PUT' ? { content: { sha: 'wrong' } } : remote.api(method, ...rest), readOnly: false });
  store.journal.imports.push(C.CHECKPOINTS[0]); await assert.rejects(store.save(store.journal), /未确认/);
});
test('failed asynchronous remote save cannot broadcast a signed transaction', async () => {
  const f = fakeClient(), ledger = { nonce: 5, spent: 0n }, entry = await prepare(f, f.state, ledger);
  await assert.rejects(sendEntry({ client: f, entry, ledger, journal: freshJournal(), account: { address: C.ACCOUNT, signTransaction: async () => '0x12' }, save: async () => { await Promise.resolve(); throw Error('remote save failed'); } }), /remote save failed/);
  assert.equal(f.broadcasts, 0);
});
test('GitHub API errors redact server bodies and network error text', async () => {
  const denied = githubApi('sentinel', async () => ({ ok: false, status: 403, text: async () => 'DO NOT PRINT THIS' }));
  await assert.rejects(denied('PUT', '/contents/journal.json', {}), e => e.message.includes('403') && !e.message.includes('DO NOT'));
  const failed = githubApi('sentinel', async () => { throw Error('DO NOT PRINT THIS'); });
  await assert.rejects(failed('GET', '/contents/journal.json'), e => !e.message.includes('DO NOT'));
});
test('offline full sequence recovers response loss without duplicate operations', async () => {
  const result = await simulate({ loseBroadcastResponse: true }); assert.deepEqual(result.operations, ['mint', 'launch', 'claim']);
  assert.equal(result.networkBroadcasts, 0); assert.equal(result.privateKeysUsed, 0); assert.equal(result.journal.entries.length, 3);
  assert.ok(BigInt(result.simulatedSpentWei) < C.BUDGET);
});
test('workflow scopes the wallet Secret to the manual execute step and never interpolates raw inputs in shell', () => {
  const yaml = fs.readFileSync(new URL('../../.github/workflows/mint-acceptance.yml', import.meta.url), 'utf8');
  assert.equal((yaml.match(/secrets\.FLAP_MINT_PRIVATE_KEY/g) || []).length, 1);
  assert.ok(yaml.indexOf('secrets.FLAP_MINT_PRIVATE_KEY') > yaml.indexOf('\n  execute:'));
  assert.match(yaml, /cancel-in-progress: false/); assert.match(yaml, /workflow_dispatch:/);
  assert.ok(!/^\s+(push|pull_request|schedule):/m.test(yaml));
  assert.ok(!/run:.*\$\{\{\s*inputs\./.test(yaml));
});
