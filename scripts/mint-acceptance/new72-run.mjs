import {csv1196InterludeRows,assertCsv1196Rows} from './resume72-csv1196.mjs';
import { readWithRetry } from './rpc-read-retry.mjs';
import { csvInterludeRows,assertCsvRows } from './resume72-interlude.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPublicClient, http, decodeEventLog, formatEther, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { Stop, receiptRecord, stringify, transactionForSigning } from './core.mjs';
import { ACCOUNT, TOKEN, DISTRIBUTOR, BUDGET, AMOUNT, TOTAL, BASE_NONCE, artifact, erc20, history, plan, batchId, fresh, validate, next, callFor, persistThenBroadcast, requireThat, equal } from './new72-core.mjs';
import { accountBudget, reserveCampaign, rawTotal, RAW_BASELINE, OWNED_RETURN } from './new72-budget.mjs';
import { githubApi, openGitHubStore, REPOSITORY } from './new72-store.mjs';

import { isDue, dueAt } from './new72-schedule.mjs';
import { verifyDelivery as verifyPreviousDelivery } from './airdrop-run.mjs';
import { callFor as cancelledCallFor } from './timed-airdrop-core.mjs';
import { verifyDelivery as verifyCancelledDelivery } from './timed-airdrop-run.mjs';
const cancelled=JSON.parse(fs.readFileSync(new URL('./data/new72-cancelled-old.json',import.meta.url),'utf8'));

