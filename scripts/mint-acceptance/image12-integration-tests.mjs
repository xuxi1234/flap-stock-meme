import {configure as configureImage10,callFor as image10Call,plan as image10Plan,batchId as image10Batch} from './image10-core.mjs';
import {configure as configureOld,plan as holderOldPlan,callFor as holderOldCall,batchId as holderOldBatch} from './holders18-core.mjs';
import {createHash} from 'node:crypto';
import {configure,batchId as holderBatch} from './image12-core.mjs';
import {PRIOR39,CSV1196,CSV1196_CHECKPOINT} from './resume72-csv1196.mjs';
import {plan as plan1196,batchId as batch1196,callFor as call1196} from './csv1196-core.mjs';
import {plan as csvPlan,batchId as csvBatch,callFor as csvCall} from './csv600-core.mjs';
import {plan as p72,batchId as b72,callFor as c72} from './new72-core.mjs';
const j72=JSON.parse(fs.readFileSync(new URL('./data/csv600-prior72.json',import.meta.url),'utf8'));
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData,encodeEventTopics,encodeAbiParameters,toHex,keccak256 } from 'viem';
import { plan,callFor,artifact,fresh,AMOUNT,TOTAL,history,validate,ACCOUNT,TOKEN,DISTRIBUTOR,erc20 } from './image12-core.mjs';
import { dueAt,isDue,authorize,eligible,shouldWake,recoveryFingerprint,readyForExecution } from './image12-schedule.mjs';
import fs from 'node:fs';
import { compact,hydrate } from './image12-store.mjs';
import { run } from './image12-run.mjs';
import { options } from './image12-main.mjs';
import { accountBudget,CHARGED_BASELINE,reserveCampaign } from './holders18-budget.mjs';
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
const PRIOR71=JSON.parse(fs.readFileSync(new URL('./data/holders18-prior71.json',import.meta.url),'utf8'));
const PRIOR_HOLDERS=JSON.parse(fs.readFileSync(new URL('./data/image10-prior-holders18.json',import.meta.url),'utf8'));
const source=Array.from({length:401},(_,i)=>'0x'+(i+1000000).toString(16).padStart(40,'0')).join('\n')+'\n';
const sourceSha=createHash('sha256').update(source).digest('hex');
function networkFixture({taxed=false}={}){
 const oldSource=fs.readFileSync(new URL('./data/holders18-recipients.txt',import.meta.url));
 configureOld(oldSource,createHash('sha256').update(oldSource).digest('hex'),PRIOR71);
 configureImage10(fs.readFileSync(new URL('./data/image10-recipients.txt',import.meta.url)),JSON.parse(fs.readFileSync(new URL('./data/image10-manifest.json',import.meta.url))).recipientSha256,PRIOR_HOLDERS);
 const PRIOR_IMAGE10=JSON.parse(fs.readFileSync(new URL('./data/image12-prior-image10.json',import.meta.url)));
 configure(source,sourceSha,PRIOR_IMAGE10);
 const starting=PRIOR71,doneBefore=0;
 const receipts=new Map(),txs=new Map(),signed=new Map(),completed=new Set();let now=1789463840;const times=new Map();let nonce=213,allowance=20000000000000000000n,balance=20000000000000000000000n,drop=true,dropAt=1,broadcasts=0,durable;
 const blockHash='0x'+'1'.repeat(64);
 const receipt=(hash,from,gasUsed,gasPrice,logs=[])=>({transactionHash:hash,from,blockHash,blockNumber:'0x1',status:'0x1',gasUsed:toHex(gasUsed),effectiveGasPrice:toHex(gasPrice),logs,contractAddress:null});
 for(const p of history){
  const old=cancelledJournal.entries.find(e=>e.hash===p.hash),oldCall=old?cancelledCallFor(old):null;
  txs.set(p.hash,{hash:p.hash,from:p.from,chainId:'0x38',blockHash,nonce:toHex(p.nonce),to:oldCall?.to||p.to||TOKEN,input:oldCall?.data||p.data||'0x',value:toHex(BigInt(p.valueWei)),gas:old?toHex(BigInt(old.transaction.gas)):'0x1',gasPrice:old?toHex(BigInt(old.transaction.gasPrice)):'0x1'});
  const prior=priorJournal.entries.find(e=>e.hash===p.hash);
  receipts.set(p.hash,{...receipt(p.hash,p.from,BigInt(p.feeWei),1n,prior?.kind==='send'?previousLogs(prior.batch):old?.kind==='send'?cancelledLogs(old.batch):[]),status:p.success?'0x1':'0x0'});
 }
 const oldCompleted=new Set();
 for(const e of starting.entries){
  const call=c72(e),t=e.transaction,args={sender:ACCOUNT,token:TOKEN,batchId:e.kind==='send'?b72(e.batch):'0x'+'0'.repeat(64)};
  const logs=e.kind==='send'?p72()[e.batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,100000000000000000n,100000000000000000n])})):[];
  if(e.kind==='send'){logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,20000000000000000000n])});oldCompleted.add(args.batchId);}
  txs.set(e.hash,{hash:e.hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:call.to,input:call.data,value:'0x0',gas:toHex(BigInt(t.gas)),gasPrice:toHex(BigInt(t.gasPrice))});
  times.set(t.nonce+1000,e.confirmedAt);receipts.set(e.hash,{...receipt(e.hash,ACCOUNT,BigInt(e.feeWei)/BigInt(t.gasPrice),BigInt(t.gasPrice),logs),blockNumber:toHex(t.nonce+1000)});
 }
 const csv=JSON.parse(fs.readFileSync(new URL('./data/resume72-csv600-completed.json',import.meta.url)));
 for(const e of csv.entries){
  const call=csvCall(e),t=e.transaction,args={sender:ACCOUNT,token:TOKEN,batchId:e.kind==='send'?csvBatch(e.batch):'0x'+'0'.repeat(64)};
  const logs=e.kind==='send'?csvPlan()[e.batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,1000000000000000000n,1000000000000000000n])})):[];
  if(e.kind==='send'){logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,200000000000000000000n])});oldCompleted.add(args.batchId);}
  txs.set(e.hash,{hash:e.hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:call.to,input:call.data,value:'0x0',gas:toHex(BigInt(t.gas)),gasPrice:toHex(BigInt(t.gasPrice))});
  times.set(t.nonce+1000,e.confirmedAt);receipts.set(e.hash,{...receipt(e.hash,ACCOUNT,BigInt(e.feeWei)/BigInt(t.gasPrice),BigInt(t.gasPrice),logs),blockNumber:toHex(t.nonce+1000)});
 }
 for(const e of CSV1196.entries){
  const call=call1196(e),t=e.transaction,args={sender:ACCOUNT,token:TOKEN,batchId:e.kind==='send'?batch1196(e.batch):'0x'+'0'.repeat(64)};
  const logs=e.kind==='send'?plan1196()[e.batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,1000000000000000000n,1000000000000000000n])})):[];
  if(e.kind==='send'){const count=BigInt(plan1196()[e.batch].length);logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[count,count*1000000000000000000n])});oldCompleted.add(args.batchId);}
  txs.set(e.hash,{hash:e.hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:call.to,input:call.data,value:'0x0',gas:toHex(BigInt(t.gas)),gasPrice:toHex(BigInt(t.gasPrice))});
  times.set(t.nonce+1000,e.confirmedAt);receipts.set(e.hash,{...receipt(e.hash,ACCOUNT,BigInt(e.feeWei)/BigInt(t.gasPrice),BigInt(t.gasPrice),logs),blockNumber:toHex(t.nonce+1000)});
 }
 for(const e of PRIOR_HOLDERS.entries){
  const call=holderOldCall(e),t=e.transaction,args={sender:ACCOUNT,token:TOKEN,batchId:e.kind==='send'?holderOldBatch(e.batch):'0x'+'0'.repeat(64)};
  const logs=e.kind==='send'?holderOldPlan()[e.batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,1000000000000000000n,970000000000000000n])})):[];
  if(e.kind==='send'){const count=BigInt(holderOldPlan()[e.batch].length);logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[count,count*1000000000000000000n])});oldCompleted.add(args.batchId);}
  txs.set(e.hash,{hash:e.hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:call.to,input:call.data,value:'0x0',gas:toHex(BigInt(t.gas)),gasPrice:toHex(BigInt(t.gasPrice))});
  times.set(t.nonce+1000,e.confirmedAt);receipts.set(e.hash,{...receipt(e.hash,ACCOUNT,BigInt(e.feeWei)/BigInt(t.gasPrice),BigInt(t.gasPrice),logs),blockNumber:toHex(t.nonce+1000)});
 }
 for(const e of PRIOR_IMAGE10.entries){
  const call=image10Call(e),t=e.transaction,args={sender:ACCOUNT,token:TOKEN,batchId:e.kind==='send'?image10Batch(e.batch):'0x'+'0'.repeat(64)};
  const logs=e.kind==='send'?image10Plan()[e.batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,1000000000000000000n,1000000000000000000n])})):[];
  if(e.kind==='send'){const count=BigInt(image10Plan()[e.batch].length);logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[count,count*1000000000000000000n])});oldCompleted.add(args.batchId);}
  txs.set(e.hash,{hash:e.hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:call.to,input:call.data,value:'0x0',gas:toHex(BigInt(t.gas)),gasPrice:toHex(BigInt(t.gasPrice))});
  times.set(t.nonce+1000,e.confirmedAt);receipts.set(e.hash,{...receipt(e.hash,ACCOUNT,BigInt(e.feeWei)/BigInt(t.gasPrice),BigInt(t.gasPrice),logs),blockNumber:toHex(t.nonce+1000)});
 }
 const store=(readOnly=false)=>({journal:durable?hydrate(JSON.parse(durable)):{...fresh(),active:true,authorization:'image12x0.1:200:1800seconds:budget0.2:lifetime'},save:async j=>{validate(j);if(!readOnly)durable=JSON.stringify(compact(j));}});
 const client={
  getChainId:async()=>56,getCode:async()=>artifact.runtime,getBlockNumber:async()=>100000n,getBlock:async(args)=>({hash:args?blockHash:blockHash,number:args?.blockNumber||100n,timestamp:BigInt(args?times.get(Number(args.blockNumber))||1000:now)}),
  getBalance:async()=>105128856010977360n,getGasPrice:async()=>50000000n,estimateGas:async()=>11000000n,call:async()=>({data:'0x'}),
  getTransactionCount:async({address})=>address.toLowerCase()===ACCOUNT.toLowerCase()?nonce:6,
  readContract:async({functionName,args})=>({decimals:18,balanceOf:balance,allowance,completed:completed.has(args?.[1])||oldCompleted.has(args?.[1])})[functionName],
  request:async({method,params})=>{if(method==='eth_getTransactionByHash')return txs.get(params[0])||null;if(method==='eth_getTransactionReceipt')return receipts.get(params[0])||null;throw Error('Unexpected RPC method')},
  waitForTransactionReceipt:async({hash})=>{assert.ok(receipts.has(hash));return receipts.get(hash)},
  sendRawTransaction:async({serializedTransaction:raw})=>{
   const t=signed.get(raw),hash=keccak256(raw);assert.equal(JSON.parse(durable).entries.at(-1).hash,hash);assert.equal(t.nonce,nonce);broadcasts++;
   const decoded=decodeFunctionData({abi:t.to.toLowerCase()===TOKEN.toLowerCase()?erc20:artifact.abi,data:t.data});const logs=[];
   if(decoded.functionName==='approve')allowance=decoded.args[1];
   else{
    const [token,id,recipients,amounts]=decoded.args;assert.equal(token.toLowerCase(),TOKEN.toLowerCase());assert.equal(recipients.length,plan()[completed.size].length);assert.ok(!completed.has(id));assert.equal(id,holderBatch(completed.size));assert.deepEqual(recipients.map(x=>x.toLowerCase()),plan()[completed.size]);
    recipients.forEach((recipient,i)=>{assert.equal(amounts[i],AMOUNT);logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args:{sender:ACCOUNT,token:TOKEN,batchId:id}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,amounts[i],taxed&&i===0?97000000000000000n:amounts[i]])})});
    logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args:{sender:ACCOUNT,token:TOKEN,batchId:id}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[BigInt(recipients.length),BigInt(recipients.length)*AMOUNT])});
    balance-=BigInt(recipients.length)*AMOUNT;allowance-=BigInt(recipients.length)*AMOUNT;completed.add(id);
   }
   txs.set(hash,{hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:t.to,input:t.data,value:'0x0',gas:toHex(t.gas),gasPrice:toHex(t.gasPrice)});
   times.set(nonce,now);receipts.set(hash,{...receipt(hash,ACCOUNT,11000000n,t.gasPrice,logs),blockNumber:toHex(nonce)});nonce++;
   if(completed.size===dropAt&&drop){drop=false;throw Error('RPC accepted transaction but response was lost')};return hash;
  },
 };
 const account={address:ACCOUNT,signTransaction:async t=>{const raw=toHex(JSON.stringify(t,(_,v)=>typeof v==='bigint'?v.toString():v));signed.set(raw,t);return raw}};
 return {client,store,account,loseNextRoundResponse:()=>{drop=true;dropAt=completed.size+1},setNow:v=>{now=v},stats:()=>({broadcasts,nonce,balance,allowance,completed:completed.size})};
}


