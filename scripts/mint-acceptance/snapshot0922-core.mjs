import { createHash } from 'node:crypto';
import { isAddress } from 'viem';
import { readFileSync } from 'node:fs';
import { keccak256, toHex, encodeFunctionData, encodeAbiParameters, parseAbi } from 'viem';
import { requireThat, equal } from './core.mjs';
export { requireThat, equal } from './core.mjs';
export const ACCOUNT='0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA';
export const TOKEN='0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777';
export const DISTRIBUTOR='0x369890cb7a233be14d33fd4265b26afadce00bc0';
export const BUDGET=null; // No cumulative BNB gas spending cap.
export const AMOUNT=777700000000000000n;
export let TOTAL=0n, BATCHES=0, SOURCE_SHA, ID;
export const artifact=JSON.parse(readFileSync(new URL('../../src/airdrop/distributor.json',import.meta.url),'utf8'));
export const erc20=parseAbi(['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)','function decimals() view returns (uint8)','function approve(address,uint256) returns (bool)']);
export const history=JSON.parse(readFileSync(new URL('./data/new72-history.json',import.meta.url),'utf8'));
export let BASE_NONCE=0, prior72;
let cached;
export function buildPlan(source,sha){
 requireThat(/^[0-9a-f]{64}$/.test(sha)&&createHash('sha256').update(source).digest('hex')===sha,'名单文件哈希不匹配。');
 const addresses=source.toString().trim().split(/\r?\n/).map(a=>a.trim().toLowerCase());
 requireThat(addresses.length>0&&addresses.length<=10800&&new Set(addresses).size===addresses.length&&addresses.every(a=>isAddress(a)&&![ACCOUNT,TOKEN,DISTRIBUTOR,'0x'+'0'.repeat(40)].some(b=>equal(a,b))),'名单数量、重复地址或格式无效。');
 return Object.freeze(Array.from({length:Math.ceil(addresses.length/200)},(_,i)=>Object.freeze(addresses.slice(i*200,(i+1)*200))));
}
export function configure(source,sha,prior){
 requireThat(prior.version===1&&prior.entries.length>0&&prior.entries.every(e=>e.settled&&e.success&&Number.isSafeInteger(e.transaction?.nonce)),'旧任务仍有未确认或失败交易。');
 prior72=structuredClone(prior);BASE_NONCE=Math.max(...prior.entries.map(e=>e.transaction.nonce))+1;
 cached=buildPlan(source,sha);BATCHES=cached.length;TOTAL=BigInt(cached.flat().length)*AMOUNT;SOURCE_SHA=sha;
 ID=keccak256(toHex(`butterfly:56:74a7:snapshot0922:0.7777:3600seconds:${SOURCE_SHA}`));
}
export function plan(){requireThat(cached&&ID,'尚未载入已固定的持仓名单。');return cached;}
const pageBytes=readFileSync(new URL('../../public/airdrop-7031/plan.json',import.meta.url));
requireThat(createHash('sha256').update(pageBytes).digest('hex')==='22696c8e845abe09dd8d9350bd634eeae5128f827a1cea5a69dbc798a43602e5','网页名单哈希不匹配。');
const pagePlan=JSON.parse(pageBytes);
export const batchId=i=>{requireThat(Number.isInteger(i)&&i>=0&&i<BATCHES,'批次无效。');requireThat(JSON.stringify(plan().flat())===JSON.stringify(pagePlan.addresses),'网页和自动任务名单不一致。');return pagePlan.batchIds[i];};
export const fresh=()=>({version:1,id:ID,sourceSha:SOURCE_SHA,account:ACCOUNT,token:TOKEN,distributor:DISTRIBUTOR,entries:[],active:false});
export function callFor(e){
 if(e.kind==='send'){
  requireThat(Number.isInteger(e.batch)&&e.batch>=0&&e.batch<BATCHES,'批次不在固定的名单批次范围内。');
  return {to:DISTRIBUTOR,value:0n,data:encodeFunctionData({abi:artifact.abi,functionName:'distribute',args:[TOKEN,batchId(e.batch),plan()[e.batch],Array(plan()[e.batch].length).fill(AMOUNT)]})};
 }
 requireThat(e.kind==='approve'||e.kind==='reset','不允许执行其他操作。');
 const amount=BigInt(e.amount);
 requireThat(e.kind==='reset'?amount===0n:amount>0n&&amount<=TOTAL,'授权金额超出范围。');
 return {to:TOKEN,value:0n,data:encodeFunctionData({abi:erc20,functionName:'approve',args:[DISTRIBUTOR,amount]})};
}
export function reserve(spent,gas,price){
 requireThat(spent>=0n&&gas>0n&&gas<=114400000n&&price>0n,'Gas 或预算参数无效。');
 return gas*price; // Wallet balance and positive gas parameters remain enforced.
}
export function validate(j){
 requireThat(j.version===1&&j.id===ID&&j.sourceSha===SOURCE_SHA&&equal(j.account,ACCOUNT)&&equal(j.token,TOKEN)&&equal(j.distributor,DISTRIBUTOR),'任务、钱包或固定合约不匹配。');
 requireThat(typeof j.active==='boolean','定时任务开关无效。');
  requireThat(Array.isArray(j.entries)&&j.entries.length<=BATCHES+8,'执行记录结构异常。');
 let completed=0;
 j.entries.forEach((e,i)=>{
  const c=callFor(e),t=e.transaction;
  requireThat(t&&t.nonce===BASE_NONCE+i&&t.chainId===56&&t.type==='legacy'&&equal(t.to,c.to)&&equal(t.data,c.data)&&BigInt(t.value)===0n,'交易参数或 nonce 与固定计划不符。');
  reserve(0n,BigInt(t.gas),BigInt(t.gasPrice));
  requireThat(!e.hash||/^0x[0-9a-f]{64}$/.test(e.hash),'交易哈希异常。');
  requireThat(e.settled===true||i===j.entries.length-1,'未完成交易必须位于记录末尾。');
  if(e.kind==='send'){requireThat(e.batch===completed,'存在重复或跳跃批次。');if(e.settled&&e.success)completed++;}
  if(e.settled)requireThat(e.hash&&typeof e.success==='boolean','确认记录缺少哈希或状态。');
  if(e.settled&&!e.success)requireThat(i===j.entries.length-1,'失败之后不能自动继续发送。');
 });
}
export function next(j,allowance){
 requireThat(j.entries.every(e=>e.settled&&e.success),'存在未确认或失败交易，请先核对。');
 const done=j.entries.filter(e=>e.kind==='send').length;
 requireThat(done<=BATCHES,'批次超出上限。');
 const remaining=plan().slice(done).reduce((n,b)=>n+BigInt(b.length)*AMOUNT,0n);
 if(done===BATCHES)return allowance===0n?null:{kind:'reset',amount:'0'};
 if(allowance!==remaining)return allowance===0n?{kind:'approve',amount:remaining.toString()}:{kind:'reset',amount:'0'};
 return {kind:'send',batch:done};
}
export async function persistThenBroadcast({journal,entry,raw,save,broadcast}){
 const hash=keccak256(raw);requireThat(!entry.hash||equal(entry.hash,hash),'签名哈希与检查点不一致，停止。');
 entry.hash=hash;await save(journal); // Durable acknowledgement is mandatory before broadcast.
 const result=await broadcast(raw);requireThat(equal(result,hash),'RPC 返回哈希不匹配，按已保存哈希核对。');return hash;
}