const previous=JSON.parse(fs.readFileSync(new URL('./data/timed-prior-airdrop.json',import.meta.url),'utf8'));
export function verifyDelivery(e,logs){
 if(e.kind!=='send')return [];
 const events=logs.filter(l=>equal(l.address,DISTRIBUTOR)).map(l=>decodeEventLog({abi:artifact.abi,data:l.data,topics:l.topics,strict:true}));
 const delivered=events.filter(l=>l.eventName==='Delivered'),completed=events.filter(l=>l.eventName==='BatchCompleted');
 requireThat(delivered.length===200&&completed.length===1,'成功回执缺少完整的 200 个地址发放事件。');
 const c=completed[0].args;
 requireThat(equal(c.sender,ACCOUNT)&&equal(c.token,TOKEN)&&equal(c.batchId,batchId(e.batch))&&c.count===200n&&c.total===200n*AMOUNT,'批次汇总事件不匹配。');
 return delivered.map((l,i)=>{
  const a=l.args;requireThat(equal(a.sender,ACCOUNT)&&equal(a.token,TOKEN)&&equal(a.batchId,batchId(e.batch))&&equal(a.recipient,plan()[e.batch][i])&&a.requested===AMOUNT&&a.received===AMOUNT,'逐地址实际到账并非固定 0.1 枚，已停止后续轮次。');
  return {address:a.recipient,requested:a.requested.toString(),received:a.received.toString()};
 });
}
const read=(client,functionName,args=[])=>client.readContract({address:TOKEN,abi:erc20,functionName,args});
export async function gasPriceFor(clients,j){
 if(j.version===1)return (await clients[0].getGasPrice())*120n/100n;
 const prices=await Promise.all(clients.map(c=>c.getGasPrice()));
 requireThat(prices.length===2&&prices.every(p=>p>0n),'两个节点未返回有效Gas单价。');
 // Use the higher live recommendation without the old 20% price markup.
 // Gas-limit headroom and both per-transaction/lifetime caps still apply.
 return prices.reduce((a,b)=>a>b?a:b);
}
async function inspectOnce(clients){
 const results=await Promise.all(clients.map(async client=>{
  requireThat(await client.getChainId()===56,'RPC 链号不是 BSC 主网。');
  const [code,decimals,balance,allowance,bnb]=await Promise.all([client.getCode({address:DISTRIBUTOR}),read(client,'decimals'),read(client,'balanceOf',[ACCOUNT]),read(client,'allowance',[ACCOUNT,DISTRIBUTOR]),client.getBalance({address:ACCOUNT})]);
  requireThat(equal(code,artifact.runtime)&&decimals===18,'批量合约字节码或代币精度不匹配。');
  return {balance,allowance,bnb};
 }));
 requireThat(results.every(r=>r.balance===results[0].balance&&r.allowance===results[0].allowance&&r.bnb===results[0].bnb),'两个 RPC 的余额或授权状态不一致，请稍后只读检查。');
 return results[0];
}
async function verifiedRowOnce(clients,hash){
 const row=await receiptRecord(clients[0],hash);if(!row)return null;
 const receipts=await Promise.all(clients.map(c=>c.request({method:'eth_getTransactionReceipt',params:[hash]})));
 const fingerprint=r=>r&&JSON.stringify([r.transactionHash,r.blockHash,r.status,r.gasUsed,r.effectiveGasPrice,r.logs.map(l=>[l.address,l.data,l.topics])]);
 requireThat(receipts[1]&&fingerprint(receipts[0])===fingerprint(receipts[1]),'两个 RPC 的交易回执不一致，停止继续发送。');
 const blocks=await Promise.all(clients.map(c=>c.getBlock({blockNumber:BigInt(row.block)})));
 requireThat(blocks.every(b=>equal(b.hash,row.blockHash)&&b.timestamp===blocks[0].timestamp),'两个节点的确认时间不一致。');
 return {...row,confirmedAt:Number(blocks[0].timestamp),logs:receipts[0].logs};
}
export async function baseline(clients){
 const rows=await mapReads(history,async pinned=>{
  const row=await verifiedRow(clients,pinned.hash);requireThat(row,'历史交易回执暂时不可用。');
  requireThat(equal(row.from,pinned.from)&&row.nonce===pinned.nonce&&row.success===pinned.success&&row.valueWei===pinned.valueWei&&row.feeWei===pinned.feeWei,'历史预算记录与链上不匹配。');
  if(pinned.to)requireThat(equal(row.to,pinned.to)&&equal(row.data,pinned.data),'历史调拨收款地址或调用数据不匹配。');
  const prior=previous.entries.find(e=>equal(e.hash,row.hash));if(prior?.kind==='send')verifyPreviousDelivery(prior,row.logs);const old=cancelled.entries.find(e=>equal(e.hash,row.hash));if(old){const c=cancelledCallFor(old);requireThat(equal(row.to,c.to)&&equal(row.data,c.data)&&row.gas===old.transaction.gas&&row.gasPrice===old.transaction.gasPrice,'旧16轮交易参数与已停止快照不匹配。');if(old.kind==='send')verifyCancelledDelivery(old,row.logs);}return row;
 });
 requireThat(rawTotal(rows)===RAW_BASELINE,'历史全部转出及Gas与核实基线不一致。');return rows;
}
export async function reconcile(clients,j,base,save,ownedReturnConfirmed=false){
 if(j.version>=2)assertCsvRows(base);
 if(j.version===3)assertCsv1196Rows(base);
 validate(j);const rows=[...base];
 const observed=await mapReads(j.entries,e=>e.hash?verifiedRow(clients,e.hash):Promise.resolve(null));
 for(const [index,e] of j.entries.entries()){
  if(!e.hash){requireThat(!e.settled,'确认记录缺少哈希。');continue;}
  const row=observed[index];
  if(!row){requireThat(!e.settled,'已确认的历史回执暂不可用；不得重新发送。');continue;}
  const t=e.transaction;
  requireThat(equal(row.from,ACCOUNT)&&row.nonce===t.nonce&&equal(row.to,t.to)&&equal(row.data,t.data)&&row.valueWei==='0'&&row.gas===String(t.gas)&&row.gasPrice===String(t.gasPrice),'回执与保存的固定交易参数不符。');
  // Even a reverted or semantically unexpected transaction consumes Gas.
  e.settled=true;e.success=row.success;e.feeWei=row.feeWei;e.confirmedAt=row.confirmedAt;rows.push(row);
  j.rawSpentWei=rawTotal(rows).toString();
  // Persist one fully reconciled snapshot, not a partial budget after each old row.
  if(row.success)e.received=verifyDelivery(e,row.logs);
 }
 // Read-only checks must reconstruct all actual costs and deliveries even
 // without approval to change the accounting treatment of the owned transfer.
 j.rawSpentWei=rawTotal(rows).toString();
 const budget=accountBudget(rows,ownedReturnConfirmed);recordBudget(j,budget);await save(j);return {rows,spent:budget.spent,nonce:rows.filter(r=>equal(r.from,ACCOUNT)).length};
}
async function mapReads(items,fn){
 const out=[];for(let i=0;i<items.length;i+=5)out.push(...await Promise.all(items.slice(i,i+5).map(fn)));return out;
}
async function verifyMappingsOnce(clients,j,only){
 await mapReads(only===undefined?Array.from({length:72},(_,i)=>i):[only],async i=>{
  const expected=j.entries.some(e=>e.kind==='send'&&e.batch===i&&e.settled&&e.success);
  const flags=await Promise.all(clients.map(client=>client.readContract({address:DISTRIBUTOR,abi:artifact.abi,functionName:'completed',args:[ACCOUNT,batchId(i)]})));
  requireThat(flags.every(f=>f===expected),'链上完成状态与检查点不符。保留记录并补核原交易，不会重新空投。');
 });
}
async function nonceCheckOnce(clients,nonce,pending){
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
function recordBudget(j,budget){
 j.spentWei=budget.spent.toString();j.rawSpentWei=budget.raw.toString();j.excludedPrincipalWei=budget.excluded.toString();j.campaignGasWei=budget.campaignGas.toString();
}
export function report(j,directory){
 if(!directory)return;
 fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'plan.csv'),'\ufeff批次,地址,计划枚数\n'+plan().flatMap((b,i)=>b.map(a=>`${i+1},${a},0.1`)).join('\n')+'\n');
 fs.writeFileSync(path.join(directory,'results.csv'),'\ufeff批次,地址,计划枚数,实际到账,交易哈希\n'+j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).flatMap(e=>(e.received||[]).map(r=>`${e.batch+1},${r.address},0.1,${formatEther(BigInt(r.received))},${e.hash}`)).join('\n')+'\n');
 fs.writeFileSync(path.join(directory,'journal.json'),stringify(j)+'\n');
 const count=j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success&&e.received?.length===200).length;
 const text=`已核实 ${count}/72 轮，${count*200}/14400 地址；计划总量 1440 枚。\n已核实转出本金及Gas：${j.rawSpentWei?formatEther(BigInt(j.rawSpentWei)):'尚未核实'} BNB。\n单独记录的自有钱包调拨本金：${j.excludedPrincipalWei?formatEther(BigInt(j.excludedPrincipalWei)):'尚未确认'} BNB；对应哈希 ${OWNED_RETURN.hash}。\n计入预算（含此前任务和全部Gas）：${j.spentWei?formatEther(BigInt(j.spentWei)):'尚未确认'} / 0.1 BNB。\n本次空投累计Gas：${j.campaignGasWei?formatEther(BigInt(j.campaignGasWei)):'尚未核实'} / 剩余累计预算。\n随机地址不是 14400 名真实用户，不用于证明用户增长。\n`;
 fs.writeFileSync(path.join(directory,'summary.txt'),text);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,text+'\n');
}
export async function run({clients,store,execute=false,ownedReturnConfirmed=false,accountProvider,reportDirectory}){
 const {journal:j,save}=store;validate(j);
 const recoveredSend=j.entries.some(e=>e.kind==='send'&&!e.settled);
 if(execute)requireThat(ownedReturnConfirmed===true,'执行前需要明确确认自有钱包调拨记账口径。');
 delete j.spentWei;delete j.rawSpentWei;delete j.excludedPrincipalWei;delete j.campaignGasWei;
 await inspect(clients);console.log('双节点合约、余额及授权核对通过，正在核对49笔历史预算交易。');const base=await baseline(clients);
 if(j.version>=2){base.push(...await csvInterludeRows(clients));console.log('表格600地址的5笔交易及全部Gas核对通过，纳入原任务累计预算。');}
 if(j.version===3){base.push(...await csv1196InterludeRows(clients));console.log('1196地址的8笔交易及全部Gas核对通过，纳入累计预算。');}
 j.rawSpentWei=rawTotal(base).toString();
 console.log('历史预算核对通过，正在恢复本次任务的已确认交易。');
 let ledger=await reconcile(clients,j,base,save,ownedReturnConfirmed);
 // A pending known hash is resolved before checking the completion mapping.
 let pending=j.entries.find(e=>!e.settled);
 if(pending?.hash){
  const tx=await clients[0].request({method:'eth_getTransactionByHash',params:[pending.hash]});
  if(tx){
   requireThat(execute,'原交易尚待确认。请稍后检查，同一任务不应另建。');
   await clients[0].waitForTransactionReceipt({hash:pending.hash,confirmations:12,timeout:180000,pollingInterval:3000});
   ledger=await reconcile(clients,j,base,save,ownedReturnConfirmed);pending=j.entries.find(e=>!e.settled);
  }
 }
 await nonceCheck(clients,ledger.nonce,Boolean(pending));await verifyMappings(clients,j);
 console.log('钱包交易序号和72轮链上完成状态核对通过。');
 let state=await inspect(clients);
 const chainNow=async()=>Math.min(...(await Promise.all(clients.map(c=>c.getBlock()))).map(b=>Number(b.timestamp)));
 const completedCount=j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length;
 if(completedCount===72){requireThat(state.allowance===0n,'任务完成后授权仍非零，停止核查。');j.active=false;await save(j);report(j,reportDirectory);return j;}
 if((recoveredSend&&!j.entries.some(e=>!e.settled))||!isDue(j,await chainNow())){console.log(`等待下轮：${new Date(dueAt(j)*1000).toISOString()}`);report(j,reportDirectory);return j;}
 const done=j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length;
 requireThat(state.balance>=TOTAL-BigInt(done)*200n*AMOUNT,'蝴蝶股票余额不足以完成剩余轮次。');
 console.log(`钱包 ${ACCOUNT}；蝴蝶股票 ${formatEther(state.balance)} 枚；BNB ${formatEther(state.bnb)}；累计已用 ${formatEther(ledger.spent)} / 0.1 BNB。`);
 if(!execute){
  if(!pending){const action=next(j,state.allowance);if(action){const c=callFor(action);const gas=await clients[0].estimateGas({account:ACCOUNT,...c});const price=await gasPriceFor(clients,j);reserveCampaign(ledger.spent,gas*130n/100n+10000n,price);console.log(`下一步 ${action.kind} 只读模拟通过。`);}}
  report(j,reportDirectory);return j;
 }
 requireThat(j.active&&j.authorization==='72x200x0.1:budget0.1:lifetime','定时任务未由用户启动或已经暂停。');
 const account=await accountProvider();requireThat(equal(account.address,ACCOUNT),'Secret 对应钱包不匹配。');
 for(let step=0;step<4;step++){
  requireThat(!j.entries.some(e=>e.settled&&!e.success),'已有失败交易，停止自动重试；失败 Gas 已计入预算。');
  state=await inspect(clients);pending=j.entries.find(e=>!e.settled);
  const expected=next({...j,entries:j.entries.filter(e=>e.settled)},state.allowance);
  if(!expected){j.active=false;await save(j);report(j,reportDirectory);console.log('72 轮已全部完成；不会新建第二组 14400 地址。');return j;}
  if(expected.kind==='send'&&!isDue(j,await chainNow())){report(j,reportDirectory);return j;}
  const call=callFor(expected);let entry=pending;
  await nonceCheck(clients,ledger.nonce,Boolean(entry));
  if(!entry){
   const [gas,price]=await Promise.all([clients[0].estimateGas({account:ACCOUNT,...call}),gasPriceFor(clients,j)]);
   entry={...expected,transaction:{...call,value:'0',nonce:ledger.nonce,type:'legacy',chainId:56,gas:(gas*130n/100n+10000n).toString(),gasPrice:price.toString()},settled:false};
   reserveCampaign(ledger.spent,BigInt(entry.transaction.gas),BigInt(entry.transaction.gasPrice));j.entries.push(entry);await save(j);
  }
  requireThat(entry.kind===expected.kind&&entry.batch===expected.batch&&entry.amount===expected.amount&&equal(entry.transaction.to,call.to)&&equal(entry.transaction.data,call.data),'恢复交易与当前剩余计划不一致，停止。');
  const tx=transactionForSigning(entry.transaction),fee=reserveCampaign(ledger.spent,tx.gas,tx.gasPrice);
  requireThat(state.bnb>=fee,'BNB 余额不足以支付最大 Gas。');
  // Simulate both nodes before any signature; no BNB is sent to contracts.
  await Promise.all(clients.map(client=>client.call({account:ACCOUNT,...call,gas:tx.gas})));
  const raw=await account.signTransaction(tx);
  const hash=await persistThenBroadcast({journal:j,entry,raw,save,broadcast:serializedTransaction=>clients[0].sendRawTransaction({serializedTransaction})});
  console.log(`已发送 ${entry.kind}${entry.batch===undefined?'':` 第 ${entry.batch+1}/72 轮`}：${hash}`);
  await clients[0].waitForTransactionReceipt({hash,confirmations:12,timeout:180000,pollingInterval:3000});
  ledger=await reconcile(clients,j,base,save,ownedReturnConfirmed);
  if(entry.kind==='send')await verifyMappings(clients,j,entry.batch);
  else requireThat((await inspect(clients)).allowance===BigInt(entry.amount),'授权交易已确认但额度未生效，停止重复授权。');
  report(j,reportDirectory);
  if(entry.kind==='send'){if(j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length===72){requireThat((await inspect(clients)).allowance===0n,'最后一轮后授权仍非零，停止并核查。');j.active=false;await save(j);}return j;}
 }
 throw new Stop('达到单次步骤限制，保留检查点后续跑。');
}

export const inspect=(clients)=>readWithRetry(()=>inspectOnce(clients),'读取合约和余额');

export const verifiedRow=(clients,hash)=>readWithRetry(()=>verifiedRowOnce(clients,hash),'读取交易回执');

export const verifyMappings=(clients,j,only)=>readWithRetry(()=>verifyMappingsOnce(clients,j,only),'核对批次状态');

export const nonceCheck=(clients,nonce,pending)=>readWithRetry(()=>nonceCheckOnce(clients,nonce,pending),'核对钱包序号');
