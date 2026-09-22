import {BATCHES} from './snapshot0922-core.mjs';
import { pathToFileURL } from 'node:url';
import { Stop,requireThat } from './core.mjs';
import { dueAt } from './snapshot0922-schedule.mjs';
import { main,assertPrior72 } from './snapshot0922-main.mjs';
import { openGitHubStore,githubApi } from './snapshot0922-store.mjs';
const completed=j=>j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length;
export async function runSlot({load,execute,now=()=>Math.floor(Date.now()/1000),sleep=ms=>new Promise(r=>setTimeout(r,ms)),log=console.log}){
 let j=await load();const before=completed(j);
 if(before>=BATCHES){log('固定批次已完成，本排队步骤不再发币。');return;}
 requireThat(!j.entries.some(e=>e.settled&&!e.success),'已有失败交易，保留记录并停止。');
 const timeout=now()+75*60;
 while(now()<timeout){
  const target=dueAt(j);
  while(now()<target){
   requireThat(target<timeout,'等待时间异常，停止而不提前发币。');
   const remaining=target-now();log(`已完成${completed(j)}/${BATCHES}轮，距下一轮至少${remaining}秒。`);
   await sleep(Math.min(remaining,60)*1000);
  }
  // main independently reloads and verifies all receipts, nonce, budget,
  // authorization and chain timestamps before it can sign anything.
  await execute();
  j=await load();
  requireThat(!j.entries.some(e=>e.settled&&!e.success),'已有失败交易，保留记录并停止。');
  if(completed(j)>before||completed(j)>=BATCHES){log(`本步骤结束，已完成${completed(j)}/${BATCHES}轮。`);return;}
  // The chain clock may lag wall time. Never force or bypass its due gate.
  await sleep(3000);
 }
 throw new Stop('本步骤等待超时，保留记录后停止；后续可从原任务继续。');
}
export async function mainChain(env=process.env){
 requireThat(env.GITHUB_ACTIONS==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_REPOSITORY==='xuxi1234/flap-stock-meme'&&env.GITHUB_REF==='refs/heads/main'&&env.SNAPSHOT0922_CONFIRM==='snapshot0922x0.7777:200:3600seconds:gas-unlimited','串行续跑只允许用户在本仓库main手动确认后启动。');
 const api=githubApi(env.GITHUB_TOKEN);
 // Each matrix job is a fresh process: derive the nonce before loading its checkpoint.
 await assertPrior72(api);
 await runSlot({load:async()=>(await openGitHubStore({api,readOnly:true})).journal,execute:()=>main({...env,SNAPSHOT0922_OPERATION:'start',SNAPSHOT0922_PHASE:'execute'})});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)mainChain().catch(e=>{
 console.error(e instanceof Stop?e.message:'串行续跑遇到读取或检查点错误；原交易记录已保留，未输出请求或私钥。');process.exitCode=1;
});
