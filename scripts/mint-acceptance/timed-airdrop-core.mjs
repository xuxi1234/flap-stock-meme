import { plan as previousPlan } from './airdrop-core.mjs';
import { readFileSync } from 'node:fs';
import { keccak256, toHex, encodeFunctionData, encodeAbiParameters, parseAbi } from 'viem';
import { requireThat, equal } from './core.mjs';
export { requireThat, equal } from './core.mjs';
export const ACCOUNT='0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA';
export const TOKEN='0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777';
export const DISTRIBUTOR='0x369890cb7a233be14d33fd4265b26afadce00bc0';
export const BUDGET=100000000000000000n;
export const AMOUNT=100000000000000000n;
export const TOTAL=600000000000000000000n;
// Public campaign namespace; this is NOT a private key. Never change for a retry.
export const ID=keccak256(toHex('butterfly:56:74a7:2026-09-12:30x200:0.1:20minutes:campaign-1'));
export const artifact=JSON.parse(readFileSync(new URL('../../src/airdrop/distributor.json',import.meta.url),'utf8'));
export const erc20=parseAbi(['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)','function decimals() view returns (uint8)','function approve(address,uint256) returns (bool)']);
export const history=JSON.parse(readFileSync(new URL('./data/timed-airdrop-history.json',import.meta.url),'utf8'));
export const BASE_NONCE=26;
let cached;
export function plan(){
 if(!cached){
  const addresses=Array.from({length:6000},(_,i)=>'0x'+keccak256(toHex(`${ID}:recipient:${i}`)).slice(-40));
  requireThat(new Set(addresses).size===6000&&addresses.every(a=>![ACCOUNT,TOKEN,DISTRIBUTOR,'0x'+'0'.repeat(40)].some(b=>equal(a,b))),'名单存在重复或非法接收地址。');
  const priorRecipients=new Set(previousPlan().flat());
  requireThat(addresses.every(a=>!priorRecipients.has(a)),'新名单与上一任务重复。');
  cached=Object.freeze(Array.from({length:30},(_,i)=>Object.freeze(addresses.slice(i*200,(i+1)*200))));
 }return cached;
}
export const batchId=i=>keccak256(encodeAbiParameters([{type:'bytes32'},{type:'uint256'}],[ID,BigInt(i)]));
export const fresh=()=>({version:1,id:ID,account:ACCOUNT,token:TOKEN,distributor:DISTRIBUTOR,entries:[],active:false});
export function callFor(e){
 if(e.kind==='send'){
  requireThat(Number.isInteger(e.batch)&&e.batch>=0&&e.batch<30,'批次不在固定的 30 轮范围内。');
  return {to:DISTRIBUTOR,value:0n,data:encodeFunctionData({abi:artifact.abi,functionName:'distribute',args:[TOKEN,batchId(e.batch),plan()[e.batch],Array(200).fill(AMOUNT)]})};
 }
 requireThat(e.kind==='approve'||e.kind==='reset','不允许执行其他操作。');
 const amount=BigInt(e.amount);
 requireThat(e.kind==='reset'?amount===0n:amount>0n&&amount<=TOTAL,'授权金额超出范围。');
 return {to:TOKEN,value:0n,data:encodeFunctionData({abi:erc20,functionName:'approve',args:[DISTRIBUTOR,amount]})};
}
export function reserve(spent,gas,price){
 requireThat(spent>=0n&&gas>0n&&gas<=16000000n&&price>0n,'Gas 或预算参数无效。');
 const fee=gas*price;requireThat(fee<=2000000000000000n,'单笔最大 Gas 超过 0.002 BNB。');
 requireThat(spent+fee<=BUDGET,'累计支出（含历史支出及 Gas）超过 0.1 BNB，停止。');return fee;
}
export function validate(j){
 requireThat(j.version===1&&j.id===ID&&equal(j.account,ACCOUNT)&&equal(j.token,TOKEN)&&equal(j.distributor,DISTRIBUTOR),'任务、钱包或固定合约不匹配。');
 requireThat(typeof j.active==='boolean','定时任务开关无效。');
  requireThat(Array.isArray(j.entries)&&j.entries.length<=64,'执行记录结构异常。');
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
 requireThat(done<=30,'批次超出上限。');
 const remaining=TOTAL-BigInt(done)*200n*AMOUNT;
 if(done===30)return allowance===0n?null:{kind:'reset',amount:'0'};
 if(allowance!==remaining)return allowance===0n?{kind:'approve',amount:remaining.toString()}:{kind:'reset',amount:'0'};
 return {kind:'send',batch:done};
}
export async function persistThenBroadcast({journal,entry,raw,save,broadcast}){
 const hash=keccak256(raw);requireThat(!entry.hash||equal(entry.hash,hash),'签名哈希与检查点不一致，停止。');
 entry.hash=hash;await save(journal); // Durable acknowledgement is mandatory before broadcast.
 const result=await broadcast(raw);requireThat(equal(result,hash),'RPC 返回哈希不匹配，按已保存哈希核对。');return hash;
}
