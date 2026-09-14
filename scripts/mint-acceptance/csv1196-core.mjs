import { createHash } from 'node:crypto';
import { isAddress } from 'viem';
import { readFileSync } from 'node:fs';
import { keccak256, toHex, encodeFunctionData, encodeAbiParameters, parseAbi } from 'viem';
import { requireThat, equal } from './core.mjs';
export { requireThat, equal } from './core.mjs';
export const ACCOUNT='0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA';
export const TOKEN='0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777';
export const DISTRIBUTOR='0x369890cb7a233be14d33fd4265b26afadce00bc0';
export const BUDGET=100000000000000000n;
export const AMOUNT=1000000000000000000n;
export const TOTAL=1196000000000000000000n;
// Public campaign namespace; this is NOT a private key. Never change for a retry.
export const SOURCE_SHA='5f6a8e81b1366ef351eacd305c2161108800884920612081b9bc76df1c57c7b5';
export const ID=keccak256(toHex(`butterfly:56:74a7:csv1196:1:60seconds:${SOURCE_SHA}`));
export const artifact=JSON.parse(readFileSync(new URL('../../src/airdrop/distributor.json',import.meta.url),'utf8'));
export const erc20=parseAbi(['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)','function decimals() view returns (uint8)','function approve(address,uint256) returns (bool)']);
export const history=JSON.parse(readFileSync(new URL('./data/new72-history.json',import.meta.url),'utf8'));
export let BASE_NONCE=88;
export let prior72;
export function setPrior(j){requireThat(j.version===2&&j.entries.every(e=>e.settled&&e.success),'旧任务仍有未确认或失败交易，停止。');prior72=structuredClone(j);BASE_NONCE=Math.max(76,...j.entries.map(e=>e.transaction.nonce))+1;}
let cached;
export function plan(){
 if(!cached){
  const bytes=readFileSync(new URL('./data/csv1196-source.csv',import.meta.url));
  requireThat(createHash('sha256').update(bytes).digest('hex')===SOURCE_SHA,'名单文件哈希不匹配，禁止修改本任务名单。');
  const addresses=bytes.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(a=>a.trim().toLowerCase());
  requireThat(addresses.length===1196&&new Set(addresses).size===1196&&addresses.every(a=>isAddress(a)&&![ACCOUNT,TOKEN,DISTRIBUTOR,'0x'+'0'.repeat(40),'0x000000000000000000000000000000000000dead'].some(b=>equal(a,b))),'名单数量、重复地址或格式无效。');
  cached=Object.freeze(Array.from({length:6},(_,i)=>Object.freeze(addresses.slice(i*200,(i+1)*200))));
 }return cached;
}
export const batchId=i=>keccak256(encodeAbiParameters([{type:'bytes32'},{type:'uint256'}],[ID,BigInt(i)]));
export const fresh=()=>({version:1,id:ID,account:ACCOUNT,token:TOKEN,distributor:DISTRIBUTOR,entries:[],active:false});
export function callFor(e){
 if(e.kind==='send'){
  requireThat(Number.isInteger(e.batch)&&e.batch>=0&&e.batch<6,'批次不在固定的 6 批范围内。');
  return {to:DISTRIBUTOR,value:0n,data:encodeFunctionData({abi:artifact.abi,functionName:'distribute',args:[TOKEN,batchId(e.batch),plan()[e.batch],Array(plan()[e.batch].length).fill(AMOUNT)]})};
 }
 requireThat(e.kind==='approve'||e.kind==='reset','不允许执行其他操作。');
 const amount=BigInt(e.amount);
 requireThat(e.kind==='reset'?amount===0n:amount>0n&&amount<=TOTAL,'授权金额超出范围。');
 return {to:TOKEN,value:0n,data:encodeFunctionData({abi:erc20,functionName:'approve',args:[DISTRIBUTOR,amount]})};
}
export function reserve(spent,gas,price){
 requireThat(spent>=0n&&gas>0n&&gas<=114400000n&&price>0n,'Gas 或预算参数无效。');
 const fee=gas*price;requireThat(fee<=2000000000000000n,'单笔最大 Gas 超过 0.002 BNB。');
 requireThat(spent+fee<=BUDGET,'累计支出（含历史支出及 Gas）超过 0.1 BNB，停止。');return fee;
}
export function validate(j){
 requireThat(j.version===1&&j.id===ID&&equal(j.account,ACCOUNT)&&equal(j.token,TOKEN)&&equal(j.distributor,DISTRIBUTOR),'任务、钱包或固定合约不匹配。');
 requireThat(typeof j.active==='boolean','定时任务开关无效。');
  requireThat(Array.isArray(j.entries)&&j.entries.length<=14,'执行记录结构异常。');
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
 requireThat(done<=6,'批次超出上限。');
 const remaining=plan().slice(done).reduce((n,b)=>n+BigInt(b.length)*AMOUNT,0n);
 if(done===6)return allowance===0n?null:{kind:'reset',amount:'0'};
 if(allowance!==remaining)return allowance===0n?{kind:'approve',amount:remaining.toString()}:{kind:'reset',amount:'0'};
 return {kind:'send',batch:done};
}
export async function persistThenBroadcast({journal,entry,raw,save,broadcast}){
 const hash=keccak256(raw);requireThat(!entry.hash||equal(entry.hash,hash),'签名哈希与检查点不一致，停止。');
 entry.hash=hash;await save(journal); // Durable acknowledgement is mandatory before broadcast.
 const result=await broadcast(raw);requireThat(equal(result,hash),'RPC 返回哈希不匹配，按已保存哈希核对。');return hash;
}
