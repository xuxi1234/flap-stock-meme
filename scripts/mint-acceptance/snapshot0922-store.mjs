import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { stringify, requireThat, Stop } from './core.mjs';
import { fresh as freshJournal, validate as validateJournal, callFor } from './snapshot0922-core.mjs';

// Keep the durable GitHub file below Contents API's 1 MB inline limit.
// Calldata is deterministic; actual deliveries are re-derived from verified receipts every run.
export const compact = j => ({...j, entries:j.entries.map(({received, ...e})=>{
  const {data, ...transaction}=e.transaction;return {...e,transaction};
})});
export const hydrate = j => ({...j,entries:j.entries.map(e=>({...e,transaction:{...e.transaction,data:callFor(e).data}}))});

export const REPOSITORY = 'xuxi1234/flap-stock-meme';
export const STATE_BRANCH = 'automation/airdrop-snapshot0922-ledger';
export const STATE_FILE = 'journal.json';
export const API_ROOT = `https://api.github.com/repos/${REPOSITORY}`;
export const blobSha = text => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

const delay=ms=>new Promise(r=>setTimeout(r,ms));
const transient=status=>[0,409,429,500,502,503,504].includes(status);
export function githubApi(token, fetcher = fetch, wait=delay) {
 requireThat(Boolean(token),'缺少 GitHub 自动提供的 GITHUB_TOKEN。');
 return async(method,endpoint,body,allowMissing=false)=>{
  requireThat(endpoint.startsWith('/')&&!endpoint.startsWith('//'),'非法 GitHub API 路径。');
  for(let attempt=0;attempt<3;attempt++){
   let response,status=0;
   try{response=await fetcher(API_ROOT+endpoint,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});status=response.status;}catch{}
   if(allowMissing&&status===404)return null;
   if(response?.ok){try{return await response.json();}catch{status=0;}}
   if(method==='GET'&&transient(status)&&attempt<2){await wait((attempt+1)*1000);continue;}
   throw Object.assign(new Stop(`GitHub ${method} 检查点请求失败（HTTP ${status}）；保留记录，不继续广播。`),{status});
  }
 };
}

export async function openGitHubStore({ api, readOnly = true, reportDirectory, wait=delay }) {
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
        for(let attempt=0;attempt<3;attempt++){
          try{
            const updated=await api('PUT',endpoint,{message:'Checkpoint snapshot0922 execution',branch:STATE_BRANCH,sha,content:Buffer.from(text).toString('base64')});
            requireThat(updated.content?.sha===blobSha(text),'GitHub 未确认预期检查点内容。');sha=updated.content.sha;break;
          }catch(e){
            if(!transient(e.status))throw e;
            // Resolve ambiguous writes by content. Never overwrite a different journal.
            const current=await api('GET',endpoint+query);
            requireThat(current.encoding==='base64'&&current.size<1000000,'远程记录编码或大小异常。');
            const actual=Buffer.from(current.content,'base64').toString('utf8');
            requireThat(blobSha(actual)===current.sha,'远程记录内容与哈希不一致。');
            if(actual===text){sha=current.sha;break;}
            requireThat(actual===previous,'检查点已被其他操作修改；停止，禁止覆盖原进度。');
            if(attempt===2)throw new Stop('GitHub 保存重试仍失败；已保留原检查点，不继续广播。');
            sha=current.sha;await wait((attempt+1)*1000);
          }
        }
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
