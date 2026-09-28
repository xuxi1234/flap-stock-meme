import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256} from 'viem';
import * as c from './stock28122-core.mjs';
import {executionAllowed,confirmedBlocks} from './stock28122-run.mjs';
import {compact,hydrate,openGitHubStore} from './stock28122-store.mjs';
test('exact CSV: 28122 unique recipients, 141 batches, final 122; retain burn recipient',()=>{
 assert.equal(c.addresses.length,28122);assert.equal(c.plan.length,141);assert.equal(c.plan[140].length,122);
 assert.equal(new Set(c.plan.flat()).size,28122);assert.equal(c.TOTAL,28122n*10n**18n);
 assert.ok(c.addresses.includes('0x000000000000000000000000000000000000dead'));
 assert.equal(new Set(c.plan.map((_,i)=>c.batchId(i))).size,141);
});
test('only manual main invocation can execute',()=>{
 const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',STOCK28122_CONFIRM:c.CONFIRM};
 assert.equal(executionAllowed(env),true);
 for(const event of ['push','schedule','pull_request'])assert.equal(executionAllowed({...env,GITHUB_EVENT_NAME:event}),false);
 assert.equal(executionAllowed({...env,STOCK28122_CONFIRM:''}),false);
 assert.equal(executionAllowed({...env,GITHUB_REF:'refs/heads/other'}),false);
});
test('30 minutes counted after observed confirmation',()=>{
 assert.equal(c.dueAt({entries:[{kind:'send',settled:true,success:true,confirmedAt:100,verifiedAt:120}]}),1920);
});
const entry=()=>({kind:'send',batch:0,settled:false,transaction:{...c.callFor({kind:'send',batch:0}),nonce:7,chainId:56,type:'legacy',gas:'100000',gasPrice:'1000000000'}});
test('checkpoint round trip and rejection of altered nonce or batch',()=>{
 const j={...c.fresh(),baseNonce:7,entries:[entry()]};c.validate(j);assert.deepEqual(hydrate(compact(j)),j);
 assert.throws(()=>c.validate({...j,entries:[{...entry(),batch:1}]}));
 const e=entry();e.transaction.nonce=8;assert.throws(()=>c.validate({...j,entries:[e]}));
});
test('never broadcast if durable hash save fails; restart retains identical hash',async()=>{
 const j={...c.fresh(),baseNonce:7,entries:[entry()]};let sends=0;const raw='0x1234';
 await assert.rejects(c.persistThenBroadcast({journal:j,entry:j.entries[0],raw,save:async()=>{throw Error('unavailable')},broadcast:async()=>{sends++}}));assert.equal(sends,0);
 const hash=await c.persistThenBroadcast({journal:j,entry:j.entries[0],raw,save:async()=>{},broadcast:async()=>{sends++;return keccak256(raw)}});assert.equal(hash,keccak256(raw));assert.equal(sends,1);
 await assert.rejects(c.persistThenBroadcast({journal:j,entry:j.entries[0],raw:'0x5678',save:async()=>{},broadcast:async()=>{sends++}}));assert.equal(sends,1);
});
test('both RPCs must reach twelve confirmations',async()=>{
 let pauses=0;const clients=[0,1].map(()=>({getBlock:async()=>({hash:'0xabc',timestamp:100n}),getBlockNumber:async()=>pauses?111n:110n}));
 await confirmedBlocks(clients,{blockNumber:'0x64',blockHash:'0xabc'},{pause:async()=>pauses++,now:()=>0});assert.equal(pauses,1);
});
test('no state branch is written during read-only check',async()=>{
 const calls=[];const s=await openGitHubStore({api:async(method)=>{calls.push(method);return null},readOnly:true});await s.save(s.journal);assert.deepEqual(calls,['GET']);
});
