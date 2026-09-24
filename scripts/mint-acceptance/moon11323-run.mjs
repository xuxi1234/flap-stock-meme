import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createPublicClient,http,formatEther} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {bsc} from 'viem/chains';
import {Stop,requireThat,equal,ACCOUNT,TOKEN,DISTRIBUTOR,AMOUNT,TOTAL,CONFIRM,BATCHES,plan,artifact,erc20,callFor,completed,dueAt,next,validate,deliveries,persistThenBroadcast,batchId} from './moon11323-core.mjs';
import {githubApi,openGitHubStore,REPOSITORY} from './moon11323-store.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function retry(fn){for(let i=0;i<3;i++){try{return await fn();}catch(e){if(e instanceof Stop||i===2)throw e;await sleep(1500);}}}
const groups=async(items,fn)=>{const out=[];for(let i=0;i<items.length;i+=4)out.push(...await Promise.all(items.slice(i,i+4).map(fn)));return out;};
const read=(c,f,args=[])=>c.readContract({address:TOKEN,abi:erc20,functionName:f,args});
export async function inspect(clients){
 const states=await Promise.all(clients.map(async c=>{
  const [chain,code,decimals,balance,allowance,bnb]=await Promise.all([c.getChainId(),c.getCode({address:DISTRIBUTOR}),read(c,'decimals'),read(c,'balanceOf',[ACCOUNT]),read(c,'allowance',[ACCOUNT,DISTRIBUTOR]),c.getBalance({address:ACCOUNT})]);
  requireThat(chain===56&&equal(code,artifact.runtime)&&decimals===18,'网络、分发合约或代币精度不符。');
  return {balance,allowance,bnb};
 }));
 requireThat(states.every(s=>s.balance===states[0].balance&&s.allowance===states[0].allowance&&s.bnb===states[0].bnb),'双节点余额或授权不一致。');return states[0];
}
export async function confirmedBlocks(clients,r,{pause=sleep,now=Date.now,timeout=120000}={}){
 const deadline=now()+timeout;
 for(;;){
  const blocks=await Promise.all(clients.map(c=>c.getBlock({blockNumber:BigInt(r.blockNumber)})));
  requireThat(blocks.every(b=>equal(b.hash,r.blockHash)&&b.timestamp===blocks[0].timestamp),'交易区块不一致，停止核验。');
  const heads=await Promise.all(clients.map(c=>c.getBlockNumber({cacheTime:0})));
  if(heads.every(h=>h-BigInt(r.blockNumber)+1n>=12n))return blocks;
  requireThat(now()<deadline,'等待双节点12确认超时；已保存交易哈希，请稍后继续。');
  await pause(3000);
 }
}
async function reconcile(clients,j,save){
 await groups(j.entries,async e=>{
  if(!e.hash)return;
  const rs=await Promise.all(clients.map(c=>c.request({method:'eth_getTransactionReceipt',params:[e.hash]})));
  if(rs.every(r=>!r)){requireThat(!e.settled,'已确认回执暂不可用。');return;}
  const fp=r=>r&&JSON.stringify([r.transactionHash,r.blockHash,r.blockNumber,r.status,r.gasUsed,r.effectiveGasPrice,r.logs.map(l=>[l.address,l.topics,l.data])]);
  requireThat(rs[0]&&rs[1]&&fp(rs[0])===fp(rs[1]),'双节点回执不一致。');
  const r=rs[0],t=e.transaction;
  const txs=await Promise.all(clients.map(c=>c.request({method:'eth_getTransactionByHash',params:[e.hash]})));
  requireThat(txs.every(x=>x&&equal(x.hash,e.hash)&&equal(x.from,ACCOUNT)&&equal(x.to,t.to)&&equal(x.input,t.data)&&BigInt(x.value)===0n&&Number(BigInt(x.nonce))===t.nonce&&BigInt(x.chainId)===56n&&BigInt(x.gas)===BigInt(t.gas)&&BigInt(x.gasPrice)===BigInt(t.gasPrice)&&equal(x.blockHash,r.blockHash)),'交易与保存参数不符。');
  const blocks=await confirmedBlocks(clients,r);
  e.settled=true;e.success=r.status==='0x1';e.confirmedAt=Number(blocks[0].timestamp);e.feeWei=(BigInt(r.gasUsed)*BigInt(r.effectiveGasPrice)).toString();
  if(e.success)e.received=deliveries(e,r.logs);
 });
 validate(j);await save(j);requireThat(j.entries.every(e=>!e.settled||e.success),'已有失败交易，已保存回执，停止自动重试。');
}
async function mappings(clients,j){
 await groups(Array.from({length:BATCHES},(_,i)=>i),async i=>{
  const flags=await Promise.all(clients.map(c=>c.readContract({address:DISTRIBUTOR,abi:artifact.abi,functionName:'completed',args:[ACCOUNT,batchId(i)]})));
  const expected=j.entries.some(e=>e.kind==='send'&&e.batch===i&&e.settled&&e.success);
  requireThat(flags.every(f=>f===expected),'链上批次与记录不一致；禁止重发。');
 });
}
async function nonceCheck(clients,j){
 const n=j.baseNonce+j.entries.filter(e=>e.settled).length,pending=j.entries.find(e=>!e.settled);
 const counts=await Promise.all(clients.map(async c=>Promise.all(['latest','pending'].map(blockTag=>c.getTransactionCount({address:ACCOUNT,blockTag})))));
 requireThat(counts.every(([a,b])=>a===n&&(b===n||Boolean(pending?.hash)&&b===n+1)),'钱包出现任务外交易或未知待处理交易，停止。');
 return n;
}
export function executionAllowed(env){
 return env.GITHUB_ACTIONS==='true'&&env.GITHUB_REPOSITORY===REPOSITORY&&env.GITHUB_REF==='refs/heads/main'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.MOON11323_CONFIRM===CONFIRM;
}
function report(j){
 const ds=j.entries.filter(e=>e.kind==='send'&&e.success&&e.settled).flatMap(e=>e.received||[]);
 const net=ds.reduce((s,r)=>s+BigInt(r.received),0n),gas=j.entries.reduce((s,e)=>s+BigInt(e.feeWei||0),0n);
 const text='蝴蝶中秋：已确认 '+completed(j)+'/57 批，'+ds.length+'/11323 地址。每地址转出1枚，实际到账按代币税费扣除，不补发。实际到账合计 '+formatEther(net)+' 枚；本任务Gas '+formatEther(gas)+' BNB。至少间隔1800秒。\n';
 console.log(text);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,text);
}
export async function main(env=process.env){
 const execute=env.MOON11323_EXECUTE==='true';
 requireThat(!execute||executionAllowed(env),'执行必须由用户在main手动确认启动。');
 if(!execute){
  let checkKey=(env.ZHONGQIU||'').trim();delete env.ZHONGQIU;
  if(!checkKey.startsWith('0x'))checkKey='0x'+checkKey;
  requireThat(/^0x[0-9a-fA-F]{64}$/.test(checkKey),'缺少ZHONGQIU钱包Secret。');
  const checkAccount=privateKeyToAccount(checkKey);checkKey='';
  requireThat(equal(checkAccount.address,ACCOUNT),'ZHONGQIU钱包Secret与指定地址不匹配。');
  console.log('指定钱包Secret地址核验通过：'+ACCOUNT);
 }
 const url=env.FLAP_BSC_RPC_URL;
 requireThat(url&&new URL(url).protocol==='https:'&&new URL(url).hostname==='bnb-mainnet.g.alchemy.com','缺少已配置的付费RPC。');
 const clients=[url,'https://bsc-dataseed1.defibit.io'].map(u=>createPublicClient({chain:bsc,transport:http(u,{timeout:25000,retryCount:2})}));
 const api=githubApi(env.GITHUB_TOKEN),store=await openGitHubStore({api,readOnly:!execute,reportDirectory:env.MOON11323_REPORT_DIR});
 const j=store.journal;
 // The shared workflow concurrency lock serializes wallet use with previous campaigns.
 let state=await retry(()=>inspect(clients));
 console.log('代币 '+TOKEN+'；余额 '+formatEther(state.balance)+'；BNB '+formatEther(state.bnb));
 if(j.baseNonce===null){
  const ns=await Promise.all(clients.map(async c=>Promise.all(['latest','pending'].map(blockTag=>c.getTransactionCount({address:ACCOUNT,blockTag})))));
  requireThat(ns.flat().every(n=>n===ns[0][0]),'钱包有待处理交易或双节点不一致。');j.baseNonce=ns[0][0];
 }
 const before=completed(j);
 await retry(()=>reconcile(clients,j,store.save));
 if(j.entries.some(e=>!e.settled&&e.hash)){
  const e=j.entries.find(e=>!e.settled);
  const known=await clients[0].request({method:'eth_getTransactionByHash',params:[e.hash]});
  if(known){requireThat(execute,'已保存交易尚待确认，请稍后查看。');await clients[0].waitForTransactionReceipt({hash:e.hash,confirmations:12,timeout:300000});await retry(()=>reconcile(clients,j,store.save));}
 }
 await nonceCheck(clients,j);await retry(()=>mappings(clients,j));
 state=await retry(()=>inspect(clients));
 const remaining=BigInt(plan.slice(completed(j)).flat().length)*AMOUNT;
 requireThat(state.balance>=remaining,'蝴蝶中秋余额不足，剩余需要 '+formatEther(remaining)+' 枚。');
 console.log('固定11323名单、双节点、交易序号和批次状态通过；剩余需要 '+formatEther(remaining)+' 枚。');
 if(!execute){const action=next({...j,entries:j.entries.filter(e=>e.settled)},state.allowance);if(action&&!j.entries.some(e=>!e.settled)){await clients[0].estimateGas({account:ACCOUNT,...callFor(action),value:0n});console.log('下一步 '+action.kind+' 只读模拟通过。');}report(j);return;}
 if(completed(j)>before){report(j);return;}
 j.active=true;await store.save(j);
 const chainNow=async()=>Math.min(...(await Promise.all(clients.map(c=>c.getBlock()))).map(b=>Number(b.timestamp)));
 const deadline=Date.now()+50*60*1000;
 while(await chainNow()<dueAt(j)){requireThat(Date.now()<deadline,'等待到期超时。');console.log('等待至少30分钟间隔，目标UTC '+new Date(dueAt(j)*1000).toISOString());await sleep(15000);}
 let key=(env.ZHONGQIU||'').trim();delete env.ZHONGQIU;if(!key.startsWith('0x'))key='0x'+key;
 requireThat(/^0x[0-9a-fA-F]{64}$/.test(key),'缺少有效钱包Secret。');
 const account=privateKeyToAccount(key);key='';requireThat(equal(account.address,ACCOUNT),'钱包Secret地址不匹配。');
 for(let step=0;step<4;step++){
  state=await retry(()=>inspect(clients));const nonce=await nonceCheck(clients,j);
  const action=next({...j,entries:j.entries.filter(e=>e.settled)},state.allowance);
  if(!action){j.active=false;await store.save(j);report(j);return;}
  if(action.kind==='send')requireThat(await chainNow()>=dueAt(j),'尚未到下批时间。');
  let e=j.entries.find(x=>!x.settled);const call=callFor(action);
  if(!e){const gas=await clients[0].estimateGas({account:ACCOUNT,...call,value:0n}),price=await clients[0].getGasPrice();
   e={...action,settled:false,transaction:{...call,chainId:56,type:'legacy',nonce,gas:(gas*130n/100n+10000n).toString(),gasPrice:(price*120n/100n).toString()}};j.entries.push(e);await store.save(j);
  }
  requireThat(e.kind===action.kind&&e.batch===action.batch&&e.amount===action.amount,'待恢复交易与当前计划不一致。');
  const t=e.transaction;requireThat(state.bnb>=BigInt(t.gas)*BigInt(t.gasPrice),'BNB余额不足以支付本笔最大Gas。');
  const tx={...t,value:0n,gas:BigInt(t.gas),gasPrice:BigInt(t.gasPrice)};
  await Promise.all(clients.map(c=>c.call({account:ACCOUNT,to:tx.to,data:tx.data,value:0n,gas:tx.gas})));
  const raw=await account.signTransaction(tx);
  const hash=await persistThenBroadcast({journal:j,entry:e,raw,save:store.save,broadcast:serializedTransaction=>clients[0].sendRawTransaction({serializedTransaction})});
  console.log('已广播 '+e.kind+' '+hash);
  await clients[0].waitForTransactionReceipt({hash,confirmations:12,timeout:300000});
  await retry(()=>reconcile(clients,j,store.save));await retry(()=>mappings(clients,j));
  if(e.kind==='send'){if(completed(j)===BATCHES){requireThat((await retry(()=>inspect(clients))).allowance===0n,'最后一批后授权额度未清零。');j.active=false;await store.save(j);}report(j);return;}
 }
 throw new Stop('本步骤操作数超限，保留记录。');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e instanceof Stop?e.message:'节点或检查点操作失败，已保留记录；不输出密钥或RPC地址。');process.exitCode=1;});
