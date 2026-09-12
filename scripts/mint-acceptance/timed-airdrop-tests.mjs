import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData,encodeEventTopics,encodeAbiParameters,toHex,keccak256 } from 'viem';
import { plan,callFor,artifact,fresh,AMOUNT,TOTAL,history,validate,ACCOUNT,TOKEN,DISTRIBUTOR,erc20 } from './timed-airdrop-core.mjs';
import { dueAt,isDue,authorize,eligible,shouldWake,recoveryFingerprint,readyForExecution } from './timed-airdrop-schedule.mjs';
import fs from 'node:fs';
import { compact,hydrate } from './timed-airdrop-store.mjs';
import { run } from './timed-airdrop-run.mjs';
import { options } from './timed-airdrop-main.mjs';
import { accountBudget,CHARGED_BASELINE,reserveCampaign } from './timed-airdrop-budget.mjs';
import { plan as oldPlan,batchId as oldBatchId } from './airdrop-core.mjs';
test('30 distinct batches pay 0.1 token each, 600 total, and exclude previous recipients',()=>{
 const p=plan();assert.equal(p.length,30);assert.equal(new Set(p.flat()).size,6000);
 const old=new Set(oldPlan().flat());assert.ok(p.flat().every(a=>!old.has(a)));
 let sum=0n;for(let batch=0;batch<30;batch++){
  const d=decodeFunctionData({abi:artifact.abi,data:callFor({kind:'send',batch}).data});
  assert.equal(d.args[2].length,200);assert.ok(d.args[3].every(a=>a===100000000000000000n));sum+=d.args[3].reduce((a,b)=>a+b,0n);
 }assert.equal(sum,600000000000000000000n);assert.equal(sum,TOTAL);assert.equal(AMOUNT,100000000000000000n);
 assert.throws(()=>callFor({kind:'send',batch:30}));
});
test('scheduler starts disabled and authorizes only manual main with exact confirmation',()=>{
 const j=fresh();assert.equal(eligible(j,10000),false);
 const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',TIMED_CONFIRM:'30x200x0.1',GITHUB_ACTOR:'xuxi1234',GITHUB_RUN_ID:'123'};
 assert.throws(()=>authorize(j,{...env,GITHUB_EVENT_NAME:'schedule'}));
 assert.throws(()=>authorize(j,{...env,TIMED_CONFIRM:''}));authorize(j,env);assert.equal(eligible(j,10000),true);
 j.active=false;assert.equal(eligible(j,10000),false);
});
test('no early send or catch-up burst: next round is 1200s after last confirmed receipt',()=>{
 const j=fresh();assert.equal(dueAt(j),0);
 j.entries=[{kind:'send',batch:0,settled:true,success:true,confirmedAt:5000}];
 assert.equal(isDue(j,6199),false);assert.equal(isDue(j,6200),true);assert.equal(isDue(j,20000),true);
 j.entries.push({kind:'send',batch:1,settled:true,success:true,confirmedAt:20000});assert.equal(isDue(j,20001),false);assert.equal(dueAt(j),21200);
 delete j.entries[1].confirmedAt;assert.throws(()=>dueAt(j));
});
test('after 30 rounds no further send is eligible, even on manual restart',()=>{
 const j=fresh();j.active=true;j.authorization='30x200x0.1:budget0.1:gas0.02';
 j.entries=Array.from({length:30},(_,batch)=>({kind:'send',batch,settled:true,success:true,confirmedAt:5000+1200*batch}));
 assert.equal(eligible(j,99999999),false);
});

