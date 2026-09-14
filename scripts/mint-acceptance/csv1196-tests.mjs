import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeFunctionData,encodeEventTopics,encodeAbiParameters,keccak256,toHex} from 'viem';
import {plan,callFor,next,fresh,TOTAL,AMOUNT,artifact,ACCOUNT,TOKEN,DISTRIBUTOR,batchId,validate,persistThenBroadcast,reserve,setPrior} from './csv1196-core.mjs';
import {dueAt,isDue,authorize} from './csv1196-schedule.mjs';
import {verifyDelivery} from './csv1196-run.mjs';
import {compact,hydrate} from './csv1196-store.mjs';
const logs=batch=>[...plan()[batch].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args:{sender:ACCOUNT,token:TOKEN,batchId:batchId(batch)}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,AMOUNT,AMOUNT])})),{address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args:{sender:ACCOUNT,token:TOKEN,batchId:batchId(batch)}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[BigInt(plan()[batch].length),BigInt(plan()[batch].length)*AMOUNT])}];
test('fixed deduplicated list and final partial batch',()=>{assert.deepEqual(plan().map(b=>b.length),[200,200,200,200,200,196]);assert.equal(new Set(plan().flat()).size,1196);assert.ok(!plan().flat().includes('0x000000000000000000000000000000000000dead'))});
test('all six calls contain exactly one token per recipient',()=>{for(let i=0;i<6;i++){const d=decodeFunctionData({abi:artifact.abi,data:callFor({kind:'send',batch:i}).data});assert.equal(d.args[2].length,plan()[i].length);assert.ok(d.args[3].every(n=>n===AMOUNT));assert.equal(verifyDelivery({kind:'send',batch:i},logs(i)).length,plan()[i].length)}});
test('six rounds consume 1196 tokens and stop',()=>{const j=fresh();let allowance=0n;assert.equal(next(j,allowance).amount,TOTAL.toString());allowance=TOTAL;for(let i=0;i<6;i++){assert.deepEqual(next(j,allowance),{kind:'send',batch:i});j.entries.push({kind:'send',batch:i,settled:true,success:true,confirmedAt:100+i*60});allowance-=BigInt(plan()[i].length)*AMOUNT;}assert.equal(allowance,0n);assert.equal(next(j,allowance),null)});
test('last partial batch is not accepted as 200',()=>{const l=logs(5);l.pop();assert.throws(()=>verifyDelivery({kind:'send',batch:5},l))});
test('strict sixty second receipt spacing',()=>{const j={entries:[{kind:'send',settled:true,success:true,confirmedAt:1000}]};assert.equal(dueAt(j),1060);assert.equal(isDue(j,1059),false);assert.equal(isDue(j,1060),true)});
test('does not authorize outside explicit workflow dispatch',()=>{assert.throws(()=>authorize(fresh(),{}))});
test('hash is durably saved before a broadcast with lost response',async()=>{let saved=false;const e={},j=fresh(),raw=toHex('signed test');await assert.rejects(persistThenBroadcast({journal:j,entry:e,raw,save:async()=>{saved=true;assert.equal(e.hash,keccak256(raw))},broadcast:async()=>{assert.ok(saved);throw Error('lost response')}}));assert.equal(e.hash,keccak256(raw))});
test('failed checkpoint prevents broadcasting',async()=>{let broadcast=false;await assert.rejects(persistThenBroadcast({journal:fresh(),entry:{},raw:toHex('test'),save:async()=>{throw Error('write failed')},broadcast:async()=>{broadcast=true}}));assert.equal(broadcast,false)});
test('budget is not reset and seventh round is forbidden',()=>{assert.throws(()=>reserve(100000000000000000n,100000n,50000000n));assert.throws(()=>callFor({kind:'send',batch:6}))});
test('pending prior task is rejected',()=>assert.throws(()=>setPrior({version:2,entries:[{settled:false}]})));
test('compact checkpoint preserves final batch calldata',()=>{setPrior({version:2,entries:[{settled:true,success:true,transaction:{nonce:87}}]});const j=fresh();for(let i=0;i<6;i++){const c=callFor({kind:'send',batch:i});j.entries.push({kind:'send',batch:i,settled:true,success:true,hash:'0x'+String(i+1).padStart(64,'0'),transaction:{...c,value:'0',nonce:88+i,chainId:56,type:'legacy',gas:'100000',gasPrice:'50000000'}})}validate(j);assert.deepEqual(hydrate(compact(j)),j)});

import {mainChain} from './csv1196-chain.mjs';
import {blobSha} from './csv1196-store.mjs';

const dispatchEnv={
 GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',
 GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',
 CSV1196_CONFIRM:'1196x1:6batches',GITHUB_TOKEN:'offline-test-token'
};
function completedCheckpoint(firstNonce){
 const j=fresh();
 for(let batch=0;batch<6;batch++){
  j.entries.push({kind:'send',batch,settled:true,success:true,
   hash:'0x'+String(batch+1).padStart(64,'0'),
   transaction:{...callFor({kind:'send',batch}),value:'0',nonce:firstNonce+batch,
    chainId:56,type:'legacy',gas:'100000',gasPrice:'50000000'}});
 }
 return compact(j);
}
function mockCheckpointReads(t,prior,checkpoint){
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.equal(init.method,'GET','recovery must not write or broadcast for a completed checkpoint');
  const parsed=new URL(url);
  assert.equal(parsed.origin,'https://api.github.com');
  assert.equal(parsed.pathname,'/repos/xuxi1234/flap-stock-meme/contents/journal.json');
  const ref=parsed.searchParams.get('ref');
  assert.ok(['automation/airdrop-72x200-ledger','automation/airdrop-csv1196-ledger'].includes(ref));
  const value=ref==='automation/airdrop-72x200-ledger'?prior:checkpoint;
  const content=JSON.stringify(value)+'\n';
  return new Response(JSON.stringify({encoding:'base64',size:Buffer.byteLength(content),
   content:Buffer.from(content).toString('base64'),sha:blobSha(content)}),{status:200});
 });
}
test('fresh runner loads the prior nonce before validating an existing campaign',async t=>{
 // At the real interruption the old task ended at nonce 89; this task starts at 90.
 setPrior({version:2,entries:[{settled:true,success:true,transaction:{nonce:87}}]});
 const checkpoint=completedCheckpoint(90),before=structuredClone(checkpoint);
 mockCheckpointReads(t,{version:2,entries:[{settled:true,success:true,transaction:{nonce:89}}]},checkpoint);
 await assert.doesNotReject(mainChain({...dispatchEnv}));
 assert.deepEqual(checkpoint,before);
});
test('fresh runner refuses an unsettled prior transaction before accepting a checkpoint',async t=>{
 setPrior({version:2,entries:[{settled:true,success:true,transaction:{nonce:87}}]});
 mockCheckpointReads(t,{version:2,entries:[{settled:false,transaction:{nonce:89}}]},completedCheckpoint(88));
 await assert.rejects(mainChain({...dispatchEnv}),/旧任务仍有未确认或失败交易/);
});
test('loading prior history still rejects a tampered campaign nonce',async t=>{
 setPrior({version:2,entries:[{settled:true,success:true,transaction:{nonce:87}}]});
 const checkpoint=completedCheckpoint(90);checkpoint.entries[0].transaction.nonce=91;
 mockCheckpointReads(t,{version:2,entries:[{settled:true,success:true,transaction:{nonce:89}}]},checkpoint);
 await assert.rejects(mainChain({...dispatchEnv}),/交易参数或 nonce/);
});
