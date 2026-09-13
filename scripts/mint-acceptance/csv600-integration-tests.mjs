import {plan as p72,batchId as b72,callFor as c72} from './new72-core.mjs';
const j72=JSON.parse(fs.readFileSync(new URL('./data/csv600-prior72.json',import.meta.url),'utf8'));
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData,encodeEventTopics,encodeAbiParameters,toHex,keccak256 } from 'viem';
import { plan,callFor,artifact,fresh,AMOUNT,TOTAL,history,validate,ACCOUNT,TOKEN,DISTRIBUTOR,erc20 } from './csv600-core.mjs';
import { dueAt,isDue,authorize,eligible,shouldWake,recoveryFingerprint,readyForExecution } from './csv600-schedule.mjs';
import fs from 'node:fs';
import { compact,hydrate } from './csv600-store.mjs';
import { run } from './csv600-run.mjs';
import { options } from './csv600-main.mjs';
import { accountBudget,CHARGED_BASELINE,reserveCampaign } from './new72-budget.mjs';
import { plan as oldPlan,batchId as oldBatchId } from './airdrop-core.mjs';
import {plan as cancelledPlan,batchId as cancelledBatchId,callFor as cancelledCallFor} from './timed-airdrop-core.mjs';
const cancelledJournal=JSON.parse(fs.readFileSync(new URL('./data/new72-cancelled-old.json',import.meta.url),'utf8'));
function cancelledLogs(batch){
 const args={sender:ACCOUNT,token:TOKEN,batchId:cancelledBatchId(batch)};
 const logs=cancelledPlan()[batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,100000000000000000n,100000000000000000n])}));
 logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,20000000000000000000n])});return logs;
}
const priorJournal=JSON.parse(fs.readFileSync(new URL('./data/timed-prior-airdrop.json',import.meta.url),'utf8'));
function previousLogs(batch){
 const args={sender:ACCOUNT,token:TOKEN,batchId:oldBatchId(batch)};
 const logs=oldPlan()[batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,7000000000000000000n,7000000000000000000n])}));
 logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,1400000000000000000000n])});return logs;
}
function networkFixture(){
 const receipts=new Map(),txs=new Map(),signed=new Map(),completed=new Set();let now=5000;const times=new Map();let nonce=72,allowance=900000000000000000000n,balance=8168000000000000000000n,drop=true,dropAt=1,broadcasts=0,durable;
 const blockHash='0x'+'1'.repeat(64);
 const receipt=(hash,from,gasUsed,gasPrice,logs=[])=>({transactionHash:hash,from,blockHash,blockNumber:'0x1',status:'0x1',gasUsed:toHex(gasUsed),effectiveGasPrice:toHex(gasPrice),logs,contractAddress:null});
 for(const p of history){
  const old=cancelledJournal.entries.find(e=>e.hash===p.hash),oldCall=old?cancelledCallFor(old):null;
  txs.set(p.hash,{hash:p.hash,from:p.from,chainId:'0x38',blockHash,nonce:toHex(p.nonce),to:oldCall?.to||p.to||TOKEN,input:oldCall?.data||p.data||'0x',value:toHex(BigInt(p.valueWei)),gas:old?toHex(BigInt(old.transaction.gas)):'0x1',gasPrice:old?toHex(BigInt(old.transaction.gasPrice)):'0x1'});
  const prior=priorJournal.entries.find(e=>e.hash===p.hash);
  receipts.set(p.hash,{...receipt(p.hash,p.from,BigInt(p.feeWei),1n,prior?.kind==='send'?previousLogs(prior.batch):old?.kind==='send'?cancelledLogs(old.batch):[]),status:p.success?'0x1':'0x0'});
 }
 const oldCompleted=new Set();
 for(const e of j72.entries){
  const call=c72(e),t=e.transaction,args={sender:ACCOUNT,token:TOKEN,batchId:e.kind==='send'?b72(e.batch):'0x'+'0'.repeat(64)};
  const logs=e.kind==='send'?p72()[e.batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,100000000000000000n,100000000000000000n])})):[];
  if(e.kind==='send'){logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,20000000000000000000n])});oldCompleted.add(args.batchId);}
  txs.set(e.hash,{hash:e.hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:call.to,input:call.data,value:'0x0',gas:toHex(BigInt(t.gas)),gasPrice:toHex(BigInt(t.gasPrice))});
  receipts.set(e.hash,receipt(e.hash,ACCOUNT,BigInt(e.feeWei)/BigInt(t.gasPrice),BigInt(t.gasPrice),logs));
 }
 const store=(readOnly=false)=>({journal:durable?hydrate(JSON.parse(durable)):{...fresh(),active:true,authorization:'3x200x1:budget0.1:lifetime'},save:async j=>{validate(j);if(!readOnly)durable=JSON.stringify(compact(j));}});
 const client={
  getChainId:async()=>56,getCode:async()=>artifact.runtime,getBlockNumber:async()=>1000n,getBlock:async(args)=>({hash:args?blockHash:blockHash,number:args?.blockNumber||100n,timestamp:BigInt(args?times.get(Number(args.blockNumber))||1000:now)}),
  getBalance:async()=>70000000000000000n,getGasPrice:async()=>50000000n,estimateGas:async()=>100000n,call:async()=>({data:'0x'}),
  getTransactionCount:async({address})=>address.toLowerCase()===ACCOUNT.toLowerCase()?nonce:6,
  readContract:async({functionName,args})=>({decimals:18,balanceOf:balance,allowance,completed:completed.has(args?.[1])||oldCompleted.has(args?.[1])})[functionName],
  request:async({method,params})=>{if(method==='eth_getTransactionByHash')return txs.get(params[0])||null;if(method==='eth_getTransactionReceipt')return receipts.get(params[0])||null;throw Error('Unexpected RPC method')},
  waitForTransactionReceipt:async({hash})=>{assert.ok(receipts.has(hash));return receipts.get(hash)},
  sendRawTransaction:async({serializedTransaction:raw})=>{
   const t=signed.get(raw),hash=keccak256(raw);assert.equal(JSON.parse(durable).entries.at(-1).hash,hash);assert.equal(t.nonce,nonce);broadcasts++;
   const decoded=decodeFunctionData({abi:t.to.toLowerCase()===TOKEN.toLowerCase()?erc20:artifact.abi,data:t.data});const logs=[];
   if(decoded.functionName==='approve')allowance=decoded.args[1];
   else{
    const [token,id,recipients,amounts]=decoded.args;assert.equal(token.toLowerCase(),TOKEN.toLowerCase());assert.equal(recipients.length,200);assert.ok(!completed.has(id));
    recipients.forEach((recipient,i)=>{assert.equal(amounts[i],1000000000000000000n);logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args:{sender:ACCOUNT,token:TOKEN,batchId:id}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,amounts[i],amounts[i]])})});
    logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args:{sender:ACCOUNT,token:TOKEN,batchId:id}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,200000000000000000000n])});
    balance-=200000000000000000000n;allowance-=200000000000000000000n;completed.add(id);
   }
   txs.set(hash,{hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:t.to,input:t.data,value:'0x0',gas:toHex(t.gas),gasPrice:toHex(t.gasPrice)});
   times.set(nonce,now);receipts.set(hash,{...receipt(hash,ACCOUNT,100000n,t.gasPrice,logs),blockNumber:toHex(nonce)});nonce++;
   if(completed.size===dropAt&&drop){drop=false;throw Error('RPC accepted transaction but response was lost')};return hash;
  },
 };
 const account={address:ACCOUNT,signTransaction:async t=>{const raw=toHex(JSON.stringify(t,(_,v)=>typeof v==='bigint'?v.toString():v));signed.set(raw,t);return raw}};
 return {client,store,account,loseNextRoundResponse:()=>{drop=true;dropAt=completed.size+1},setNow:v=>{now=v},stats:()=>({broadcasts,nonce,balance,allowance,completed:completed.size})};
}


