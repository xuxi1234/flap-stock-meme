import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256} from 'viem';
import * as c from './sheep335-core.mjs';
import {executionAllowed,confirmedBlocks} from './sheep335-run.mjs';
import {compact,hydrate,openGitHubStore} from './sheep335-store.mjs';
test('exact campaign: 335 unique recipients, 2 batches, final 135',()=>{
 assert.equal(c.addresses.length,335);assert.equal(c.plan.length,2);assert.equal(c.plan[1].length,135);
 assert.equal(new Set(c.plan.flat()).size,335);assert.equal(c.TOTAL,335n*7777n*10n**14n);
 assert.ok(!c.plan.flat().includes(c.ACCOUNT));assert.equal(new Set(c.plan.map((_,i)=>c.batchId(i))).size,2);
});
test('only manual main invocation can execute',()=>{
 const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',SHEEP335_CONFIRM:c.CONFIRM};
 assert.equal(executionAllowed(env),true);
 for(const event of ['push','schedule','pull_request'])assert.equal(executionAllowed({...env,GITHUB_EVENT_NAME:event}),false);
 assert.equal(executionAllowed({...env,SHEEP335_CONFIRM:''}),false);
 assert.equal(executionAllowed({...env,GITHUB_REF:'refs/heads/other'}),false);
});
test('5 minutes counted after observed confirmation',()=>{
 assert.equal(c.dueAt({entries:[{kind:'send',settled:true,success:true,confirmedAt:100,verifiedAt:120}]}),420);
});
const entry=()=>({kind:'send',batch:0,settled:false,transaction:{...c.callFor({kind:'send',batch:0}),nonce:7,chainId:56,type:'legacy',gas:'100000',gasPrice:'1000000000'}});
test('checkpoint round trip and rejection of altered nonce or batch',()=>{
 const j={...c.fresh(),baseNonce:7,entries:[entry()]};c.validate(j);assert.deepEqual(hydrate(compact(j)),j);
 assert.throws(()=>c.validate({...j,entries:[{...entry(),batch:1}]}));
 const e=entry();e.transaction.nonce=6;assert.throws(()=>c.validate({...j,entries:[e]}));
});
test('never broadcast if durable hash save fails; restart retains identical hash',async()=>{
 const j={...c.fresh(),baseNonce:7,entries:[entry()]};let sends=0;const raw='0x1234';
 await assert.rejects(c.persistThenBroadcast({journal:j,entry:j.entries[0],raw,save:async()=>{throw Error('unavailable')},broadcast:async()=>{sends++}}));assert.equal(sends,0);
 const hash=await c.persistThenBroadcast({journal:j,entry:j.entries[0],raw,save:async()=>{},broadcast:async()=>{sends++;return keccak256(raw)}});assert.equal(hash,keccak256(raw));assert.equal(sends,1);
 await assert.rejects(c.persistThenBroadcast({journal:j,entry:j.entries[0],raw:'0x5649',save:async()=>{},broadcast:async()=>{sends++}}));assert.equal(sends,1);
});
test('both RPCs must reach twelve confirmations',async()=>{
 let pauses=0;const clients=[0,1].map(()=>({getBlock:async()=>({hash:'0xabc',timestamp:100n}),getBlockNumber:async()=>pauses?111n:110n}));
 await confirmedBlocks(clients,{blockNumber:'0x64',blockHash:'0xabc'},{pause:async()=>pauses++,now:()=>0});assert.equal(pauses,1);
});
test('no state branch is written during read-only check',async()=>{
 const calls=[];const s=await openGitHubStore({api:async(method)=>{calls.push(method);return null},readOnly:true});await s.save(s.journal);assert.deepEqual(calls,['GET']);
});


test('resume skips confirmed batch and approves only remaining tokens',()=>{
 const j={...c.fresh(),entries:[{kind:'send',batch:0,settled:true,success:true}]};
 const remaining=c.TOTAL-200n*c.AMOUNT;
 assert.deepEqual(c.next(j,remaining),{kind:'send',batch:1});
 assert.deepEqual(c.next(j,0n),{kind:'approve',amount:String(remaining)});
 assert.deepEqual(c.next(j,remaining+1n),{kind:'reset',amount:'0'});
 assert.throws(()=>c.next({...j,entries:[...j.entries,{kind:'send',batch:1,settled:false}]},remaining));
});
test('completion never creates another delivery',()=>{
 const j={...c.fresh(),entries:c.plan.map((_,batch)=>({kind:'send',batch,settled:true,success:true}))};
 assert.equal(c.next(j,0n),null);assert.deepEqual(c.next(j,1n),{kind:'reset',amount:'0'});
});
test('journal rejects duplicate batches and insufficient interval; accepts settled nonce gaps',()=>{
 const e=(batch,nonce,time)=>({kind:'send',batch,hash:'0x'+'1'.repeat(64),settled:true,success:true,confirmedAt:time,verifiedAt:time,transaction:{...c.callFor({kind:'send',batch}),nonce,chainId:56,type:'legacy',gas:'100000',gasPrice:'1000000000'}});
 const j={...c.fresh(),baseNonce:7,entries:[e(0,7,1000),e(1,10,1300)]};c.validate(j);
 assert.throws(()=>c.validate({...j,entries:[j.entries[0],e(0,10,1300)]}));
 assert.throws(()=>c.validate({...j,entries:[j.entries[0],e(1,10,1299)]}));
});
