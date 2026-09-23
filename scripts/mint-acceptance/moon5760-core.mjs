import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {isAddress,keccak256,toHex,encodeFunctionData,parseAbi,decodeEventLog} from 'viem';
export class Stop extends Error {}
export const requireThat=(ok,message)=>{if(!ok)throw new Stop(message);};
export const equal=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
export const stringify=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2);
export const ACCOUNT='0x2f0545cce0059d33edf96d84de1a4ebc2e297777';
export const TOKEN='0xe5f69232e5312dff8b3f0f82cf2bdfe80a517777';
export const DISTRIBUTOR='0x369890cb7a233be14d33fd4265b26afadce00bc0';
export const SOURCE_SHA='19bb2320285a3c70876997a994da7476b028ea5f4a5d294c4a315e10e65be066';
export const AMOUNT=10n**18n,INTERVAL=2400,BATCHES=29,TOTAL=5760n*AMOUNT;
export const CONFIRM='moon5760:1:200:2400seconds';
const source=fs.readFileSync(new URL('./data/moon5760-recipients.txt',import.meta.url));
requireThat(createHash('sha256').update(source).digest('hex')===SOURCE_SHA,'固定名单哈希不符。');
export const addresses=source.toString().trim().split(/\r?\n/);
requireThat(addresses.length===5760&&new Set(addresses.map(a=>a.toLowerCase())).size===5760&&addresses.every(a=>isAddress(a)),'固定名单不符。');
requireThat(addresses.every(a=>![ACCOUNT,TOKEN,DISTRIBUTOR,'0x'+'0'.repeat(40)].some(b=>equal(a,b))),'名单包含发送钱包、零地址或相关合约。');
export const plan=Array.from({length:BATCHES},(_,i)=>addresses.slice(i*200,i*200+200));
export const ID=keccak256(toHex('moon5760:56:'+TOKEN+':'+ACCOUNT+':'+SOURCE_SHA+':1:2400:v1'));
export const batchId=i=>{requireThat(Number.isInteger(i)&&i>=0&&i<BATCHES,'批次无效。');return keccak256(toHex(ID+':'+i));};
export const artifact=JSON.parse(fs.readFileSync(new URL('../../src/airdrop/distributor.json',import.meta.url)));
export const erc20=parseAbi(['function decimals() view returns(uint8)','function name() view returns(string)','function symbol() view returns(string)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)']);
export const fresh=()=>({version:1,id:ID,account:ACCOUNT,token:TOKEN,sourceSha:SOURCE_SHA,active:false,baseNonce:null,entries:[]});
export function callFor(e){
 if(e.kind==='send'){batchId(e.batch);return {to:DISTRIBUTOR,value:'0',data:encodeFunctionData({abi:artifact.abi,functionName:'distribute',args:[TOKEN,batchId(e.batch),plan[e.batch],plan[e.batch].map(()=>AMOUNT)]})};}
 requireThat(['reset','approve'].includes(e.kind),'操作无效。');
 const amount=BigInt(e.amount);requireThat(e.kind==='reset'?amount===0n:amount>0n&&amount<=TOTAL,'授权数量无效。');
 return {to:TOKEN,value:'0',data:encodeFunctionData({abi:erc20,functionName:'approve',args:[DISTRIBUTOR,amount]})};
}
export const completed=j=>j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length;
export const dueAt=j=>Math.max(0,...j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).map(e=>e.confirmedAt+INTERVAL));
export function next(j,allowance){
 requireThat(j.entries.every(e=>e.settled&&e.success),'请先核对未完成交易。');
 const done=completed(j),remaining=BigInt(plan.slice(done).flat().length)*AMOUNT;
 if(done===BATCHES)return allowance===0n?null:{kind:'reset',amount:'0'};
 if(allowance!==remaining)return allowance===0n?{kind:'approve',amount:remaining.toString()}:{kind:'reset',amount:'0'};
 return {kind:'send',batch:done};
}
export function validate(j){
 requireThat(j.version===1&&j.id===ID&&equal(j.account,ACCOUNT)&&equal(j.token,TOKEN)&&j.sourceSha===SOURCE_SHA&&typeof j.active==='boolean','任务记录不匹配。');
 requireThat(j.baseNonce===null||Number.isSafeInteger(j.baseNonce)&&j.baseNonce>=0,'起始序号无效。');
 requireThat(Array.isArray(j.entries)&&j.entries.length<=339,'交易记录异常。');
 let done=0;
 j.entries.forEach((e,i)=>{
  const c=callFor(e),t=e.transaction;
  requireThat(j.baseNonce!==null&&t.nonce===j.baseNonce+i&&t.chainId===56&&t.type==='legacy'&&equal(t.to,c.to)&&equal(t.data,c.data)&&t.value==='0','交易参数或序号不匹配。');
  requireThat(BigInt(t.gas)>0n&&BigInt(t.gas)<=114400000n&&BigInt(t.gasPrice)>0n,'Gas参数无效。');
  requireThat(!e.hash||/^0x[0-9a-f]{64}$/.test(e.hash),'哈希无效。');
  requireThat(e.settled===true||i===j.entries.length-1,'未完成交易必须在末尾。');
  if(e.settled)requireThat(e.hash&&typeof e.success==='boolean'&&Number.isSafeInteger(e.confirmedAt),'回执信息缺失。');
  if(e.settled&&!e.success)requireThat(i===j.entries.length-1,'失败后禁止继续。');
  if(e.kind==='send'){requireThat(e.batch===done,'批次重复或跳跃。');if(e.settled&&e.success){if(done>0){const prev=j.entries.filter(x=>x.kind==='send'&&x.settled&&x.success&&x.batch===done-1)[0];requireThat(e.confirmedAt-prev.confirmedAt>=INTERVAL,'历史批次间隔不足。');}done++;}}
 });
}
export function deliveries(e,logs){
 if(e.kind!=='send')return [];
 const events=logs.filter(l=>equal(l.address,DISTRIBUTOR)).map(l=>decodeEventLog({abi:artifact.abi,data:l.data,topics:l.topics,strict:true}));
 const ds=events.filter(x=>x.eventName==='Delivered'),bs=events.filter(x=>x.eventName==='BatchCompleted');
 requireThat(ds.length===plan[e.batch].length&&bs.length===1,'空投事件数量不符。');
 const same=a=>equal(a.sender,ACCOUNT)&&equal(a.token,TOKEN)&&equal(a.batchId,batchId(e.batch));
 requireThat(same(bs[0].args)&&bs[0].args.count===BigInt(ds.length)&&bs[0].args.total===BigInt(ds.length)*AMOUNT,'汇总事件不符。');
 return ds.map((x,i)=>{const a=x.args;requireThat(same(a)&&equal(a.recipient,plan[e.batch][i])&&a.requested===AMOUNT&&a.received>0n&&a.received<=AMOUNT,'逐地址发放不符。');return {address:a.recipient,received:a.received.toString()};});
}
export async function persistThenBroadcast({journal,entry,raw,save,broadcast}){
 const hash=keccak256(raw);requireThat(!entry.hash||equal(entry.hash,hash),'恢复交易签名不一致。');entry.hash=hash;await save(journal);
 requireThat(equal(await broadcast(raw),hash),'广播返回哈希不一致。');return hash;
}
