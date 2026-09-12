import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createPublicClient,http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { Stop,requireThat } from './core.mjs';
import { fresh } from './timed-airdrop-core.mjs';
import { run,report } from './timed-airdrop-run.mjs';
import { openGitHubStore,githubApi,REPOSITORY } from './timed-airdrop-store.mjs';
import { authorize,shouldWake,recoveryFingerprint,readyForExecution } from './timed-airdrop-schedule.mjs';
export function options(env){
 const operation=env.TIMED_OPERATION||'check',execute=env.TIMED_PHASE==='execute';
 requireThat(['check','start','pause','tick'].includes(operation),'定时操作无效。');
 if(execute||operation==='start'||operation==='pause'){
  requireThat(env.GITHUB_ACTIONS==='true'&&env.GITHUB_REPOSITORY===REPOSITORY&&env.GITHUB_REF==='refs/heads/main','定时执行只允许本仓库main。');
  requireThat(operation==='tick'?env.GITHUB_EVENT_NAME==='schedule':env.GITHUB_EVENT_NAME==='workflow_dispatch','触发来源不符合操作类型。');
 }
 requireThat(!execute||operation!=='check','只读操作不能执行。');
 return {operation,execute};
}
export async function main(env=process.env){
 const {operation,execute}=options(env);
 const output=ready=>{if(env.GITHUB_OUTPUT)fs.appendFileSync(env.GITHUB_OUTPUT,`ready=${ready}\n`);};output(false);
 const store=env.GITHUB_TOKEN?await openGitHubStore({api:githubApi(env.GITHUB_TOKEN),readOnly:!execute,reportDirectory:env.AIRDROP_REPORT_DIR}):{journal:fresh(),save:async()=>requireThat(!execute,'执行需要GitHub持久检查点。')};
 const j=store.journal;const before=recoveryFingerprint(j);
 if(operation==='pause'){
  if(execute){j.active=false;await store.save(j);console.log('已暂停，保留原名单和所有已发送记录。');}else output(true);
  return;
 }
 if(operation==='start'){authorize(j,env);if(execute)await store.save(j);}
 if(operation==='tick'&&!shouldWake(j,Math.floor(Date.now()/1000))){console.log('任务未启动、已暂停、已完成或尚未到下一轮时间。');return;}
 const primary=env.FLAP_BSC_RPC_URL||'https://bsc-dataseed.bnbchain.org',secondary='https://bsc-dataseed1.defibit.io';
 requireThat(new URL(primary).protocol==='https:'&&primary!==secondary,'需要两个不同HTTPS节点。');
 const clients=[primary,secondary].map(url=>createPublicClient({chain:bsc,transport:http(url,{timeout:25000,retryCount:1})}));
 try{
  await run({clients,store,execute,ownedReturnConfirmed:true,reportDirectory:env.AIRDROP_REPORT_DIR,accountProvider:async()=>{
   let key=(env.FLAP_MINT_PRIVATE_KEY||'').trim();delete env.FLAP_MINT_PRIVATE_KEY;
   if(key&&!key.startsWith('0x'))key='0x'+key;
   requireThat(/^0x[0-9a-fA-F]{64}$/.test(key),'缺少有效专用钱包Secret。');const account=privateKeyToAccount(key);key='';return account;
  }});
  if(!execute&&['start','tick'].includes(operation))output(readyForExecution(operation,before,j,Number((await clients[0].getBlock()).timestamp)));
 }finally{
  if(execute&&j.entries.some(e=>e.settled&&!e.success)){j.active=false;await store.save(j);}
  report(j,env.AIRDROP_REPORT_DIR);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{
 console.error(e instanceof Stop?e.message:'定时任务停止：节点或检查点请求未完成。保留原记录，未输出私钥或底层请求内容。');process.exitCode=1;
});