test('preserves all 71 old batches, accounts above 0.1, recovers lost reply and waits 1800 seconds',async t=>{
 t.mock.method(console,'log',()=>{});
 const old=structuredClone(PRIOR71),f=networkFixture(),args={clients:[f.client,f.client],execute:true,ownedReturnConfirmed:true,accountProvider:async()=>f.account};
 const checked=f.store(true);await run({...args,store:checked,execute:false});
 assert.equal(checked.journal.spentWei,'149221252629141262');assert.equal(f.stats().broadcasts,0);
 await assert.rejects(()=>run({...args,store:f.store()}),/response was lost/);
 assert.equal(f.stats().completed,1);assert.equal(f.stats().broadcasts,3);
 await run({...args,store:f.store()});assert.equal(f.stats().broadcasts,3);
 f.setNow(1789465639);await run({...args,store:f.store()});assert.equal(f.stats().completed,1);
 f.setNow(1789465640);await run({...args,store:f.store()});assert.equal(f.stats().completed,2);
 f.setNow(1789467440);await run({...args,store:f.store()});assert.equal(f.stats().completed,3);
 const final=f.store().journal;assert.equal(final.active,false);assert.ok(BigInt(final.spentWei)>100000000000000000n);assert.ok(BigInt(final.spentWei)<200000000000000000n);
 assert.equal(f.stats().allowance,0n);assert.deepEqual(PRIOR71,old);
 await run({...args,store:f.store(),execute:false});assert.equal(f.stats().broadcasts,5);
});