const priorJournal=JSON.parse(fs.readFileSync(new URL('./data/timed-prior-airdrop.json',import.meta.url),'utf8'));
function previousLogs(batch){
 const args={sender:ACCOUNT,token:TOKEN,batchId:oldBatchId(batch)};
 const logs=oldPlan()[batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,7000000000000000000n,7000000000000000000n])}));
 logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,1400000000000000000000n])});return logs;
}
function networkFixture(){
 const receipts=new Map(),txs=new Map(),signed=new Map(),completed=new Set();let now=5000;const times=new Map();let nonce=26,allowance=0n,balance=2000000000000000000000n,drop=true,dropAt=1,broadcasts=0,durable;
 const blockHash='0x'+'1'.repeat(64);
 const receipt=(hash,from,gasUsed,gasPrice,logs=[])=>({transactionHash:hash,from,blockHash,blockNumber:'0x1',status:'0x1',gasUsed:toHex(gasUsed),effectiveGasPrice:toHex(gasPrice),logs,contractAddress:null});
 for(const p of history){
  txs.set(p.hash,{hash:p.hash,from:p.from,chainId:'0x38',blockHash,nonce:toHex(p.nonce),to:p.to||TOKEN,input:p.data||'0x',value:toHex(BigInt(p.valueWei)),gas:'0x1',gasPrice:'0x1'});
  const prior=priorJournal.entries.find(e=>e.hash===p.hash);
  receipts.set(p.hash,{...receipt(p.hash,p.from,BigInt(p.feeWei),1n,prior?.kind==='send'?previousLogs(prior.batch):[]),status:p.success?'0x1':'0x0'});
 }
 const store=(readOnly=false)=>({journal:durable?hydrate(JSON.parse(durable)):{...fresh(),active:true,authorization:'30x200x0.1:budget0.1:gas0.02'},save:async j=>{validate(j);if(!readOnly)durable=JSON.stringify(compact(j));}});
 const client={
  getChainId:async()=>56,getCode:async()=>artifact.runtime,getBlockNumber:async()=>1000n,getBlock:async(args)=>({hash:args?blockHash:blockHash,number:args?.blockNumber||100n,timestamp:BigInt(args?times.get(Number(args.blockNumber))||1000:now)}),
  getBalance:async()=>70000000000000000n,getGasPrice:async()=>50000000n,estimateGas:async()=>100000n,call:async()=>({data:'0x'}),
  getTransactionCount:async({address})=>address.toLowerCase()===ACCOUNT.toLowerCase()?nonce:6,
  readContract:async({functionName,args})=>({decimals:18,balanceOf:balance,allowance,completed:completed.has(args?.[1])})[functionName],
  request:async({method,params})=>{if(method==='eth_getTransactionByHash')return txs.get(params[0])||null;if(method==='eth_getTransactionReceipt')return receipts.get(params[0])||null;throw Error('Unexpected RPC method')},
  waitForTransactionReceipt:async({hash})=>{assert.ok(receipts.has(hash));return receipts.get(hash)},
  sendRawTransaction:async({serializedTransaction:raw})=>{
   const t=signed.get(raw),hash=keccak256(raw);assert.equal(JSON.parse(durable).entries.at(-1).hash,hash);assert.equal(t.nonce,nonce);broadcasts++;
   const decoded=decodeFunctionData({abi:t.to.toLowerCase()===TOKEN.toLowerCase()?erc20:artifact.abi,data:t.data});const logs=[];
   if(decoded.functionName==='approve')allowance=decoded.args[1];
   else{
    const [token,id,recipients,amounts]=decoded.args;assert.equal(token.toLowerCase(),TOKEN.toLowerCase());assert.equal(recipients.length,200);assert.ok(!completed.has(id));
    recipients.forEach((recipient,i)=>{assert.equal(amounts[i],100000000000000000n);logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args:{sender:ACCOUNT,token:TOKEN,batchId:id}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,amounts[i],amounts[i]])})});
    logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args:{sender:ACCOUNT,token:TOKEN,batchId:id}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,20000000000000000000n])});
    balance-=20000000000000000000n;allowance-=20000000000000000000n;completed.add(id);
   }
   txs.set(hash,{hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:t.to,input:t.data,value:'0x0',gas:toHex(t.gas),gasPrice:toHex(t.gasPrice)});
   times.set(nonce,now);receipts.set(hash,{...receipt(hash,ACCOUNT,100000n,t.gasPrice,logs),blockNumber:toHex(nonce)});nonce++;
   if(completed.size===dropAt&&drop){drop=false;throw Error('RPC accepted transaction but response was lost')};return hash;
  },
 };
 const account={address:ACCOUNT,signTransaction:async t=>{const raw=toHex(JSON.stringify(t,(_,v)=>typeof v==='bigint'?v.toString():v));signed.set(raw,t);return raw}};
 return {client,store,account,loseNextRoundResponse:()=>{drop=true;dropAt=completed.size+1},setNow:v=>{now=v},stats:()=>({broadcasts,nonce,balance,allowance,completed:completed.size})};
}