test('CSV600 recovers lost broadcast replies, waits180 seconds and delivers600 once',async t=>{
 t.mock.method(console,'log',()=>{});
 const f=networkFixture(),args={clients:[f.client,f.client],execute:true,ownedReturnConfirmed:true,accountProvider:async()=>f.account};
 await assert.rejects(()=>run({...args,store:f.store()}),/response was lost/);
 assert.equal(f.stats().completed,1);assert.equal(f.stats().broadcasts,3);
 await run({...args,store:f.store()});assert.equal(f.stats().broadcasts,3);
 f.setNow(5179);await run({...args,store:f.store()});assert.equal(f.stats().completed,1);
 f.setNow(5180);await run({...args,store:f.store()});assert.equal(f.stats().completed,2);
 f.setNow(5360);f.loseNextRoundResponse();await assert.rejects(()=>run({...args,store:f.store()}),/response was lost/);
 const j=await run({...args,store:f.store()});assert.equal(j.active,false);assert.equal(f.stats().completed,3);assert.equal(f.stats().broadcasts,5);assert.equal(f.stats().nonce,77);assert.equal(f.stats().allowance,0n);assert.equal(f.stats().balance,7568000000000000000000n);
 assert.equal(j.entries.filter(e=>e.kind==='send'&&e.received.length===200).length,3);
 assert.equal(BigInt(j.spentWei),70942515369141262n+30000000000000n);
 await run({...args,store:f.store()});assert.equal(f.stats().broadcasts,5);
});
test('a mismatched secret account cannot cause any broadcast',async t=>{
 t.mock.method(console,'log',()=>{});const f=networkFixture();await assert.rejects(()=>run({clients:[f.client,f.client],store:f.store(),execute:true,ownedReturnConfirmed:true,accountProvider:async()=>({...f.account,address:TOKEN})}),/Secret/);assert.equal(f.stats().broadcasts,0);
});