test('failed durable write blocks new signatures and transfers',async t=>{
 t.mock.method(console,'log',()=>{});const f=networkFixture(),store=f.store();store.save=async()=>{throw Error('durable write failed')};
 await assert.rejects(run({clients:[f.client,f.client],store,execute:true,ownedReturnConfirmed:true,accountProvider:async()=>{throw Error('must not sign')}}),/durable write failed/);
 assert.equal(f.stats().broadcasts,0);
});

test('recovers a mined taxed batch without rebroadcast and continues after 1800 seconds',async t=>{
 t.mock.method(console,'log',()=>{});
 const f=networkFixture({taxed:true}),args={clients:[f.client,f.client],execute:true,ownedReturnConfirmed:true,accountProvider:async()=>f.account};
 await assert.rejects(()=>run({...args,store:f.store()}),/response was lost/);
 assert.equal(f.stats().broadcasts,3);
 const recovered=f.store();await run({...args,store:recovered});
 assert.equal(f.stats().broadcasts,3);
 const sent=recovered.journal.entries.find(e=>e.kind==='send');
 assert.equal(sent.success,true);assert.equal(sent.received[0].requested,'100000000000000000');
 assert.equal(sent.received[0].received,'97000000000000000');
 f.setNow(1789465639);await run({...args,store:f.store()});assert.equal(f.stats().completed,1);
 f.setNow(1789465640);await run({...args,store:f.store()});assert.equal(f.stats().completed,2);
 assert.equal(f.stats().broadcasts,4);
 assert.ok(BigInt(f.store().journal.spentWei)<200000000000000000n);
});
