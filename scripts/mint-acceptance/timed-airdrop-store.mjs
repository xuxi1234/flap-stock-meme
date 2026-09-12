import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { stringify, requireThat, Stop } from './core.mjs';
import { fresh as freshJournal, validate as validateJournal, callFor } from './timed-airdrop-core.mjs';

// Keep the durable GitHub file below Contents API's 1 MB inline limit.
// Calldata is deterministic; actual deliveries are re-derived from verified receipts every run.
export const compact = j => ({...j, entries:j.entries.map(({received, ...e})=>{
  const {data, ...transaction}=e.transaction;return {...e,transaction};
})});
export const hydrate = j => ({...j,entries:j.entries.map(e=>({...e,transaction:{...e.transaction,data:callFor(e).data}}))});

export const REPOSITORY = 'xuxi1234/flap-stock-meme';
export const STATE_BRANCH = 'automation/airdrop-30x200-timed-ledger';
export const STATE_FILE = 'journal.json';
export const API_ROOT = `https://api.github.com/repos/${REPOSITORY}`;
export const blobSha = text => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export function githubApi(token, fetcher = fetch) {
  requireThat(Boolean(token), '缺少 GitHub 自动提供的 GITHUB_TOKEN。');
  return async (method, endpoint, body, allowMissing = false) => {
    requireThat(endpoint.startsWith('/') && !endpoint.startsWith('//'), '非法 GitHub API 路径。');
    let response;
    try {
      response = await fetcher(API_ROOT + endpoint, { method, redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch { throw new Stop('GitHub 检查点请求未完成；不会继续广播。下次运行先恢复远程记录。'); }
    if (allowMissing && response.status === 404) return null;
    requireThat(response.ok, `GitHub 检查点保存或读取失败（HTTP ${response.status}）；不会继续广播。`);
    return response.json(); // Do not log response bodies or authorization headers.
  };
}

export async function openGitHubStore({ api, readOnly = true, reportDirectory }) {
  const endpoint = `/contents/${STATE_FILE}`;
  const query = `?ref=${encodeURIComponent(STATE_BRANCH)}`;
  const existing = await api('GET', endpoint + query, undefined, true);
  let sha, previous;
  let journal = freshJournal();
  if (existing) {
    requireThat(existing.encoding === 'base64' && existing.size < 1000000, '远程记录编码或大小异常。');
    previous = Buffer.from(existing.content, 'base64').toString('utf8');
    requireThat(blobSha(previous) === existing.sha, '远程记录内容与 GitHub blob 哈希不一致。');
    journal = hydrate(JSON.parse(previous)); validateJournal(journal); sha = existing.sha;
  }
  const save = async value => {
    validateJournal(value);
    const text = stringify(compact(value)) + '\n';
    if (!readOnly && previous !== text) {
      if (!sha) {
        // An orphan branch contains only public execution state and no website source.
        // Branch creation is atomic; a concurrent initializer fails instead of overwriting it.
        const tree = await api('POST', '/git/trees', { tree: [
          { path: STATE_FILE, mode: '100644', type: 'blob', content: text },
          { path: 'vercel.json', mode: '100644', type: 'blob', content: '{"git":{"deploymentEnabled":false}}\n' },
          { path: 'README.md', mode: '100644', type: 'blob', content: '# Airdrop execution checkpoints\nPublic transaction state only. No private keys or signed raw transactions. Do not reset this branch.\n' },
        ] });
        const commit = await api('POST', '/git/commits', { message: 'Initialize public Airdrop execution checkpoint', tree: tree.sha, parents: [] });
        await api('POST', '/git/refs', { ref: `refs/heads/${STATE_BRANCH}`, sha: commit.sha });
        // Confirm the acknowledged state actually contains the exact journal before any broadcast.
        const confirmed = await api('GET', endpoint + query);
        requireThat(confirmed.sha === blobSha(text), 'GitHub 新建检查点内容不匹配。');
        sha = confirmed.sha;
      } else {
        // GitHub rejects stale blob SHAs: a lost update cannot silently overwrite newer state.
        const updated = await api('PUT', endpoint, { message: 'Checkpoint Airdrop execution before next network action', branch: STATE_BRANCH, sha, content: Buffer.from(text).toString('base64') });
        requireThat(updated.content?.sha === blobSha(text), 'GitHub 未确认预期检查点内容。');
        sha = updated.content.sha;
      }
      previous = text;
    }
    if (reportDirectory) {
      fs.mkdirSync(reportDirectory, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(reportDirectory, 'journal.json'), text, { mode: 0o600 });
    }
  };
  return { journal, save, journalPath: `GitHub ${STATE_BRANCH}/${STATE_FILE}`, close() {} };
}