test('real timed runner recovers lost response, waits20minutes, sends30 once and stops',async t=>{
 t.mock.method(console,'log',()=>{});
 const f=networkFixture(),args={clients:[f.client,f.client],execute:true,ownedReturnConfirmed:true,accountProvider:async()=>f.account};
 await assert.rejects(()=>run({...args,store:f.store()}),/response was lost/);
 assert.equal(f.stats().completed,1);
 await run({...args,store:f.store()});assert.equal(f.stats().broadcasts,2);
 f.setNow(6199);await run({...args,store:f.store()});assert.equal(f.stats().completed,1);
 f.setNow(6200);await run({...args,store:f.store()});assert.equal(f.stats().completed,2);
 // A severely delayed trigger sends one round, never all overdue rounds.
 f.setNow(20000);await run({...args,store:f.store()});assert.equal(f.stats().completed,3);
 await run({...args,store:f.store()});assert.equal(f.stats().completed,3);
 let j;
 for(let i=3;i<29;i++){f.setNow(20000+(i-2)*1200);j=await run({...args,store:f.store()});assert.equal(f.stats().completed,i+1);}
 f.setNow(52400);f.loseNextRoundResponse();
 await assert.rejects(()=>run({...args,store:f.store()}),/response was lost/);
 const pendingStore=f.store();assert.equal(pendingStore.journal.entries.at(-1).settled,false);
 assert.equal(shouldWake(pendingStore.journal,52400),true);
 const check=f.store(true),before=recoveryFingerprint(check.journal);
 await run({...args,store:check,execute:false});
 assert.equal(check.journal.active,false);assert.equal(eligible(check.journal,52400),false);
 assert.equal(readyForExecution('tick',before,check.journal,52400),true);
 assert.equal(f.store().journal.entries.at(-1).settled,false); // read-only check did not persist
 j=await run({...args,store:f.store()});
 assert.equal(f.store().journal.entries.at(-1).settled,true);
 assert.equal(f.stats().completed,30);
 assert.equal(j.active,false);assert.equal(j.entries.filter(e=>e.kind==='send'&&e.received.length===200).length,30);
 assert.equal(f.stats().broadcasts,31);assert.equal(f.stats().nonce,57);assert.equal(f.stats().balance,1400000000000000000000n);assert.equal(f.stats().allowance,0n);
 assert.equal(BigInt(j.spentWei),43772162469141262n+186000000000000n);
 const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',TIMED_CONFIRM:'30x200x0.1'};
 assert.throws(()=>authorize(j,env));assert.equal(eligible(j,9999999),false);
});
test('prior21transactions remain in lifetime budget and new gas ceiling is not reset',()=>{
 const rows=history.map(r=>({...r,data:r.data||'0x'}));
 assert.equal(accountBudget(rows,true).spent,43772162469141262n);
 assert.equal(reserveCampaign(CHARGED_BASELINE+20000000000000000n-1n,1n,1n),1n);
 assert.throws(()=>reserveCampaign(CHARGED_BASELINE+20000000000000000n,1n,1n));
});
test('schedule cannot masquerade as manual activation and PR cannot execute',()=>{
 const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'schedule',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',TIMED_OPERATION:'tick',TIMED_PHASE:'execute'};
 assert.equal(options(env).execute,true);
 assert.throws(()=>options({...env,TIMED_OPERATION:'start'}));
 assert.throws(()=>options({...env,GITHUB_EVENT_NAME:'pull_request'}));
 assert.throws(()=>options({...env,GITHUB_REF:'refs/heads/feature'}));
});

test('resume persists manual activation while still waiting for due time',()=>{
 const j=fresh();j.active=true;j.authorization='30x200x0.1:budget0.1:gas0.02';j.entries=[{kind:'send',settled:true,success:true,confirmedAt:5000}];
 const before=recoveryFingerprint(j);assert.equal(readyForExecution('tick',before,j,5100),false);assert.equal(readyForExecution('start',before,j,5100),true);
});
