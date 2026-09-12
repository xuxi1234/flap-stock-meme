import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPublicClient, http, decodeEventLog, formatEther, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { Stop, receiptRecord, calculateBudget, stringify, transactionForSigning } from './core.mjs';
import { ACCOUNT, TOKEN, DISTRIBUTOR, BUDGET, AMOUNT, TOTAL, BASE_NONCE, artifact, erc20, history, plan, batchId, fresh, validate, next, callFor, reserve, persistThenBroadcast, requireThat, equal } from './airdrop-core.mjs';
import { githubApi, openGitHubStore, REPOSITORY } from './airdrop-store.mjs';

export function options(env){
 const mode=env.AIRDROP_MODE||'check';requireThat(['check','execute'].includes(mode),'运行模式无效。');
 const execute=mode==='execute';
 if(execute)requireThat(env.GITHUB_ACTIONS==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_REPOSITORY===REPOSITORY&&env.GITHUB_REF==='refs/heads/main'&&env.AIRDROP_CONFIRM==='20x200x7','执行只允许本仓库 main 分支手动启动，并确认 20×200×7 和累计 0.1 BNB 预算。');
 return {execute};
}
export function verifyDelivery(e,logs){
 if(e.kind!=='send')return [];
 const events=logs.filter(l=>equal(l.address,DISTRIBUTOR)).map(l=>decodeEventLog({abi:artifact.abi,data:l.data,topics:l.topics,strict:true}));
 const delivered=events.filter(l=>l.eventName==='Delivered'),completed=events.filter(l=>l.eventName==='BatchCompleted');
 requireThat(delivered.length===200&&completed.length===1,'成功回执缺少完整的 200 个地址发放事件。');
 const c=completed[0].args;
 requireThat(equal(c.sender,ACCOUNT)&&equal(c.token,TOKEN)&&equal(c.batchId,batchId(e.batch))&&c.count===200n&&c.total===200n*AMOUNT,'批次汇总事件不匹配。');
 return delivered.map((l,i)=>{
  const a=l.args;requireThat(equal(a.sender,ACCOUNT)&&equal(a.token,TOKEN)&&equal(a.batchId,batchId(e.batch))&&equal(a.recipient,plan()[e.batch][i])&&a.requested===AMOUNT&&a.received===AMOUNT,'逐地址实际到账并非固定 7 枚，已停止后续轮次。');
  return {address:a.recipient,requested:a.requested.toString(),received:a.received.toString()};
 });
}
const read=(client,functionName,args=[])=>client.readContract({address:TOKEN,abi:erc20,functionName,args});
export async function inspect(clients){
 const results=await Promise.all(clients.map(async client=>{
  requireThat(await client.getChainId()===56,'RPC 链号不是 BSC 主网。');
  const [code,decimals,balance,allowance,bnb]=await Promise.all([client.getCode({address:DISTRIBUTOR}),read(client,'decimals'),read(client,'balanceOf',[ACCOUNT]),read(client,'allowance',[ACCOUNT,DISTRIBUTOR]),client.getBalance({address:ACCOUNT})]);
  requireThat(equal(code,artifact.runtime)&&decimals===18,'批量合约字节码或代币精度不匹配。');
  return {balance,allowance,bnb};
 }));
 requireThat(results.every(r=>r.balance===results[0].balance&&r.allowance===results[0].allowance&&r.bnb===results[0].bnb),'两个 RPC 的余额或授权状态不一致，请稍后只读检查。');
 return results[0];
}
export async function verifiedRow(clients,hash){
 const row=await receiptRecord(clients[0],hash);if(!row)return null;
 const receipts=await Promise.all(clients.map(c=>c.request({method:'eth_getTransactionReceipt',params:[hash]})));
 const fingerprint=r=>r&&JSON.stringify([r.transactionHash,r.blockHash,r.status,r.gasUsed,r.effectiveGasPrice,r.logs.map(l=>[l.address,l.data,l.topics])]);
 requireThat(receipts[1]&&fingerprint(receipts[0])===fingerprint(receipts[1]),'两个 RPC 的交易回执不一致，停止继续发送。');
 return {...row,logs:receipts[0].logs};
}
export async function baseline(clients){
 const rows=await mapReads(history,async pinned=>{
  const row=await verifiedRow(clients,pinned.hash);requireThat(row,'历史交易回执暂时不可用。');
  requireThat(equal(row.from,pinned.from)&&row.nonce===pinned.nonce&&row.success===pinned.success&&row.valueWei===pinned.valueWei&&row.feeWei===pinned.feeWei,'历史预算记录与链上不匹配。');return row;
 });
 const spent=calculateBudget(rows);requireThat(spent===31134577509141262n,'历史累计支出与批准的基线不一致。');return rows;
}
export async function reconcile(clients,j,base,save){
 validate(j);const rows=[...base];
 const observed=await mapReads(j.entries,e=>e.hash?verifiedRow(clients,e.hash):Promise.resolve(null));
 for(const [index,e] of j.entries.entries()){
  if(!e.hash){requireThat(!e.settled,'确认记录缺少哈希。');continue;}
  const row=observed[index];
  if(!row){requireThat(!e.settled,'已确认的历史回执暂不可用；不得重新发送。');continue;}
  const t=e.transaction;
  requireThat(equal(row.from,ACCOUNT)&&row.nonce===t.nonce&&equal(row.to,t.to)&&equal(row.data,t.data)&&row.valueWei==='0'&&row.gas===String(t.gas)&&row.gasPrice===String(t.gasPrice),'回执与保存的固定交易参数不符。');
  // Even a reverted or semantically unexpected transaction consumes Gas.
  e.settled=true;e.success=row.success;e.feeWei=row.feeWei;rows.push(row);
  j.spentWei=calculateBudget(rows).toString();await save(j);
  if(row.success)e.received=verifyDelivery(e,row.logs);
 }
 const spent=calculateBudget(rows);j.spentWei=spent.toString();await save(j);return {rows,spent,nonce:rows.filter(r=>equal(r.from,ACCOUNT)).length};
}
async function mapReads(items,fn){
 const out=[];for(let i=0;i<items.length;i+=5)out.push(...await Promise.all(items.slice(i,i+5).map(fn)));return out;
}
export async function verifyMappings(clients,j,only){
 await mapReads(only===undefined?Array.from({length:20},(_,i)=>i):[only],async i=>{
  const expected=j.entries.some(e=>e.kind==='send'&&e.batch===i&&e.settled&&e.success);
  const flags=await Promise.all(clients.map(client=>client.readContract({address:DISTRIBUTOR,abi:artifact.abi,functionName:'completed',args:[ACCOUNT,batchId(i)]})));
  requireThat(flags.every(f=>f===expected),'链上完成状态与检查点不符。保留记录并补核原交易，不会重新空投。');
 });
}
export async function nonceCheck(clients,nonce,pending){
 for(const c of clients){
  const [latest,pool]=await Promise.all(['latest','pending'].map(blockTag=>c.getTransactionCount({address:ACCOUNT,blockTag})));
  requireThat(latest===nonce&&(pool===nonce||(pending&&pool===nonce+1)),'钱包存在记录外交易或未确认交易，停止以避免重复或漏算预算。');
  for(const address of [...new Set(history.map(r=>r.from.toLowerCase()))].filter(a=>!equal(a,ACCOUNT))){
   const known=history.filter(r=>equal(r.from,address)).length;
   const counts=await Promise.all(['latest','pending'].map(blockTag=>c.getTransactionCount({address,blockTag})));
   requireThat(counts.every(n=>n===known),`原任务旧钱包 ${address} 的记录为 ${known} 笔，链上已确认/待处理计数为 ${counts.join('/')}。存在未计入累计预算的交易，停止。请提供缺失交易哈希以补核历史记录。`);
  }
 }
}
function report(j,directory){
 if(!directory)return;
 fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'plan.csv'),'\ufeff批次,地址,计划枚数\n'+plan().flatMap((b,i)=>b.map(a=>`${i+1},${a},7`)).join('\n')+'\n');
 fs.writeFileSync(path.join(directory,'results.csv'),'\ufeff批次,地址,计划枚数,实际到账,交易哈希\n'+j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).flatMap(e=>(e.received||[]).map(r=>`${e.batch+1},${r.address},7,${formatEther(BigInt(r.received))},${e.hash}`)).join('\n')+'\n');
 fs.writeFileSync(path.join(directory,'journal.json'),stringify(j)+'\n');
 const count=j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success&&e.received?.length===200).length;
 const text=`已核实 ${count}/20 轮，${count*200}/4000 地址；计划总量 28000 枚。\n累计支出（含此前任务和 Gas）：${formatEther(BigInt(j.spentWei||'31134577509141262'))} / 0.1 BNB。\n随机地址不是 4000 名真实用户，不用于证明用户增长。\n`;
 fs.writeFileSync(path.join(directory,'summary.txt'),text);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,text+'\n');
}
export async function run({clients,store,execute=false,accountProvider,reportDirectory}){
 const {journal:j,save}=store;validate(j);
 await inspect(clients);console.log('双节点合约、余额及授权核对通过，正在核对10笔历史预算交易。');const base=await baseline(clients);
 console.log('历史预算核对通过，正在恢复本次任务的已确认交易。');
 let ledger=await reconcile(clients,j,base,save);
 // A pending known hash is resolved before checking the completion mapping.
 let pending=j.entries.find(e=>!e.settled);
 if(pending?.hash){
  const tx=await clients[0].request({method:'eth_getTransactionByHash',params:[pending.hash]});
  if(tx){
   requireThat(execute,'原交易尚待确认。请稍后检查，同一任务不应另建。');
   await clients[0].waitForTransactionReceipt({hash:pending.hash,confirmations:12,timeout:180000,pollingInterval:3000});
   ledger=await reconcile(clients,j,base,save);pending=j.entries.find(e=>!e.settled);
  }
 }
 await nonceCheck(clients,ledger.nonce,Boolean(pending));await verifyMappings(clients,j);
 console.log('钱包交易序号和20轮链上完成状态核对通过。');
 let state=await inspect(clients);
 const done=j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length;
 requireThat(state.balance>=TOTAL-BigInt(done)*200n*AMOUNT,'蝴蝶股票余额不足以完成剩余轮次。');
 console.log(`钱包 ${ACCOUNT}；蝴蝶股票 ${formatEther(state.balance)} 枚；BNB ${formatEther(state.bnb)}；累计已用 ${formatEther(ledger.spent)} / 0.1 BNB。`);
 if(!execute){
  if(!pending){const action=next(j,state.allowance);if(action){const c=callFor(action);const gas=await clients[0].estimateGas({account:ACCOUNT,...c});const price=await clients[0].getGasPrice();reserve(ledger.spent,gas*130n/100n+10000n,price*120n/100n);console.log(`下一步 ${action.kind} 只读模拟通过。`);}}
  report(j,reportDirectory);return j;
 }
 const account=await accountProvider();requireThat(equal(account.address,ACCOUNT),'Secret 对应钱包不匹配。');
 for(let step=0;step<44;step++){
  requireThat(!j.entries.some(e=>e.settled&&!e.success),'已有失败交易，停止自动重试；失败 Gas 已计入预算。');
  state=await inspect(clients);pending=j.entries.find(e=>!e.settled);
  const expected=next({...j,entries:j.entries.filter(e=>e.settled)},state.allowance);
  if(!expected){report(j,reportDirectory);console.log('20 轮已全部完成；不会新建第二组 4000 地址。');return j;}
  const call=callFor(expected);let entry=pending;
  await nonceCheck(clients,ledger.nonce,Boolean(entry));
  if(!entry){
   const [gas,price]=await Promise.all([clients[0].estimateGas({account:ACCOUNT,...call}),clients[0].getGasPrice()]);
   entry={...expected,transaction:{...call,value:'0',nonce:ledger.nonce,type:'legacy',chainId:56,gas:(gas*130n/100n+10000n).toString(),gasPrice:(price*120n/100n).toString()},settled:false};
   reserve(ledger.spent,BigInt(entry.transaction.gas),BigInt(entry.transaction.gasPrice));j.entries.push(entry);await save(j);
  }
  requireThat(entry.kind===expected.kind&&entry.batch===expected.batch&&entry.amount===expected.amount&&equal(entry.transaction.to,call.to)&&equal(entry.transaction.data,call.data),'恢复交易与当前剩余计划不一致，停止。');
  const tx=transactionForSigning(entry.transaction),fee=reserve(ledger.spent,tx.gas,tx.gasPrice);
  requireThat(state.bnb>=fee,'BNB 余额不足以支付最大 Gas。');
  // Simulate both nodes before any signature; no BNB is sent to contracts.
  await Promise.all(clients.map(client=>client.call({account:ACCOUNT,...call,gas:tx.gas})));
  const raw=await account.signTransaction(tx);
  const hash=await persistThenBroadcast({journal:j,entry,raw,save,broadcast:serializedTransaction=>clients[0].sendRawTransaction({serializedTransaction})});
  console.log(`已发送 ${entry.kind}${entry.batch===undefined?'':` 第 ${entry.batch+1}/20 轮`}：${hash}`);
  await clients[0].waitForTransactionReceipt({hash,confirmations:12,timeout:180000,pollingInterval:3000});
  ledger=await reconcile(clients,j,base,save);
  if(entry.kind==='send')await verifyMappings(clients,j,entry.batch);
  else requireThat((await inspect(clients)).allowance===BigInt(entry.amount),'授权交易已确认但额度未生效，停止重复授权。');
  report(j,reportDirectory);
 }
 throw new Stop('达到单次步骤限制，保留检查点后续跑。');
}
export async function main(env=process.env){
 const {execute}=options(env);
 const primary=env.FLAP_BSC_RPC_URL||'https://bsc-dataseed.bnbchain.org';
 const secondary='https://bsc-dataseed1.defibit.io';
 requireThat(new URL(primary).protocol==='https:'&&primary!==secondary,'需要两个不同的 HTTPS RPC。');
 const clients=[primary,secondary].map(url=>createPublicClient({chain:bsc,transport:http(url,{timeout:25000,retryCount:1})}));
 const store=env.GITHUB_TOKEN?await openGitHubStore({api:githubApi(env.GITHUB_TOKEN),readOnly:!execute,reportDirectory:env.AIRDROP_REPORT_DIR}):{journal:fresh(),save:async()=>{requireThat(!execute,'执行模式必须有持久 GitHub 检查点。');}};
 try{
  await run({clients,store,execute,reportDirectory:env.AIRDROP_REPORT_DIR,accountProvider:async()=>{
   options(env);let key=(env.FLAP_MINT_PRIVATE_KEY||'').trim();delete env.FLAP_MINT_PRIVATE_KEY;
   if(key&&!key.startsWith('0x'))key='0x'+key;requireThat(/^0x[0-9a-fA-F]{64}$/.test(key),'缺少有效 FLAP_MINT_PRIVATE_KEY Secret。');
   const account=privateKeyToAccount(key);key='';return account;
  }});
 }finally{report(store.journal,env.AIRDROP_REPORT_DIR);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{
 console.error(e instanceof Stop?e.message:'运行停止：网络、签名或检查点请求未完成。保留原记录，重新只读检查；未输出底层错误或私钥。');process.exitCode=1;
});
